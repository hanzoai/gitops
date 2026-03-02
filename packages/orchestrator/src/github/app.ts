import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/core'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Env vars (from KMS)
const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? ''
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY ?? ''
const GITHUB_APP_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET ?? ''

/**
 * Get an authenticated Octokit instance for a GitHub App installation.
 * Uses @octokit/auth-app for automatic token rotation.
 */
export function getInstallationOctokit(installationId: number): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_APP_PRIVATE_KEY,
      installationId,
    },
  })
}

/**
 * Get a short-lived installation access token.
 * Tokens last ~1 hour and are auto-refreshed by @octokit/auth-app.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const auth = createAppAuth({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_APP_PRIVATE_KEY,
    installationId,
  })
  const { token } = await auth({ type: 'installation' })
  return token
}

/**
 * Get an Octokit instance authenticated as the GitHub App itself (not an installation).
 * Used for: listing installations, verifying app identity.
 */
export function getAppOctokit(): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_APP_PRIVATE_KEY,
    },
  })
}

/**
 * Verify a GitHub webhook signature (X-Hub-Signature-256).
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!GITHUB_APP_WEBHOOK_SECRET) return false
  const expected = 'sha256=' + createHmac('sha256', GITHUB_APP_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')
  if (signature.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
