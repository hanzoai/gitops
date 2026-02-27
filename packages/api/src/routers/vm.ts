/**
 * tRPC router for VM management via Visor API.
 *
 * Visor is the Hanzo VM management service that supports
 * AWS EC2, DigitalOcean Droplets, and Hetzner Cloud.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, authedProcedure } from '../trpc'

const VISOR_API_URL = process.env.VISOR_API_URL ?? 'http://visor.hanzo.svc.cluster.local:19000'

async function visorFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${VISOR_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new TRPCError({
      code: res.status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
      message: `Visor API error (${res.status}): ${text}`,
    })
  }

  return res.json()
}

const providerSchema = z.enum(['aws', 'digitalocean', 'hetzner'])

export const vmRouter = router({
  // List all VMs for the authenticated user
  list: authedProcedure
    .input(z.object({
      provider: providerSchema.optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const params = new URLSearchParams()
      params.set('userId', ctx.user.id)
      if (input?.provider) params.set('provider', input.provider)

      return visorFetch(`/api/v1/machines?${params}`)
    }),

  // Get a single VM
  get: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return visorFetch(`/api/v1/machines/${input.id}`)
    }),

  // Launch a new VM
  launch: authedProcedure
    .input(z.object({
      provider: providerSchema,
      region: z.string(),
      size: z.string(),
      name: z.string().min(1).max(64),
      image: z.string().optional(),
      sshKeys: z.array(z.string()).optional(),
      userData: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return visorFetch('/api/v1/machines', {
        method: 'POST',
        body: JSON.stringify({
          userId: ctx.user.id,
          ...input,
        }),
      })
    }),

  // Start a stopped VM
  start: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return visorFetch(`/api/v1/machines/${input.id}/start`, {
        method: 'POST',
      })
    }),

  // Stop a running VM
  stop: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return visorFetch(`/api/v1/machines/${input.id}/stop`, {
        method: 'POST',
      })
    }),

  // Destroy a VM
  destroy: authedProcedure
    .input(z.object({
      id: z.string(),
      confirm: z.literal(true, {
        errorMap: () => ({ message: 'Pass confirm: true to destroy. This is irreversible.' }),
      }),
    }))
    .mutation(async ({ input }) => {
      return visorFetch(`/api/v1/machines/${input.id}`, {
        method: 'DELETE',
      })
    }),

  // Reboot a VM
  reboot: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return visorFetch(`/api/v1/machines/${input.id}/reboot`, {
        method: 'POST',
      })
    }),

  // --- Volumes ---

  // List volumes for a VM or all user volumes
  volumes: authedProcedure
    .input(z.object({
      machineId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const params = new URLSearchParams()
      params.set('userId', ctx.user.id)
      if (input?.machineId) params.set('machineId', input.machineId)

      return visorFetch(`/api/v1/volumes?${params}`)
    }),

  // Create a volume
  createVolume: authedProcedure
    .input(z.object({
      provider: providerSchema,
      region: z.string(),
      name: z.string().min(1).max(64),
      sizeGb: z.number().int().min(1).max(16384),
      type: z.enum(['ssd', 'nvme']).default('ssd'),
    }))
    .mutation(async ({ ctx, input }) => {
      return visorFetch('/api/v1/volumes', {
        method: 'POST',
        body: JSON.stringify({
          userId: ctx.user.id,
          ...input,
        }),
      })
    }),

  // Attach a volume to a VM
  attachVolume: authedProcedure
    .input(z.object({
      volumeId: z.string(),
      machineId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return visorFetch(`/api/v1/volumes/${input.volumeId}/attach`, {
        method: 'POST',
        body: JSON.stringify({ machineId: input.machineId }),
      })
    }),

  // Detach a volume
  detachVolume: authedProcedure
    .input(z.object({ volumeId: z.string() }))
    .mutation(async ({ input }) => {
      return visorFetch(`/api/v1/volumes/${input.volumeId}/detach`, {
        method: 'POST',
      })
    }),

  // Delete a volume
  deleteVolume: authedProcedure
    .input(z.object({ volumeId: z.string() }))
    .mutation(async ({ input }) => {
      return visorFetch(`/api/v1/volumes/${input.volumeId}`, {
        method: 'DELETE',
      })
    }),

  // --- Terminal ---

  // Get terminal WebSocket URL for a VM
  terminal: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return visorFetch(`/api/v1/machines/${input.id}/terminal`)
    }),

  // --- Options ---

  // List available regions, sizes, and images per provider
  options: authedProcedure
    .input(z.object({ provider: providerSchema }))
    .query(async ({ input }) => {
      return visorFetch(`/api/v1/options/${input.provider}`)
    }),
})
