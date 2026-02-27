/**
 * Tekton pipeline management for Hanzo PaaS.
 *
 * Ported from platform/handlers/tekton.js to ESM TypeScript.
 * Uses @kubernetes/client-node CustomObjectsApi for Tekton CRDs
 * and Octokit / fetch for git-provider webhook registration.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as k8s from '@kubernetes/client-node'
import { Octokit } from '@octokit/core'
import YAML from 'yaml'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GitProvider = 'github' | 'gitlab' | 'bitbucket'

export type K8sResourceKind = 'Deployment' | 'StatefulSet' | 'CronJob'

export interface ClusterConfig {
  /** Public domains configured on the cluster (e.g. ["ci.example.com"]) */
  domains: string[]
  /** IPs of the cluster (fallback when no domain) */
  ips: string[]
  /** Optional reverse-proxy URL fronting the cluster */
  reverseProxyURL?: string
}

export interface GitProviderConfig {
  provider: GitProvider
  accessToken: string
  refreshToken?: string
}

export interface RepoInfo {
  connected: boolean
  type: GitProvider
  url: string
  branch: string
  path: string
  watchPath?: string
  dockerfile: string
  name: string
  repoId?: string
  webHookId?: string | number
  testImage?: string
  testEnabled?: boolean
  testCommand?: string
}

export interface ContainerInfo {
  _id: string
  slug: string
  iid: string
  type: 'deployment' | 'statefulset' | 'cronjob'
  repo: RepoInfo
}

export interface EnvironmentInfo {
  iid: string
}

/** Callback invoked after webhook creation so the caller can persist the ID. */
export type OnWebhookCreated = (containerId: string, webHookId: string | number) => Promise<void>

/** Callback invoked after webhook deletion so the caller can clear the ID. */
export type OnWebhookDeleted = (containerId: string) => Promise<void>

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEKTON_NAMESPACE = process.env.TEKTON_NAMESPACE ?? 'tekton-builds'
const PLATFORM_NAMESPACE = process.env.NAMESPACE ?? 'hanzo-paas'

const TEKTON_TRIGGERS_GROUP = 'triggers.tekton.dev'
const TEKTON_TRIGGERS_VERSION = 'v1beta1'
const TEKTON_GROUP = 'tekton.dev'
const TEKTON_VERSION = 'v1'

function formatKubernetesName(name: string): K8sResourceKind {
  if (name === 'deployment') return 'Deployment'
  if (name === 'statefulset') return 'StatefulSet'
  return 'CronJob'
}

function resolveDefaultTestImage(dockerfile?: string): string {
  if (!dockerfile) return 'node:22-alpine'
  const lower = dockerfile.toLowerCase()
  if (lower.includes('go') || lower.includes('golang')) return 'golang:1.23-alpine'
  if (lower.includes('python')) return 'python:3.12-alpine'
  if (lower.includes('rust')) return 'rust:1.83-alpine'
  return 'node:22-alpine'
}

function loadManifest(provider: GitProvider): any[] {
  const manifestPath = path.join(__dirname, 'manifests', `${provider}-pipeline.yaml`)
  const raw = fs.readFileSync(manifestPath, 'utf8')
  return YAML.parseAllDocuments(raw).map(doc => doc.toJSON())
}

function errMsg(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as any
    return e.response?.body?.message ?? e.response?.data?.message ?? e.message ?? String(err)
  }
  return String(err)
}

// ---------------------------------------------------------------------------
// K8s client helpers -- created once per KubeConfig
// ---------------------------------------------------------------------------

export interface TektonClients {
  kc: k8s.KubeConfig
  core: k8s.CoreV1Api
  auth: k8s.RbacAuthorizationV1Api
  custom: k8s.CustomObjectsApi
  networking: k8s.NetworkingV1Api
}

export function makeTektonClients(kc: k8s.KubeConfig): TektonClients {
  return {
    kc,
    core: kc.makeApiClient(k8s.CoreV1Api),
    auth: kc.makeApiClient(k8s.RbacAuthorizationV1Api),
    custom: kc.makeApiClient(k8s.CustomObjectsApi),
    networking: kc.makeApiClient(k8s.NetworkingV1Api),
  }
}

// ---------------------------------------------------------------------------
// Webhook helpers -- GitHub
// ---------------------------------------------------------------------------

async function createGithubWebhook(
  gitPat: string,
  gitRepoUrl: string,
  webhookUrl: string,
  secretToken: string,
  sslVerification = false,
): Promise<number> {
  const octokit = new Octokit({ auth: gitPat })
  const repoPath = new URL(gitRepoUrl).pathname
  const owner = repoPath.split('/')[1]
  const repo = repoPath.split('/')[2]

  const res = await octokit.request('POST /repos/{owner}/{repo}/hooks', {
    owner,
    repo,
    name: 'web',
    active: true,
    events: ['push'],
    config: {
      url: webhookUrl,
      content_type: 'json',
      secret: secretToken,
      insecure_ssl: sslVerification ? '0' : '1',
    },
    headers: { 'X-GitHub-Api-Version': '2022-11-28' },
  })

  console.info('GitHub repo webhook created')
  return res.data.id
}

async function deleteGithubWebhook(
  gitPat: string,
  gitRepoUrl: string,
  hookId: string | number,
): Promise<void> {
  if (!gitPat || !gitRepoUrl || !hookId) return
  try {
    const octokit = new Octokit({ auth: gitPat })
    const repoPath = new URL(gitRepoUrl).pathname
    await octokit.request('DELETE /repos/{owner}/{repo}/hooks/{hook_id}', {
      owner: repoPath.split('/')[1],
      repo: repoPath.split('/')[2],
      hook_id: Number(hookId),
      headers: { 'X-GitHub-Api-Version': '2022-11-28' },
    })
    console.info('GitHub repo webhook deleted')
  } catch (err) {
    console.error(`Error deleting GitHub repo webhook. ${errMsg(err)}`)
  }
}

// ---------------------------------------------------------------------------
// Webhook helpers -- GitLab
// ---------------------------------------------------------------------------

async function createGitlabWebhook(
  gitPat: string,
  projectId: string,
  webhookUrl: string,
  secretToken: string,
  gitBranch: string,
  sslVerification = false,
): Promise<number> {
  const res = await fetch(`https://gitlab.com/api/v4/projects/${projectId}/hooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gitPat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      push_events: true,
      issues_events: false,
      merge_requests_events: false,
      tag_push_events: false,
      repository_update_events: false,
      enable_ssl_verification: sslVerification,
      token: secretToken,
      push_events_branch_filter: gitBranch,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitLab webhook creation failed (${res.status}): ${body}`)
  }

  const data = await res.json() as { id: number }
  console.info('GitLab project webhook created')
  return data.id
}

async function deleteGitlabWebhook(
  gitPat: string,
  projectId: string,
  hookId: string | number,
): Promise<void> {
  if (!gitPat || !projectId || !hookId) return
  try {
    await fetch(`https://gitlab.com/api/v4/projects/${projectId}/hooks/${hookId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${gitPat}`,
        'Content-Type': 'application/json',
      },
    })
    console.info('GitLab project webhook deleted')
  } catch (err) {
    console.error(`Error deleting GitLab project webhook. ${errMsg(err)}`)
  }
}

// ---------------------------------------------------------------------------
// Webhook helpers -- Bitbucket
// ---------------------------------------------------------------------------

async function createBitbucketWebhook(
  gitPat: string,
  repoName: string,
  webhookUrl: string,
  secretToken: string,
): Promise<string> {
  const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${repoName}/hooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gitPat}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Hanzo Webhook',
      url: webhookUrl,
      active: true,
      secret: secretToken,
      events: ['repo:push'],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Bitbucket webhook creation failed (${res.status}): ${body}`)
  }

  const data = await res.json() as { uuid: string }
  console.info('Bitbucket repository webhook created')
  return data.uuid
}

async function deleteBitbucketWebhook(
  gitPat: string,
  repoName: string,
  hookId: string | number,
): Promise<void> {
  if (!gitPat || !repoName || !hookId) return
  try {
    await fetch(`https://api.bitbucket.org/2.0/repositories/${repoName}/hooks/${hookId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${gitPat}` },
    })
    console.info('Bitbucket repository webhook deleted')
  } catch (err) {
    console.error(`Error deleting Bitbucket repository webhook. ${errMsg(err)}`)
  }
}

// ---------------------------------------------------------------------------
// resolveWebhookUrl -- determine the public URL for the Tekton EventListener
// ---------------------------------------------------------------------------

function resolveWebhookUrl(
  cluster: ClusterConfig,
  pipelineId: string,
): { url: string; ssl: boolean } {
  if (cluster.domains.length > 0) {
    return {
      url: `https://${cluster.domains[0]}/tekton-${pipelineId}`,
      ssl: true,
    }
  }
  if (cluster.reverseProxyURL) {
    const match = cluster.reverseProxyURL.match(/https?:\/\/([^/]+)/)
    if (match) {
      return {
        url: `https://${match[1]}/tekton-${pipelineId}`,
        ssl: false,
      }
    }
  }
  return {
    url: `http://${cluster.ips[0]}/tekton-${pipelineId}`,
    ssl: false,
  }
}

// ---------------------------------------------------------------------------
// createTektonPipeline
// ---------------------------------------------------------------------------

export async function createTektonPipeline(
  clients: TektonClients,
  container: ContainerInfo,
  environment: EnvironmentInfo,
  gitProvider: GitProviderConfig,
  cluster: ClusterConfig,
  onWebhookCreated?: OnWebhookCreated,
): Promise<void> {
  if (!container.repo?.connected || !gitProvider) return

  const { repo } = container
  const namespace = environment.iid
  const gitRepoType = repo.type
  const pipelineId = container.slug
  const gitPat = gitProvider.accessToken
  const gitBranch = repo.branch
  const gitSubPath = repo.path
  const gitWatchPath = repo.watchPath
  const appKind = formatKubernetesName(container.type)
  const appName = container.iid
  const dockerfile = repo.dockerfile
  const containerImageName = container.slug
  const testImage = repo.testImage || resolveDefaultTestImage(dockerfile)
  const testEnabled = repo.testEnabled !== false ? 'true' : 'false'
  const testCommand = repo.testCommand || ''

  const resources = loadManifest(gitRepoType)
  const suffix = `-${pipelineId}`

  let secretToken = ''

  for (const resource of resources) {
    try {
      const { kind } = resource
      const resourceNamespace: string = resource.metadata.namespace ?? TEKTON_NAMESPACE
      resource.metadata.name += suffix

      switch (kind) {
        case 'ServiceAccount':
          await clients.core.createNamespacedServiceAccount({ namespace: resourceNamespace, body: resource })
          break

        case 'Secret':
          secretToken = crypto.randomBytes(20).toString('hex')
          resource.stringData.secretToken = secretToken
          await clients.core.createNamespacedSecret({ namespace: resourceNamespace, body: resource })
          break

        case 'ClusterRoleBinding':
          resource.subjects[0].name += suffix
          await clients.auth.createClusterRoleBinding({ body: resource })
          break

        case 'RoleBinding':
          resource.subjects[0].name += suffix
          await clients.auth.createNamespacedRoleBinding({ namespace: resourceNamespace, body: resource })
          break

        case 'Ingress': {
          resource.spec.rules[0].http.paths[0].path = `/tekton-${pipelineId}(/|$)(.*)`
          resource.spec.rules[0].http.paths[0].backend.service.name += suffix

          if (cluster.domains.length > 0 || cluster.reverseProxyURL) {
            resource.metadata.annotations['kubernetes.io/ingress.class'] = 'nginx'
            resource.spec.tls = cluster.domains.map((host: string) => ({ hosts: [host] }))

            for (const domainName of cluster.domains) {
              resource.spec.rules.unshift({
                host: domainName,
                http: {
                  paths: [{
                    path: `/tekton-${pipelineId}(/|$)(.*)`,
                    pathType: 'ImplementationSpecific',
                    backend: {
                      service: {
                        name: `el-${gitRepoType}-listener-${pipelineId}`,
                        port: { number: 8080 },
                      },
                    },
                  }],
                },
              })
            }
          }

          await clients.networking.createNamespacedIngress({ namespace: resourceNamespace, body: resource })
          break
        }

        case 'EventListener': {
          const trigger = resource.spec.triggers[0]
          trigger.interceptors[0].params[0].value.secretName += suffix

          if (gitProvider.provider === 'bitbucket') {
            trigger.interceptors[1].params[0].value =
              `body.push.changes[0].new.name == '${gitBranch}'`
          } else {
            trigger.interceptors[1].params[0].value =
              `body.ref == 'refs/heads/${gitBranch}'`
          }

          trigger.bindings[0].ref += suffix
          trigger.template.ref += suffix
          resource.spec.resources.kubernetesResource.spec.template.spec.serviceAccountName += suffix

          await clients.custom.createNamespacedCustomObject({
            group: TEKTON_TRIGGERS_GROUP,
            version: TEKTON_TRIGGERS_VERSION,
            namespace: resourceNamespace,
            plural: 'eventlisteners',
            body: resource,
          })
          break
        }

        case 'TriggerBinding': {
          const params = resource.spec.params
          params[0].value = appKind
          params[1].value = appName
          params[2].value = PLATFORM_NAMESPACE
          params[3].value = namespace
          params[4].value = `registry.${PLATFORM_NAMESPACE}:5000`
          params[5].value = gitPat
          params[6].value = gitBranch
          params[7].value = gitSubPath.replace(/^\/+/, '')
          params[8].value = gitWatchPath ?? gitSubPath.replace(/^\/+/, '')
          params[9].value = containerImageName
          params[10].value = dockerfile.replace(/^\/+/, '')
          params[11].value = testImage
          params[12].value = testEnabled
          params[13].value = testCommand

          await clients.custom.createNamespacedCustomObject({
            group: TEKTON_TRIGGERS_GROUP,
            version: TEKTON_TRIGGERS_VERSION,
            namespace: resourceNamespace,
            plural: 'triggerbindings',
            body: resource,
          })
          break
        }

        case 'TriggerTemplate': {
          resource.spec.resourcetemplates[0].spec.serviceAccountName += suffix

          await clients.custom.createNamespacedCustomObject({
            group: TEKTON_TRIGGERS_GROUP,
            version: TEKTON_TRIGGERS_VERSION,
            namespace: resourceNamespace,
            plural: 'triggertemplates',
            body: resource,
          })
          break
        }

        default:
          console.info(`Skipping unknown kind: ${kind}`)
      }

      console.info(`${kind} ${resource.metadata.name} created`)
    } catch (err) {
      console.error(
        `Error creating Tekton resource ${resource.kind} ${resource.metadata.name}: ${errMsg(err)}`,
      )
      throw err
    }
  }

  // Register git-provider webhook
  const { url: webhookUrl, ssl: sslVerification } = resolveWebhookUrl(cluster, pipelineId)

  let webHookId: string | number | null = null

  switch (gitRepoType) {
    case 'github':
      webHookId = await createGithubWebhook(gitPat, repo.url, webhookUrl, secretToken, sslVerification)
      break
    case 'gitlab':
      webHookId = await createGitlabWebhook(
        gitPat, repo.repoId!, webhookUrl, secretToken, gitBranch, sslVerification,
      )
      break
    case 'bitbucket':
      webHookId = await createBitbucketWebhook(gitPat, repo.name, webhookUrl, secretToken)
      break
    default:
      throw new Error(`Unknown repo type: ${gitRepoType}`)
  }

  if (webHookId && onWebhookCreated) {
    await onWebhookCreated(container._id, webHookId)
  }
}

// ---------------------------------------------------------------------------
// deleteTektonPipeline
// ---------------------------------------------------------------------------

export async function deleteTektonPipeline(
  clients: TektonClients,
  container: ContainerInfo,
  gitProvider: GitProviderConfig,
  onWebhookDeleted?: OnWebhookDeleted,
): Promise<void> {
  if (!container.repo?.connected || !gitProvider) return

  const { repo } = container
  const gitRepoType = repo.type
  const pipelineId = container.slug
  const hookId = repo.webHookId
  const gitPat = gitProvider.accessToken
  const resources = loadManifest(gitRepoType)
  const suffix = `-${pipelineId}`

  for (const resource of resources) {
    try {
      const { kind } = resource
      const resourceNamespace: string = resource.metadata.namespace ?? TEKTON_NAMESPACE
      resource.metadata.name += suffix
      const name = resource.metadata.name

      switch (kind) {
        case 'ServiceAccount':
          await clients.core.deleteNamespacedServiceAccount({ name, namespace: resourceNamespace })
          break
        case 'Secret':
          await clients.core.deleteNamespacedSecret({ name, namespace: resourceNamespace })
          break
        case 'ClusterRoleBinding':
          await clients.auth.deleteClusterRoleBinding({ name })
          break
        case 'RoleBinding':
          await clients.auth.deleteNamespacedRoleBinding({ name, namespace: resourceNamespace })
          break
        case 'Ingress':
          await clients.networking.deleteNamespacedIngress({ name, namespace: resourceNamespace })
          break
        case 'EventListener':
          await clients.custom.deleteNamespacedCustomObject({
            group: TEKTON_TRIGGERS_GROUP,
            version: TEKTON_TRIGGERS_VERSION,
            namespace: resourceNamespace,
            plural: 'eventlisteners',
            name,
          })
          break
        case 'TriggerBinding':
          await clients.custom.deleteNamespacedCustomObject({
            group: TEKTON_TRIGGERS_GROUP,
            version: TEKTON_TRIGGERS_VERSION,
            namespace: resourceNamespace,
            plural: 'triggerbindings',
            name,
          })
          break
        case 'TriggerTemplate':
          await clients.custom.deleteNamespacedCustomObject({
            group: TEKTON_TRIGGERS_GROUP,
            version: TEKTON_TRIGGERS_VERSION,
            namespace: resourceNamespace,
            plural: 'triggertemplates',
            name,
          })
          break
        default:
          console.info(`Skipping unknown kind: ${kind}`)
      }
      console.info(`${kind} ${name} deleted`)
    } catch (err) {
      console.error(
        `Error deleting Tekton resource ${resource.kind} ${resource.metadata.name}: ${errMsg(err)}`,
      )
    }
  }

  // Delete git-provider webhook
  switch (gitRepoType) {
    case 'github':
      await deleteGithubWebhook(gitPat, repo.url, hookId!)
      break
    case 'gitlab':
      await deleteGitlabWebhook(gitPat, repo.repoId!, hookId!)
      break
    case 'bitbucket':
      await deleteBitbucketWebhook(gitPat, repo.name, hookId!)
      break
    default:
      throw new Error(`Unknown repo type: ${gitRepoType}`)
  }

  if (onWebhookDeleted) {
    await onWebhookDeleted(container._id)
  }
}

// ---------------------------------------------------------------------------
// triggerTektonPipeline -- manual trigger (no webhook push)
// ---------------------------------------------------------------------------

export async function triggerTektonPipeline(
  clients: TektonClients,
  container: ContainerInfo,
  environment: EnvironmentInfo,
  gitProvider: GitProviderConfig,
): Promise<string> {
  if (!container.repo?.connected || !gitProvider) {
    throw new Error('Repository not connected or git provider missing')
  }

  const { repo } = container
  const namespace = environment.iid
  const gitRepoType = repo.type
  const pipelineId = container.slug
  const gitRepoUrl = repo.url
  const gitPat = gitProvider.accessToken
  const gitBranch = repo.branch
  const gitSubPath = repo.path
  const gitWatchPath = repo.watchPath
  const appKind = formatKubernetesName(container.type)
  const appName = container.iid
  const dockerfile = repo.dockerfile
  const containerImageName = container.slug
  const testImage = repo.testImage || resolveDefaultTestImage(dockerfile)
  const testEnabled = repo.testEnabled !== false ? 'true' : 'false'
  const testCommand = repo.testCommand || ''

  const resources = loadManifest(gitRepoType)
  const suffix = `-${pipelineId}`

  let taskrunParams: any[] = []
  let taskrunSpec: any = null

  for (const resource of resources) {
    resource.metadata.name += suffix
    switch (resource.kind) {
      case 'TriggerBinding':
        taskrunParams = resource.spec.params
        break
      case 'TriggerTemplate':
        resource.spec.resourcetemplates[0].spec.serviceAccountName += suffix
        taskrunSpec = resource.spec.resourcetemplates[0].spec
        break
    }
  }

  if (!taskrunSpec) throw new Error('TriggerTemplate not found in manifest')

  // Replace tt.params references with params in the spec
  const specString = JSON.stringify(taskrunSpec).replace(/tt\.params/g, 'params')
  const populatedSpec = JSON.parse(specString)

  const repoPath = new URL(gitRepoUrl).pathname
  const uniqueInput = `${new Date().toISOString()}${Math.random()}`
  const generatedCommitId = crypto.createHash('sha1').update(uniqueInput).digest('hex')

  // Static params (indices 0-13)
  taskrunParams[0].value = appKind
  taskrunParams[1].value = appName
  taskrunParams[2].value = PLATFORM_NAMESPACE
  taskrunParams[3].value = namespace
  taskrunParams[4].value = `registry.${PLATFORM_NAMESPACE}:5000`
  taskrunParams[5].value = gitPat
  taskrunParams[6].value = gitBranch
  taskrunParams[7].value = gitSubPath.replace(/^\/+/, '')
  taskrunParams[8].value = gitWatchPath ?? gitSubPath.replace(/^\/+/, '')
  taskrunParams[9].value = containerImageName
  taskrunParams[10].value = dockerfile.replace(/^\/+/, '')
  taskrunParams[11].value = testImage
  taskrunParams[12].value = testEnabled
  taskrunParams[13].value = testCommand

  // Webhook-populated params (indices 14+)
  taskrunParams[14].value = generatedCommitId
  taskrunParams[15].value = gitRepoUrl
  taskrunParams[16].value = 'hanzo-paas'
  taskrunParams[17].value = `${gitRepoUrl}/commit/${generatedCommitId}`
  taskrunParams[18].value = gitRepoUrl
  taskrunParams[19].value = repoPath.split('/')[2]
  taskrunParams[20].value = 'Manual TaskRun trigger'
  taskrunParams[21].value = new Date().toISOString()

  // GitLab has extra gitlabprojectid param
  if (gitRepoType === 'gitlab' && taskrunParams.length > 22) {
    taskrunParams[22].value = repo.repoId || ''
  }

  populatedSpec.params = taskrunParams

  // Update setup step env vars for manual run context
  const setupStepIndex = populatedSpec.taskSpec.steps.findIndex(
    (step: any) => step.name === 'setup',
  )
  if (setupStepIndex >= 0) {
    const envVars: any[] = populatedSpec.taskSpec.steps[setupStepIndex].env || []
    populatedSpec.taskSpec.steps[setupStepIndex].env = envVars.map((envVar: any) => {
      switch (envVar.name) {
        case 'GIT_REPO': envVar.value = repo.name; break
        case 'GIT_BRANCH': envVar.value = taskrunParams[6].value; break
        case 'GIT_REVISION': envVar.value = 'N/A'; break
        case 'GIT_COMMITTER_USERNAME': envVar.value = 'N/A'; break
        case 'SUB_PATH': envVar.value = taskrunParams[7].value; break
        case 'GIT_COMMIT_URL': envVar.value = 'N/A'; break
        case 'GIT_REPO_URL': envVar.value = taskrunParams[14].value; break
        case 'GIT_REPO_NAME': envVar.value = repo.name; break
        case 'GIT_COMMIT_MESSAGE': envVar.value = taskrunParams[19].value; break
        case 'GIT_COMMIT_TIMESTAMP': envVar.value = taskrunParams[20].value; break
      }
      return envVar
    })
  }

  const taskrunResource = {
    apiVersion: 'tekton.dev/v1',
    kind: 'TaskRun',
    metadata: {
      generateName: `${pipelineId}-manual-run-`,
      labels: {
        'triggers.tekton.dev/eventlistener': `${gitRepoType}-listener-${pipelineId}`,
      },
    },
    spec: populatedSpec,
  }

  const result = await clients.custom.createNamespacedCustomObject({
    group: TEKTON_GROUP,
    version: TEKTON_VERSION,
    namespace: TEKTON_NAMESPACE,
    plural: 'taskruns',
    body: taskrunResource,
  }) as any

  const taskRunName: string = result.metadata?.name ?? result.body?.metadata?.name ?? 'unknown'
  console.info(`Manual TaskRun created: ${taskRunName}`)
  return taskRunName
}

// ---------------------------------------------------------------------------
// rerunTektonPipeline -- rerun a previously failed TaskRun
// ---------------------------------------------------------------------------

export async function rerunTektonPipeline(
  clients: TektonClients,
  taskRunName: string,
): Promise<string> {
  const taskRunResource = await clients.custom.getNamespacedCustomObject({
    group: TEKTON_GROUP,
    version: TEKTON_VERSION,
    namespace: TEKTON_NAMESPACE,
    plural: 'taskruns',
    name: taskRunName,
  }) as any

  const body = taskRunResource.body ?? taskRunResource
  body.metadata.generateName = `${body.metadata.name}-rerun-`
  delete body.metadata.name
  delete body.metadata.resourceVersion
  delete body.metadata.uid
  delete body.metadata.creationTimestamp
  delete body.status
  if (body.spec?.status) delete body.spec.status

  const result = await clients.custom.createNamespacedCustomObject({
    group: TEKTON_GROUP,
    version: TEKTON_VERSION,
    namespace: TEKTON_NAMESPACE,
    plural: 'taskruns',
    body,
  }) as any

  const newName: string = result.metadata?.name ?? result.body?.metadata?.name ?? 'unknown'
  console.info(`Rerun TaskRun created: ${newName}`)
  return newName
}

// ---------------------------------------------------------------------------
// cancelTektonPipeline
// ---------------------------------------------------------------------------

export async function cancelTektonPipeline(
  clients: TektonClients,
  taskRunName: string,
): Promise<void> {
  await clients.custom.patchNamespacedCustomObject({
    group: TEKTON_GROUP,
    version: TEKTON_VERSION,
    namespace: TEKTON_NAMESPACE,
    plural: 'taskruns',
    name: taskRunName,
    body: { spec: { status: 'TaskRunCancelled' } },
  })
  console.info(`TaskRun ${taskRunName} cancelled`)
}

// ---------------------------------------------------------------------------
// getTektonTaskrun
// ---------------------------------------------------------------------------

export interface TaskRunStatus {
  name: string
  status: string // queued | building | succeeded | failed | cancelled | unknown
  startedAt?: string
  finishedAt?: string
  steps?: Array<{
    name: string
    status: string
    exitCode?: number
  }>
}

function parseTaskRunStatus(raw: any): TaskRunStatus {
  const body = raw.body ?? raw
  const metadata = body.metadata ?? {}
  const status = body.status ?? {}
  const conditions = status.conditions ?? []
  const mainCondition = conditions[0] ?? {}

  let buildStatus = 'unknown'
  const reason = (mainCondition.reason ?? '').toLowerCase()
  const condStatus = mainCondition.status

  if (reason === 'running' || reason === 'started') buildStatus = 'building'
  else if (reason === 'succeeded' && condStatus === 'True') buildStatus = 'succeeded'
  else if (reason === 'failed' && condStatus === 'False') buildStatus = 'failed'
  else if (reason === 'taskruncancelled') buildStatus = 'cancelled'
  else if (condStatus === 'Unknown') buildStatus = 'queued'

  const steps = (status.steps ?? []).map((s: any) => ({
    name: s.name,
    status: s.terminated ? (s.terminated.exitCode === 0 ? 'succeeded' : 'failed') : s.running ? 'running' : 'waiting',
    exitCode: s.terminated?.exitCode,
  }))

  return {
    name: metadata.name ?? '',
    status: buildStatus,
    startedAt: status.startTime,
    finishedAt: status.completionTime,
    steps,
  }
}

export async function getTektonTaskrun(
  clients: TektonClients,
  taskRunName: string,
): Promise<TaskRunStatus | null> {
  try {
    const result = await clients.custom.getNamespacedCustomObject({
      group: TEKTON_GROUP,
      version: TEKTON_VERSION,
      namespace: TEKTON_NAMESPACE,
      plural: 'taskruns',
      name: taskRunName,
    })
    return parseTaskRunStatus(result)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// deleteTektonTaskrun
// ---------------------------------------------------------------------------

export async function deleteTektonTaskrun(
  clients: TektonClients,
  taskRunName: string,
): Promise<void> {
  await clients.custom.deleteNamespacedCustomObject({
    group: TEKTON_GROUP,
    version: TEKTON_VERSION,
    namespace: TEKTON_NAMESPACE,
    plural: 'taskruns',
    name: taskRunName,
  })
  console.info(`TaskRun ${taskRunName} deleted`)
}

// ---------------------------------------------------------------------------
// updateTriggerTemplateAccessTokens
// ---------------------------------------------------------------------------

export async function updateTriggerBindingAccessTokens(
  clients: TektonClients,
  containers: ContainerInfo[],
  provider: GitProvider,
  accessToken: string,
): Promise<void> {
  if (!containers || containers.length === 0) return

  const patParamName = `${provider}pat`

  for (const container of containers) {
    try {
      const bindingName = `${provider}-push-binding-${container.slug}`
      const result = await clients.custom.getNamespacedCustomObject({
        group: TEKTON_TRIGGERS_GROUP,
        version: TEKTON_TRIGGERS_VERSION,
        namespace: TEKTON_NAMESPACE,
        plural: 'triggerbindings',
        name: bindingName,
      }) as any

      const body = result.body ?? result
      body.spec.params = body.spec.params.map((param: any) => {
        if (param.name === patParamName) {
          param.value = accessToken
        }
        return param
      })

      await clients.custom.replaceNamespacedCustomObject({
        group: TEKTON_TRIGGERS_GROUP,
        version: TEKTON_TRIGGERS_VERSION,
        namespace: TEKTON_NAMESPACE,
        plural: 'triggerbindings',
        name: body.metadata.name,
        body,
      })

      console.info(`Updated access token for trigger binding: ${body.metadata.name}`)
    } catch (err) {
      console.error(
        `Error updating trigger binding for ${container.slug}: ${errMsg(err)}`,
      )
    }
  }
}
