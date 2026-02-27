import { test, expect } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

for (const vp of viewports) {
  test.describe(`Dashboard responsive — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('auth page renders without overflow', async ({ page }) => {
      await page.goto('/auth')
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
    })

    test('auth page sign-in button visible', async ({ page }) => {
      await page.goto('/auth')
      await expect(page.getByText('Sign in with Hanzo')).toBeVisible()
    })

    test('screenshot baseline', async ({ page }) => {
      await page.goto('/auth')
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot(`auth-${vp.name}.png`, {
        maxDiffPixelRatio: 0.05,
      })
    })
  })
}
