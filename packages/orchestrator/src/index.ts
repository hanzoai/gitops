import { K8sOrchestrator } from './k8s/adapter'
import { DockerOrchestrator } from './docker/adapter'
import type { IOrchestrator, OrchestratorConfig, K8sConnection, DockerConnection } from './types'

export function createOrchestrator(config: OrchestratorConfig): IOrchestrator {
  switch (config.clusterType) {
    case 'kubernetes':
      return new K8sOrchestrator(config.connection as K8sConnection)
    case 'docker-swarm':
    case 'docker-compose':
      return new DockerOrchestrator(config.connection as DockerConnection, config.clusterType)
    default:
      throw new Error(`Unknown cluster type: ${config.clusterType}`)
  }
}

export type { IOrchestrator, OrchestratorConfig, K8sConnection, DockerConnection } from './types'
