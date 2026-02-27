import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const __dirname = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../../'),
  transpilePackages: ['@paas/api', '@paas/db', '@paas/shared', '@hanzo/ui'],
  serverExternalPackages: [
    '@kubernetes/client-node',
    'dockerode',
    'docker-modem',
    'ssh2',
    'cpu-features',
    '@octokit/core',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore native .node binary addons (ssh2, cpu-features) --
      // they are loaded at runtime via serverExternalPackages but
      // webpack still tries to parse them during transpilePackages.
      config.module.rules.unshift({
        test: /\.node$/,
        type: 'asset/resource',
        generator: { emit: false },
      })
    }
    return config
  },
}

export default nextConfig
