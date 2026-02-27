/**
 * Hanzo PaaS v2 — Seed script for E2E tests
 *
 * Inserts a test user, organization, org membership, project,
 * project membership, environment, and session into PostgreSQL.
 *
 * Usage:
 *   DATABASE_URL=postgresql://paas:password@localhost:5432/paas \
 *     pnpm --filter @paas/db exec tsx ../../scripts/seed.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createId } from '@paralleldrive/cuid2'
import * as schema from '../packages/db/src/schema/index.js'

const {
  users,
  organizations,
  orgMembers,
  projects,
  projectMembers,
  environments,
  sessions,
} = schema

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://paas:password@localhost:5432/paas'

const sql = postgres(DATABASE_URL, { max: 1 })
const db = drizzle(sql)

// ---------------------------------------------------------------------------
// Fixed IDs so E2E tests can reference them deterministically
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'test-user-e2e-000001'
const TEST_USER_IID = 'usr-e2e-test-001'
const TEST_ORG_ID = 'test-org-e2e-000001'
const TEST_ORG_IID = 'org-e2e-test-001'
const TEST_PROJECT_ID = 'test-proj-e2e-000001'
const TEST_PROJECT_IID = 'proj-e2e-test-001'
const TEST_ENV_ID = 'test-env-e2e-000001'
const TEST_ENV_IID = 'env-e2e-test-001'
const TEST_SESSION_TOKEN = 'e2e-session-token-for-testing-only'

async function seed() {
  console.log('Seeding test data...\n')

  // 1. User
  console.log('  Creating test user...')
  await db.insert(users).values({
    id: TEST_USER_ID,
    iid: TEST_USER_IID,
    name: 'E2E Test User',
    email: 'e2e@test.hanzo.ai',
    provider: 'hanzo',
    providerUserId: 'e2e-provider-id',
    isClusterOwner: true,
    canCreateOrg: true,
  }).onConflictDoNothing()

  // 2. Organization
  console.log('  Creating test organization...')
  await db.insert(organizations).values({
    id: TEST_ORG_ID,
    iid: TEST_ORG_IID,
    name: 'E2E Test Org',
    ownerUserId: TEST_USER_ID,
    createdBy: TEST_USER_ID,
  }).onConflictDoNothing()

  // 3. Org membership (Owner)
  console.log('  Creating org membership...')
  await db.insert(orgMembers).values({
    id: `test-orgmem-e2e-${createId().slice(0, 8)}`,
    orgId: TEST_ORG_ID,
    userId: TEST_USER_ID,
    role: 'Owner',
  }).onConflictDoNothing()

  // 4. Project
  console.log('  Creating test project...')
  await db.insert(projects).values({
    id: TEST_PROJECT_ID,
    iid: TEST_PROJECT_IID,
    orgId: TEST_ORG_ID,
    ownerUserId: TEST_USER_ID,
    name: 'E2E Test Project',
    createdBy: TEST_USER_ID,
  }).onConflictDoNothing()

  // 5. Project membership (Admin)
  console.log('  Creating project membership...')
  await db.insert(projectMembers).values({
    id: `test-projmem-e2e-${createId().slice(0, 8)}`,
    projectId: TEST_PROJECT_ID,
    userId: TEST_USER_ID,
    role: 'Admin',
  }).onConflictDoNothing()

  // 6. Environment
  console.log('  Creating test environment...')
  await db.insert(environments).values({
    id: TEST_ENV_ID,
    iid: TEST_ENV_IID,
    orgId: TEST_ORG_ID,
    projectId: TEST_PROJECT_ID,
    name: 'staging',
    createdBy: TEST_USER_ID,
  }).onConflictDoNothing()

  // 7. Session (allows E2E tests to make authenticated requests)
  console.log('  Creating test session...')
  const expires = new Date()
  expires.setDate(expires.getDate() + 30) // 30 days from now
  await db.insert(sessions).values({
    sessionToken: TEST_SESSION_TOKEN,
    userId: TEST_USER_ID,
    expires,
  }).onConflictDoNothing()

  console.log('\nSeed complete.')
  console.log(`\n  User ID:      ${TEST_USER_ID}`)
  console.log(`  Org ID:       ${TEST_ORG_ID}`)
  console.log(`  Project ID:   ${TEST_PROJECT_ID}`)
  console.log(`  Env ID:       ${TEST_ENV_ID}`)
  console.log(`  Session Token: ${TEST_SESSION_TOKEN}`)
  console.log()

  await sql.end()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
