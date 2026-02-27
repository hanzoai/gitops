/**
 * PaaS v2 — Orchestrator adapter integration tests
 *
 * Tests both K8sOrchestrator (k3d) and DockerOrchestrator (Swarm)
 * against real local backends to verify the IOrchestrator interface.
 *
 * Prerequisites:
 *   docker swarm init
 *   k3d cluster create paas-local --servers 1 --agents 1
 *
 * Run:
 *   npx tsx scripts/test-orchestrators.ts
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOrchestrator } from '../packages/orchestrator/src/index'
import type { IOrchestrator } from '../packages/orchestrator/src/types'
import type { ContainerSpec } from '../packages/shared/src/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KUBECONFIG_PATH = resolve(__dirname, 'kubeconfig-paas-local.yaml')
const TEST_NAMESPACE = 'paas-test'
const TEST_CONTAINER = 'test-nginx'

// ---- Helpers ----

function ok(label: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}`)
}

function fail(label: string, err: unknown) {
  console.log(`  \x1b[31m✗\x1b[0m ${label}: ${err}`)
}

function header(text: string) {
  console.log(`\n\x1b[1m\x1b[36m━━━ ${text} ━━━\x1b[0m`)
}

function subheader(text: string) {
  console.log(`\n\x1b[33m  ▸ ${text}\x1b[0m`)
}

/** Build a minimal ContainerSpec for nginx */
function nginxSpec(namespace: string): ContainerSpec {
  return {
    namespace,
    name: TEST_CONTAINER,
    type: 'deployment',
    image: 'nginx:alpine',
    variables: [{ name: 'NGINX_PORT', value: '80' }],
    networking: { containerPort: 80 },
    podConfig: {
      cpuRequest: 100,
      cpuLimit: 250,
      memoryRequest: 64,
      memoryLimit: 128,
      restartPolicy: 'Always',
    },
    deploymentConfig: {
      replicas: 1,
      strategy: 'RollingUpdate',
    },
  }
}

/** Wait for a container to become ready (poll) */
async function waitForReady(
  orch: IOrchestrator,
  namespace: string,
  name: string,
  timeoutMs = 60_000,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await orch.getContainerStatus(namespace, name, 'deployment')
      if (status.ready) return true
    } catch {
      // not created yet
    }
    await new Promise(r => setTimeout(r, 2_000))
  }
  return false
}

// ---- Test runner for a single orchestrator ----

async function testOrchestrator(label: string, orch: IOrchestrator): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  const pass = (l: string) => { ok(l); passed++ }
  const error = (l: string, e: unknown) => { fail(l, e); failed++ }

  header(label)

  // 1. ping
  subheader('ping()')
  try {
    const alive = await orch.ping()
    if (alive) pass('ping returned true')
    else error('ping returned false', 'expected true')
  } catch (e) { error('ping threw', e) }

  // 2. getClusterInfo
  subheader('getClusterInfo()')
  try {
    const info = await orch.getClusterInfo()
    console.log(`    version:  ${info.version}`)
    console.log(`    platform: ${info.platform}`)
    console.log(`    nodes:    ${info.nodeCount}`)
    console.log(`    cpu:      ${info.totalCpu}m`)
    console.log(`    memory:   ${Math.round(info.totalMemory)}Mi`)
    pass('getClusterInfo returned valid data')
  } catch (e) { error('getClusterInfo', e) }

  // 3. createNamespace
  subheader(`createNamespace("${TEST_NAMESPACE}")`)
  try {
    await orch.createNamespace(TEST_NAMESPACE)
    pass('namespace created')
  } catch (e) { error('createNamespace', e) }

  // 4. listNamespaces (verify it's there)
  subheader('listNamespaces()')
  try {
    const ns = await orch.listNamespaces()
    if (ns.includes(TEST_NAMESPACE)) pass(`"${TEST_NAMESPACE}" found in namespace list`)
    else error('namespace not found', `got: [${ns.join(', ')}]`)
  } catch (e) { error('listNamespaces', e) }

  // 5. createContainer (nginx)
  subheader(`createContainer("${TEST_CONTAINER}")`)
  try {
    const result = await orch.createContainer(nginxSpec(TEST_NAMESPACE))
    console.log(`    name:   ${result.name}`)
    console.log(`    image:  ${result.image}`)
    console.log(`    status: ${result.status}`)
    pass('container created')
  } catch (e) { error('createContainer', e) }

  // 6. Wait for ready
  subheader('waitForReady (polling up to 60s)')
  try {
    const ready = await waitForReady(orch, TEST_NAMESPACE, TEST_CONTAINER)
    if (ready) pass('container is ready')
    else error('container not ready within timeout', 'timed out')
  } catch (e) { error('waitForReady', e) }

  // 7. getContainerStatus
  subheader('getContainerStatus()')
  try {
    const status = await orch.getContainerStatus(TEST_NAMESPACE, TEST_CONTAINER, 'deployment')
    console.log(`    ready:     ${status.ready}`)
    console.log(`    replicas:  ${status.replicas}`)
    console.log(`    pods:      ${status.pods.length}`)
    for (const pod of status.pods) {
      console.log(`      - ${pod.name}  phase=${pod.phase}  ready=${pod.ready}  restarts=${pod.restarts}`)
    }
    pass('status retrieved')
  } catch (e) { error('getContainerStatus', e) }

  // 8. listContainers
  subheader('listContainers()')
  try {
    const list = await orch.listContainers(TEST_NAMESPACE)
    console.log(`    count: ${list.length}`)
    for (const c of list) {
      console.log(`      - ${c.name}  image=${c.image}  status=${c.status}`)
    }
    if (list.length > 0) pass('containers listed')
    else error('no containers found', 'expected >= 1')
  } catch (e) { error('listContainers', e) }

  // 9. Cleanup — delete container
  subheader('cleanup: deleteContainer()')
  try {
    await orch.deleteContainer(TEST_NAMESPACE, TEST_CONTAINER, 'deployment')
    pass('container deleted')
  } catch (e) { error('deleteContainer', e) }

  // 10. Cleanup — delete namespace
  subheader('cleanup: deleteNamespace()')
  try {
    await orch.deleteNamespace(TEST_NAMESPACE)
    pass('namespace deleted')
  } catch (e) { error('deleteNamespace', e) }

  return { passed, failed }
}

// ---- Main ----

async function main() {
  console.log('\x1b[1m\x1b[35m')
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  Hanzo PaaS v2 — Orchestrator Integration Test  ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log('\x1b[0m')

  // --- K8s orchestrator (k3d) ---
  const kubeconfig = readFileSync(KUBECONFIG_PATH, 'utf-8')
  const k8s = createOrchestrator({
    clusterType: 'kubernetes',
    connection: { kind: 'kubernetes', kubeconfig },
  })

  // --- Docker orchestrator (Swarm) ---
  // Colima on macOS uses a non-default socket path
  const dockerSocket = process.env.DOCKER_HOST ?? 'unix:///Users/z/.colima/default/docker.sock'
  const docker = createOrchestrator({
    clusterType: 'docker-swarm',
    connection: { kind: 'docker', host: dockerSocket },
  })

  const k8sResult = await testOrchestrator('Kubernetes (k3d-paas-local)', k8s)
  const dockerResult = await testOrchestrator('Docker Swarm (local)', docker)

  // Summary
  console.log('\n')
  header('Summary')
  const totalPassed = k8sResult.passed + dockerResult.passed
  const totalFailed = k8sResult.failed + dockerResult.failed
  console.log(`  K8s:    ${k8sResult.passed} passed, ${k8sResult.failed} failed`)
  console.log(`  Docker: ${dockerResult.passed} passed, ${dockerResult.failed} failed`)
  console.log(`  Total:  ${totalPassed} passed, ${totalFailed} failed`)

  if (totalFailed > 0) {
    console.log('\n\x1b[31m  SOME TESTS FAILED\x1b[0m\n')
    process.exit(1)
  } else {
    console.log('\n\x1b[32m  ALL TESTS PASSED\x1b[0m\n')
  }
}

main().catch(err => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
