import { NextResponse } from 'next/server'

export async function POST(req: Request): Promise<Response> {
  const body = await req.text()
  const event = req.headers.get('x-github-event') ?? ''
  const signature = req.headers.get('x-hub-signature-256') ?? ''
  const deliveryId = req.headers.get('x-github-delivery') ?? ''

  // 1. Verify webhook signature
  const { verifyWebhookSignature } = await import('@paas/orchestrator/github/app')
  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  // 2. Handle installation events directly (no queue needed)
  if (event === 'installation' || event === 'installation_repositories') {
    const action = payload.action as string
    const installationGhId = String(payload.installation?.id)
    const accountLogin = payload.installation?.account?.login as string

    if (action === 'created' || action === 'new_permissions_accepted') {
      // Auto-register the installation if we can match it to an org
      // The callback tRPC mutation handles the DB insert — this just triggers sync
      console.log(`[webhook] GitHub App installed on ${accountLogin} (${installationGhId})`)
    } else if (action === 'deleted') {
      console.log(`[webhook] GitHub App uninstalled from ${accountLogin} (${installationGhId})`)
      // Mark installation as suspended
      const { db } = await import('@paas/db')
      const { gitInstallations } = await import('@paas/db/schema')
      const { eq } = await import('drizzle-orm')
      await db.update(gitInstallations)
        .set({ suspendedAt: new Date(), updatedAt: new Date() })
        .where(eq(gitInstallations.installationId, installationGhId))
    } else if (action === 'suspend') {
      const { db } = await import('@paas/db')
      const { gitInstallations } = await import('@paas/db/schema')
      const { eq } = await import('drizzle-orm')
      await db.update(gitInstallations)
        .set({ suspendedAt: new Date(), updatedAt: new Date() })
        .where(eq(gitInstallations.installationId, installationGhId))
    } else if (action === 'unsuspend') {
      const { db } = await import('@paas/db')
      const { gitInstallations } = await import('@paas/db/schema')
      const { eq } = await import('drizzle-orm')
      await db.update(gitInstallations)
        .set({ suspendedAt: null, updatedAt: new Date() })
        .where(eq(gitInstallations.installationId, installationGhId))
    }

    // If repos added, trigger sync
    if (action === 'created' || action === 'added') {
      const { db } = await import('@paas/db')
      const { gitInstallations } = await import('@paas/db/schema')
      const { eq } = await import('drizzle-orm')
      const installation = await db.query.gitInstallations.findFirst({
        where: eq(gitInstallations.installationId, installationGhId),
      })
      if (installation) {
        const { syncQueue } = await import('@paas/jobs')
        await syncQueue.add('sync', { installationId: installation.id, fullSync: true })
      }
    }

    return NextResponse.json({ ok: true, event, delivery: deliveryId })
  }

  // 3. For all other events, find the installation and dispatch to webhook queue
  const installationGhId = String(payload.installation?.id ?? '')
  if (!installationGhId) {
    return NextResponse.json({ error: 'No installation ID in payload' }, { status: 400 })
  }

  // Look up our internal installation ID
  const { db } = await import('@paas/db')
  const { gitInstallations } = await import('@paas/db/schema')
  const { eq: eqOp } = await import('drizzle-orm')
  const installation = await db.query.gitInstallations.findFirst({
    where: eqOp(gitInstallations.installationId, installationGhId),
  })

  if (!installation) {
    // Unknown installation — ignore
    return NextResponse.json({ ok: true, skipped: true, reason: 'unknown installation' })
  }

  // 4. Dispatch to webhook queue
  const { webhookQueue } = await import('@paas/jobs')
  await webhookQueue.add(`${event}-${deliveryId}`, {
    event,
    installationId: installation.id,
    payload,
  })

  return NextResponse.json({ ok: true, event, delivery: deliveryId, queued: true })
}

// GitHub sends a GET to verify the webhook URL is reachable
export async function GET(): Promise<Response> {
  return NextResponse.json({ status: 'ok', service: 'hanzo-paas-webhook' })
}
