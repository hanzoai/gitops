import { test, expect } from '@playwright/test'

test.describe('VM Management (authenticated)', () => {
  test.skip(
    !process.env.TEST_SESSION_TOKEN,
    'Requires TEST_SESSION_TOKEN env var for authenticated tests',
  )

  test.beforeEach(async ({ page }) => {
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

  test('VM list page renders', async ({ page }) => {
    await page.goto('/vms')
    await expect(page.getByRole('heading', { name: 'Virtual Machines' })).toBeVisible()
    await expect(page.getByText('Launch VM')).toBeVisible()
  })

  test('launch wizard opens', async ({ page }) => {
    await page.goto('/vms/launch')
    await expect(page.getByRole('heading', { name: 'Launch Virtual Machine' })).toBeVisible()
    await expect(page.getByText('Choose Provider')).toBeVisible()
  })

  test('launch wizard step 1: select provider', async ({ page }) => {
    await page.goto('/vms/launch')

    // Select DigitalOcean
    await page.getByText('DigitalOcean').click()
    await expect(page.getByText('DigitalOcean')).toBeVisible()

    // Next button should be enabled
    const nextBtn = page.getByRole('button', { name: 'Next' })
    await expect(nextBtn).toBeEnabled()
  })

  test('launch wizard step 2: configure', async ({ page }) => {
    await page.goto('/vms/launch')

    // Select provider
    await page.getByText('DigitalOcean').click()
    await page.getByRole('button', { name: 'Next' }).click()

    // Should show configuration form
    await expect(page.getByText('Configure Instance')).toBeVisible()
    await expect(page.getByText('Name')).toBeVisible()
    await expect(page.getByText('Region')).toBeVisible()
    await expect(page.getByText('Size')).toBeVisible()
  })

  test('launch wizard step 3: review', async ({ page }) => {
    await page.goto('/vms/launch')

    // Step 1
    await page.getByText('DigitalOcean').click()
    await page.getByRole('button', { name: 'Next' }).click()

    // Step 2 — fill form
    await page.getByPlaceholder('my-server').fill('test-vm')

    // Select region
    await page.locator('button').filter({ hasText: 'Select region...' }).click()
    await page.getByText('San Francisco (SFO3)').click()

    // Select size
    await page.locator('button').filter({ hasText: 'Select size...' }).click()
    await page.getByText('Nano').click()

    await page.getByRole('button', { name: 'Next' }).click()

    // Step 3 — review
    await expect(page.getByText('Review & Launch')).toBeVisible()
    await expect(page.getByText('test-vm')).toBeVisible()
    await expect(page.getByText('digitalocean')).toBeVisible()
  })

  test('back to VMs link works', async ({ page }) => {
    await page.goto('/vms/launch')
    await page.getByText('Back to VMs').click()
    await expect(page).toHaveURL(/\/vms$/)
  })
})
