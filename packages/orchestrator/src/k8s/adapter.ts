import * as k8s from '@kubernetes/client-node'
import type {
  IOrchestrator,
  K8sConnection,
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
import {
  makeTektonClients,
  triggerTektonPipeline,
  getTektonTaskrun,
  cancelTektonPipeline,
  type TektonClients,
} from './tekton'

export class K8sOrchestrator implements IOrchestrator {
  readonly type = 'kubernetes' as const
  private kc: k8s.KubeConfig
  private coreApi: k8s.CoreV1Api
  private appsApi: k8s.AppsV1Api
  private batchApi: k8s.BatchV1Api
  private networkApi: k8s.NetworkingV1Api
  private autoApi: k8s.AutoscalingV1Api
  private tekton: TektonClients

  constructor(connection: K8sConnection) {
    this.kc = new k8s.KubeConfig()
    this.kc.loadFromString(connection.kubeconfig)
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api)
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api)
    this.batchApi = this.kc.makeApiClient(k8s.BatchV1Api)
    this.networkApi = this.kc.makeApiClient(k8s.NetworkingV1Api)
    this.autoApi = this.kc.makeApiClient(k8s.AutoscalingV1Api)
    this.tekton = makeTektonClients(this.kc)
  }

  /** Expose Tekton clients for direct pipeline management from higher layers. */
  getTektonClients(): TektonClients {
    return this.tekton
  }

  async createNamespace(name: string): Promise<void> {
    await this.coreApi.createNamespace({
      body: { metadata: { name } },
    })
  }

  async deleteNamespace(name: string): Promise<void> {
    await this.coreApi.deleteNamespace({ name })
  }

  async listNamespaces(): Promise<string[]> {
    const res = await this.coreApi.listNamespace()
    return (res.items ?? []).map(ns => ns.metadata?.name ?? '').filter(Boolean)
  }

  async createContainer(spec: ContainerSpec): Promise<ContainerResult> {
    const { namespace, name, type, image, variables, podConfig, networking, probes } = spec
    const env = variables.map(v => ({ name: v.name, value: v.value }))
    const resources = {
      requests: {
        cpu: `${podConfig.cpuRequest}m`,
        memory: `${podConfig.memoryRequest}Mi`,
      },
      limits: {
        cpu: `${podConfig.cpuLimit}m`,
        memory: `${podConfig.memoryLimit}Mi`,
      },
    }

    const containerDef: k8s.V1Container = {
      name,
      image,
      env,
      resources,
      ports: networking?.containerPort ? [{ containerPort: networking.containerPort }] : undefined,
    }

    if (probes?.liveness?.enabled) {
      containerDef.livenessProbe = this.buildProbe(probes.liveness)
    }
    if (probes?.readiness?.enabled) {
      containerDef.readinessProbe = this.buildProbe(probes.readiness)
    }

    switch (type) {
      case 'deployment':
        await this.createDeployment(namespace, name, containerDef, spec)
        break
      case 'statefulset':
        await this.createStatefulSet(namespace, name, containerDef, spec)
        break
      case 'cronjob':
        await this.createCronJob(namespace, name, containerDef, spec)
        break
    }

    // Create service for non-cronjob types
    if (type !== 'cronjob' && networking?.containerPort) {
      await this.createService(namespace, name, networking.containerPort)
    }

    return { name, namespace, type, image, status: 'creating' }
  }

  async updateContainer(spec: ContainerSpec): Promise<ContainerResult> {
    // Delete and recreate — simplest correct approach for now
    await this.deleteContainer(spec.namespace, spec.name, spec.type)
    return this.createContainer(spec)
  }

  async deleteContainer(namespace: string, name: string, type: ContainerType): Promise<void> {
    switch (type) {
      case 'deployment':
        await this.appsApi.deleteNamespacedDeployment({ name, namespace }).catch(() => {})
        break
      case 'statefulset':
        await this.appsApi.deleteNamespacedStatefulSet({ name, namespace }).catch(() => {})
        break
      case 'cronjob':
        await this.batchApi.deleteNamespacedCronJob({ name, namespace }).catch(() => {})
        break
    }
    // Cleanup service
    await this.coreApi.deleteNamespacedService({ name, namespace }).catch(() => {})
  }

  async getContainerStatus(namespace: string, name: string, type: ContainerType): Promise<ContainerStatus> {
    if (type === 'deployment') {
      const dep = await this.appsApi.readNamespacedDeployment({ name, namespace })
      const pods = await this.coreApi.listNamespacedPod({
        namespace,
        labelSelector: `app=${name}`,
      })
      return {
        ready: (dep.status?.readyReplicas ?? 0) >= (dep.status?.replicas ?? 1),
        replicas: dep.status?.replicas ?? 0,
        readyReplicas: dep.status?.readyReplicas ?? 0,
        updatedReplicas: dep.status?.updatedReplicas ?? 0,
        availableReplicas: dep.status?.availableReplicas ?? 0,
        pods: (pods.items ?? []).map(p => ({
          name: p.metadata?.name ?? '',
          phase: p.status?.phase ?? 'Unknown',
          ready: p.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True') ?? false,
          restarts: p.status?.containerStatuses?.[0]?.restartCount ?? 0,
          startedAt: p.status?.startTime?.toISOString(),
          containers: (p.status?.containerStatuses ?? []).map(cs => ({
            name: cs.name,
            ready: cs.ready,
            state: cs.state?.running ? 'running' : cs.state?.waiting ? 'waiting' : 'terminated',
            restarts: cs.restartCount,
          })),
        })),
      }
    }
    // Simplified for other types
    return {
      ready: true,
      replicas: 1,
      readyReplicas: 1,
      updatedReplicas: 1,
      availableReplicas: 1,
      pods: [],
    }
  }

  async listContainers(namespace: string): Promise<ContainerResult[]> {
    const deps = await this.appsApi.listNamespacedDeployment({ namespace })
    return (deps.items ?? []).map(d => ({
      name: d.metadata?.name ?? '',
      namespace,
      type: 'deployment' as ContainerType,
      image: d.spec?.template?.spec?.containers?.[0]?.image ?? '',
      status: d.status?.readyReplicas ? 'running' : 'creating',
    }))
  }

  async scaleContainer(namespace: string, name: string, replicas: number): Promise<void> {
    await this.appsApi.patchNamespacedDeploymentScale({
      name,
      namespace,
      body: { spec: { replicas } },
    })
  }

  async createIngress(spec: IngressSpec): Promise<void> {
    const ingress: k8s.V1Ingress = {
      metadata: {
        name: spec.name,
        namespace: spec.namespace,
        annotations: {
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          ...spec.annotations,
        },
      },
      spec: {
        ingressClassName: 'nginx',
        tls: spec.tls ? [{
          hosts: [spec.host],
          secretName: `${spec.name}-tls`,
        }] : undefined,
        rules: [{
          host: spec.host,
          http: {
            paths: [{
              path: spec.path ?? '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: spec.serviceName,
                  port: { number: spec.servicePort },
                },
              },
            }],
          },
        }],
      },
    }
    await this.networkApi.createNamespacedIngress({ namespace: spec.namespace, body: ingress })
  }

  async updateIngress(spec: IngressSpec): Promise<void> {
    await this.deleteIngress(spec.namespace, spec.name).catch(() => {})
    await this.createIngress(spec)
  }

  async deleteIngress(namespace: string, name: string): Promise<void> {
    await this.networkApi.deleteNamespacedIngress({ name, namespace })
  }

  async createVolume(spec: VolumeSpec): Promise<void> {
    await this.coreApi.createNamespacedPersistentVolumeClaim({
      namespace: spec.namespace,
      body: {
        metadata: { name: spec.name },
        spec: {
          accessModes: spec.accessModes ?? ['ReadWriteOnce'],
          storageClassName: spec.storageClass ?? 'do-block-storage',
          resources: { requests: { storage: spec.size } },
        },
      },
    })
  }

  async deleteVolume(namespace: string, name: string): Promise<void> {
    await this.coreApi.deleteNamespacedPersistentVolumeClaim({ name, namespace })
  }

  async *streamLogs(namespace: string, name: string, opts: LogOptions): AsyncIterable<string> {
    const log = new k8s.Log(this.kc)
    const pods = await this.coreApi.listNamespacedPod({
      namespace,
      labelSelector: `app=${name}`,
    })
    const podName = pods.items?.[0]?.metadata?.name
    if (!podName) {
      yield 'No pods found'
      return
    }
    const { PassThrough } = await import('node:stream')
    const passThrough = new PassThrough()
    await log.log(namespace, podName, opts.container ?? name, passThrough, {
      follow: opts.follow ?? false,
      tailLines: opts.tail ?? 100,
      timestamps: opts.timestamps ?? false,
    })
    for await (const chunk of passThrough) {
      yield chunk.toString()
    }
  }

  async triggerBuild(spec: BuildSpec): Promise<BuildResult> {
    // Build a ContainerInfo / EnvironmentInfo / GitProviderConfig from the BuildSpec
    // to drive Tekton. The caller must populate spec.repo with connected repo info.
    const container = {
      _id: spec.containerId,
      slug: spec.name,
      iid: spec.name,
      type: 'deployment' as const,
      repo: {
        connected: true,
        type: (spec.repo.provider ?? 'github') as 'github' | 'gitlab' | 'bitbucket',
        url: spec.repo.url ?? '',
        branch: spec.repo.branch ?? 'main',
        path: spec.repo.path ?? '.',
        watchPath: spec.repo.watchPaths?.join(','),
        dockerfile: spec.repo.dockerfile ?? 'Dockerfile',
        name: spec.imageName,
        repoId: spec.repo.gitProviderId,
        testImage: spec.repo.testImage,
        testEnabled: spec.repo.testEnabled,
        testCommand: spec.repo.testCommand,
      },
    }
    const environment = { iid: spec.namespace }
    const gitProvider = {
      provider: container.repo.type,
      accessToken: '', // Must be injected by the API layer via TriggerBinding
    }

    const taskRunName = await triggerTektonPipeline(
      this.tekton, container, environment, gitProvider,
    )
    return { buildId: taskRunName, status: 'queued' }
  }

  async getBuildStatus(buildId: string): Promise<BuildStatus> {
    const taskRun = await getTektonTaskrun(this.tekton, buildId)
    if (!taskRun) {
      return { id: buildId, status: 'unknown' }
    }
    return {
      id: taskRun.name,
      status: taskRun.status,
      startedAt: taskRun.startedAt,
      finishedAt: taskRun.finishedAt,
    }
  }

  async cancelBuild(buildId: string): Promise<void> {
    await cancelTektonPipeline(this.tekton, buildId)
  }

  async ping(): Promise<boolean> {
    try {
      await this.coreApi.listNamespace()
      return true
    } catch {
      return false
    }
  }

  async getClusterInfo(): Promise<ClusterInfo> {
    const nodes = await this.coreApi.listNode()
    let totalCpu = 0
    let totalMemory = 0
    for (const node of nodes.items ?? []) {
      const cap = node.status?.capacity
      if (cap) {
        totalCpu += parseInt(cap.cpu ?? '0') * 1000
        const mem = cap.memory ?? '0'
        totalMemory += parseInt(mem) / 1024 // Ki to Mi
      }
    }
    const version = await this.kc.makeApiClient(k8s.VersionApi).getCode()
    return {
      version: `${version.major}.${version.minor}`,
      platform: nodes.items?.[0]?.status?.nodeInfo?.osImage ?? 'unknown',
      nodeCount: nodes.items?.length ?? 0,
      totalCpu,
      totalMemory,
    }
  }

  // ---- Private helpers ----

  private async createDeployment(namespace: string, name: string, container: k8s.V1Container, spec: ContainerSpec) {
    const dc = spec.deploymentConfig
    await this.appsApi.createNamespacedDeployment({
      namespace,
      body: {
        metadata: { name, labels: { app: name } },
        spec: {
          replicas: dc?.replicas ?? 1,
          strategy: dc?.strategy === 'Recreate'
            ? { type: 'Recreate' }
            : { type: 'RollingUpdate', rollingUpdate: { maxSurge: dc?.maxSurge ?? 1, maxUnavailable: dc?.maxUnavailable ?? 0 } },
          selector: { matchLabels: { app: name } },
          template: {
            metadata: { labels: { app: name } },
            spec: {
              containers: [container],
              restartPolicy: spec.podConfig.restartPolicy,
            },
          },
        },
      },
    })
  }

  private async createStatefulSet(namespace: string, name: string, container: k8s.V1Container, spec: ContainerSpec) {
    const sc = spec.statefulSetConfig
    await this.appsApi.createNamespacedStatefulSet({
      namespace,
      body: {
        metadata: { name, labels: { app: name } },
        spec: {
          serviceName: name,
          replicas: sc?.replicas ?? 1,
          podManagementPolicy: sc?.podManagementPolicy ?? 'OrderedReady',
          selector: { matchLabels: { app: name } },
          template: {
            metadata: { labels: { app: name } },
            spec: { containers: [container] },
          },
        },
      },
    })
  }

  private async createCronJob(namespace: string, name: string, container: k8s.V1Container, spec: ContainerSpec) {
    const cc = spec.cronJobConfig
    if (!cc) throw new Error('cronJobConfig is required for cronjob type')
    await this.batchApi.createNamespacedCronJob({
      namespace,
      body: {
        metadata: { name },
        spec: {
          schedule: cc.schedule,
          concurrencyPolicy: cc.concurrencyPolicy,
          suspend: cc.suspend,
          successfulJobsHistoryLimit: cc.successfulJobsHistoryLimit,
          failedJobsHistoryLimit: cc.failedJobsHistoryLimit,
          jobTemplate: {
            spec: {
              template: {
                spec: {
                  containers: [container],
                  restartPolicy: 'OnFailure',
                },
              },
            },
          },
        },
      },
    })
  }

  private async createService(namespace: string, name: string, port: number) {
    await this.coreApi.createNamespacedService({
      namespace,
      body: {
        metadata: { name, labels: { app: name } },
        spec: {
          selector: { app: name },
          ports: [{ port, targetPort: port }],
        },
      },
    })
  }

  private buildProbe(config: { type: string; httpPath?: string; port?: number; command?: string[]; initialDelaySeconds: number; periodSeconds: number; timeoutSeconds: number; failureThreshold: number; successThreshold: number }): k8s.V1Probe {
    const probe: k8s.V1Probe = {
      initialDelaySeconds: config.initialDelaySeconds,
      periodSeconds: config.periodSeconds,
      timeoutSeconds: config.timeoutSeconds,
      failureThreshold: config.failureThreshold,
      successThreshold: config.successThreshold,
    }
    if (config.type === 'httpGet') {
      probe.httpGet = { path: config.httpPath ?? '/', port: config.port ?? 80 }
    } else if (config.type === 'tcpSocket') {
      probe.tcpSocket = { port: config.port ?? 80 }
    } else if (config.type === 'exec') {
      probe.exec = { command: config.command }
    }
    return probe
  }
}
