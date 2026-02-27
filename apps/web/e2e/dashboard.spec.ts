import { test, expect } from '@playwright/test'

// These tests require an authenticated session.
// In CI, set up a test user session cookie or use the NEXTAUTH_URL mock.
test.describe('Dashboard (authenticated)', () => {
  // Skip if no test session available
  test.skip(
    !process.env.TEST_SESSION_TOKEN,
    'Requires TEST_SESSION_TOKEN env var for authenticated tests',
  )

  test.beforeEach(async ({ page }) => {
    // Set session cookie for authenticated access
    const token = process.env.TEST_SESSION_TOKEN!
    await page.context().addCookies([
      {
        name: 'authjs.session-token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ])
  })

  test('sidebar navigation renders', async ({ page }) => {
    await page.goto('/orgs')
    await expect(page.getByText('Organizations')).toBeVisible()
    await expect(page.getByText('Fleet')).toBeVisible()
    await expect(page.getByText('Virtual Machines')).toBeVisible()
    await expect(page.getByText('Registries')).toBeVisible()
    await expect(page.getByText('Settings')).toBeVisible()
  })

  test('organizations page loads', async ({ page }) => {
    await page.goto('/orgs')
    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible()
  })

  test('fleet page loads', async ({ page }) => {
    await page.goto('/clusters')
    await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible()
  })

  test('VMs page loads', async ({ page }) => {
    await page.goto('/vms')
    await expect(page.getByRole('heading', { name: 'Virtual Machines' })).toBeVisible()
  })

  test('sidebar collapse works', async ({ page }) => {
    await page.goto('/orgs')
    const collapseBtn = page.getByText('Collapse')
    await collapseBtn.click()

    // Sidebar should be collapsed — text labels hidden
    await expect(page.getByText('Organizations')).not.toBeVisible()
  })

  test('user dropdown opens', async ({ page }) => {
    await page.goto('/orgs')
    // Click the user avatar/button area
    const userBtn = page.locator('[data-testid="user-menu"]').or(
      page.locator('button').filter({ has: page.locator('.h-7.w-7') }).first()
    )
    if (await userBtn.isVisible()) {
      await userBtn.click()
      await expect(page.getByText('Sign out')).toBeVisible()
    }
  })

  test('breadcrumbs render correctly', async ({ page }) => {
    await page.goto('/clusters')
    await expect(page.getByText('Clusters')).toBeVisible()
  })
})
