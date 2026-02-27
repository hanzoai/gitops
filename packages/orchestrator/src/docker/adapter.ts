import Dockerode from 'dockerode'
import type {
  IOrchestrator,
  DockerConnection,
  ContainerSpec,
  ContainerResult,
  ContainerStatus,
  IngressSpec,
  VolumeSpec,
  LogOptions,
  BuildSpec,
  BuildResult,
  BuildStatus,
  ClusterInfo,
} from '../types'
import type { ContainerType } from '@paas/shared'

/**
 * Docker adapter: maps IOrchestrator to Docker Engine API.
 *
 * - docker-swarm mode: uses Swarm services with overlay networks
 * - docker-compose mode: uses standalone containers with bridge networks
 *
 * Traefik labels are generated for ingress routing (replaces K8s Ingress + nginx).
 */
export class DockerOrchestrator implements IOrchestrator {
  readonly type: 'docker-swarm' | 'docker-compose'
  private docker: Dockerode

  constructor(connection: DockerConnection, type: 'docker-swarm' | 'docker-compose') {
    this.type = type
    if (connection.host.startsWith('unix://')) {
      this.docker = new Dockerode({ socketPath: connection.host.replace('unix://', '') })
    } else {
      const url = new URL(connection.host)
      this.docker = new Dockerode({
        host: url.hostname,
        port: parseInt(url.port || '2376'),
        ...(connection.tlsCert && {
          ca: connection.tlsCa,
          cert: connection.tlsCert,
          key: connection.tlsKey,
        }),
      })
    }
  }

  // ---- Namespace = Docker network ----

  async createNamespace(name: string): Promise<void> {
    const driver = this.type === 'docker-swarm' ? 'overlay' : 'bridge'
    await this.docker.createNetwork({
      Name: name,
      Driver: driver,
      Attachable: true,
      Labels: { 'paas.namespace': name },
    })
  }

  async deleteNamespace(name: string): Promise<void> {
    const network = this.docker.getNetwork(name)
    await network.remove()
  }

  async listNamespaces(): Promise<string[]> {
    const networks = await this.docker.listNetworks({
      filters: { label: ['paas.namespace'] },
    })
    return networks.map(n => n.Name ?? '')
  }

  // ---- Container lifecycle ----

  async createContainer(spec: ContainerSpec): Promise<ContainerResult> {
    const { namespace, name, image, variables, podConfig, networking } = spec
    const env = variables.map(v => `${v.name}=${v.value}`)

    if (this.type === 'docker-swarm') {
      return this.createSwarmService(spec, env)
    }
    return this.createStandaloneContainer(spec, env)
  }

  async updateContainer(spec: ContainerSpec): Promise<ContainerResult> {
    await this.deleteContainer(spec.namespace, spec.name, spec.type).catch(() => {})
    return this.createContainer(spec)
  }

  async deleteContainer(namespace: string, name: string, _type: ContainerType): Promise<void> {
    const fullName = `${namespace}_${name}`
    if (this.type === 'docker-swarm') {
      const service = this.docker.getService(fullName)
      await service.remove().catch(() => {})
    } else {
      const container = this.docker.getContainer(fullName)
      await container.stop().catch(() => {})
      await container.remove().catch(() => {})
    }
  }

  async getContainerStatus(namespace: string, name: string, _type: ContainerType): Promise<ContainerStatus> {
    const fullName = `${namespace}_${name}`
    if (this.type === 'docker-swarm') {
      const service = this.docker.getService(fullName)
      const info = await service.inspect()
      const tasks = await this.docker.listTasks({ filters: { service: [fullName] } })
      const running = tasks.filter(t => t.Status?.State === 'running')
      return {
        ready: running.length > 0,
        replicas: info.Spec?.Mode?.Replicated?.Replicas ?? 1,
        readyReplicas: running.length,
        updatedReplicas: running.length,
        availableReplicas: running.length,
        pods: tasks.map(t => ({
          name: t.ID ?? '',
          phase: t.Status?.State ?? 'unknown',
          ready: t.Status?.State === 'running',
          restarts: 0,
          startedAt: t.Status?.Timestamp,
          containers: [{
            name,
            ready: t.Status?.State === 'running',
            state: t.Status?.State ?? 'unknown',
            restarts: 0,
          }],
        })),
      }
    }

    // Standalone container
    const container = this.docker.getContainer(fullName)
    const info = await container.inspect()
    const running = info.State?.Running ?? false
    return {
      ready: running,
      replicas: 1,
      readyReplicas: running ? 1 : 0,
      updatedReplicas: running ? 1 : 0,
      availableReplicas: running ? 1 : 0,
      pods: [{
        name: fullName,
        phase: running ? 'Running' : 'Stopped',
        ready: running,
        restarts: info.RestartCount ?? 0,
        startedAt: info.State?.StartedAt,
        containers: [{
          name,
          ready: running,
          state: running ? 'running' : 'stopped',
          restarts: info.RestartCount ?? 0,
        }],
      }],
    }
  }

  async listContainers(namespace: string): Promise<ContainerResult[]> {
    if (this.type === 'docker-swarm') {
      const services = await this.docker.listServices({
        filters: { label: [`paas.namespace=${namespace}`] },
      })
      return services.map(s => ({
        name: s.Spec?.Name?.replace(`${namespace}_`, '') ?? '',
        namespace,
        type: 'deployment' as ContainerType,
        image: (s.Spec?.TaskTemplate as any)?.ContainerSpec?.Image ?? '',
        status: 'running',
      }))
    }
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: [`paas.namespace=${namespace}`] },
    })
    return containers.map(c => ({
      name: (c.Names?.[0] ?? '').replace(`/${namespace}_`, ''),
      namespace,
      type: 'deployment' as ContainerType,
      image: c.Image ?? '',
      status: c.State ?? 'unknown',
    }))
  }

  async scaleContainer(namespace: string, name: string, replicas: number): Promise<void> {
    if (this.type !== 'docker-swarm') {
      throw new Error('Scaling is only supported in Docker Swarm mode')
    }
    const fullName = `${namespace}_${name}`
    const service = this.docker.getService(fullName)
    const info = await service.inspect()
    await service.update({
      ...info.Spec,
      version: info.Version?.Index,
      Mode: { Replicated: { Replicas: replicas } },
    })
  }

  // ---- Networking: Traefik labels for Docker routing ----

  async createIngress(spec: IngressSpec): Promise<void> {
    // Traefik labels are applied at container/service creation time
    // This is a no-op for Docker — ingress is baked into container labels
  }

  async updateIngress(spec: IngressSpec): Promise<void> {
    // Same as above — requires container recreation
  }

  async deleteIngress(_namespace: string, _name: string): Promise<void> {
    // No-op — ingress is removed when container is removed
  }

  // ---- Storage ----

  async createVolume(spec: VolumeSpec): Promise<void> {
    await this.docker.createVolume({
      Name: `${spec.namespace}_${spec.name}`,
      Labels: { 'paas.namespace': spec.namespace },
    })
  }

  async deleteVolume(namespace: string, name: string): Promise<void> {
    const volume = this.docker.getVolume(`${namespace}_${name}`)
    await volume.remove()
  }

  // ---- Logs ----

  async *streamLogs(namespace: string, name: string, opts: LogOptions): AsyncIterable<string> {
    const fullName = `${namespace}_${name}`
    if (this.type === 'docker-swarm') {
      const service = this.docker.getService(fullName)
      const stream = await service.logs({
        follow: opts.follow ?? false,
        stdout: true,
        stderr: true,
        tail: opts.tail ?? 100,
        timestamps: opts.timestamps ?? false,
      })
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        yield chunk.toString()
      }
    } else {
      const container = this.docker.getContainer(fullName)
      const stream = await (container.logs as any)({
        follow: opts.follow ?? false,
        stdout: true,
        stderr: true,
        tail: opts.tail ?? 100,
        timestamps: opts.timestamps ?? false,
      })
      if (typeof stream === 'string') {
        yield stream
      } else {
        for await (const chunk of stream as AsyncIterable<Buffer>) {
          yield chunk.toString()
        }
      }
    }
  }

  // ---- Build ----

  async triggerBuild(spec: BuildSpec): Promise<BuildResult> {
    // Docker mode: use `docker build` + `docker push` directly
    // This will be implemented via BullMQ worker
    return { buildId: `docker-build-${Date.now()}`, status: 'queued' }
  }

  async getBuildStatus(buildId: string): Promise<BuildStatus> {
    return { id: buildId, status: 'queued' }
  }

  async cancelBuild(_buildId: string): Promise<void> {
    // Stop the build container
  }

  // ---- Health ----

  async ping(): Promise<boolean> {
    try {
      await this.docker.ping()
      return true
    } catch {
      return false
    }
  }

  async getClusterInfo(): Promise<ClusterInfo> {
    const info = await this.docker.info()
    return {
      version: info.ServerVersion ?? 'unknown',
      platform: `${info.OperatingSystem}/${info.Architecture}`,
      nodeCount: this.type === 'docker-swarm' ? (info.Swarm?.Nodes ?? 1) : 1,
      totalCpu: (info.NCPU ?? 1) * 1000,
      totalMemory: Math.round((info.MemTotal ?? 0) / 1024 / 1024),
    }
  }

  // ---- Private helpers ----

  private async createSwarmService(spec: ContainerSpec, env: string[]): Promise<ContainerResult> {
    const { namespace, name, image, podConfig, networking, deploymentConfig } = spec
    const fullName = `${namespace}_${name}`
    const labels: Record<string, string> = {
      'paas.namespace': namespace,
      'paas.name': name,
    }

    // Traefik routing labels
    if (networking?.ingress?.enabled && networking.customDomain) {
      labels[`traefik.enable`] = 'true'
      labels[`traefik.http.routers.${name}.rule`] = `Host(\`${networking.customDomain}\`)`
      labels[`traefik.http.routers.${name}.entrypoints`] = 'websecure'
      labels[`traefik.http.routers.${name}.tls.certresolver`] = 'letsencrypt'
      labels[`traefik.http.services.${name}.loadbalancer.server.port`] = `${networking.containerPort}`
    }

    await this.docker.createService({
      Name: fullName,
      Labels: labels,
      TaskTemplate: {
        ContainerSpec: {
          Image: image,
          Env: env,
        },
        Resources: {
          Limits: {
            NanoCPUs: podConfig.cpuLimit * 1_000_000,
            MemoryBytes: podConfig.memoryLimit * 1024 * 1024,
          },
          Reservations: {
            NanoCPUs: podConfig.cpuRequest * 1_000_000,
            MemoryBytes: podConfig.memoryRequest * 1024 * 1024,
          },
        },
      },
      Mode: { Replicated: { Replicas: deploymentConfig?.replicas ?? 1 } },
      Networks: [{ Target: namespace }],
    })
    return { name, namespace, type: spec.type, image, status: 'creating' }
  }

  private async createStandaloneContainer(spec: ContainerSpec, env: string[]): Promise<ContainerResult> {
    const { namespace, name, image, podConfig, networking } = spec
    const fullName = `${namespace}_${name}`
    const labels: Record<string, string> = {
      'paas.namespace': namespace,
      'paas.name': name,
    }

    // Traefik routing labels
    if (networking?.ingress?.enabled && networking.customDomain) {
      labels[`traefik.enable`] = 'true'
      labels[`traefik.http.routers.${name}.rule`] = `Host(\`${networking.customDomain}\`)`
      labels[`traefik.http.services.${name}.loadbalancer.server.port`] = `${networking.containerPort}`
    }

    const container = await this.docker.createContainer({
      name: fullName,
      Image: image,
      Env: env,
      Labels: labels,
      HostConfig: {
        Memory: podConfig.memoryLimit * 1024 * 1024,
        NanoCpus: podConfig.cpuLimit * 1_000_000,
        RestartPolicy: { Name: podConfig.restartPolicy === 'Always' ? 'always' : 'on-failure' },
        NetworkMode: namespace,
      },
      ExposedPorts: networking?.containerPort ? { [`${networking.containerPort}/tcp`]: {} } : undefined,
    })
    await container.start()
    return { name, namespace, type: spec.type, image, status: 'running' }
  }
}
