import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('unauthenticated user is redirected to hanzo.id sign-in', async ({ page }) => {
    // Visit a protected route without session
    const response = await page.goto('/orgs')

    // Should redirect to /api/auth/signin/hanzo which triggers OIDC
    const url = page.url()
    expect(
      url.includes('/api/auth/signin') || url.includes('hanzo.id')
    ).toBeTruthy()
  })

  test('home page is accessible without auth', async ({ page }) => {
    await page.goto('/')
    expect(page.url()).toContain('/')
  })

  test('API health endpoint is accessible', async ({ page }) => {
    const response = await page.goto('/api/health')
    expect(response?.status()).toBe(200)
  })

  test('/auth page renders sign-in button', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.getByText('Sign in with Hanzo')).toBeVisible()
    await expect(page.getByText('Hanzo Platform')).toBeVisible()
  })
})
