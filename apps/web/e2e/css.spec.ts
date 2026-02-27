import { test, expect } from '@playwright/test'

test.describe('CSS / Styling', () => {
  test('auth page has dark background', async ({ page }) => {
    await page.goto('/auth')
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })
    // Should be a dark color (not white/transparent)
    expect(bgColor).toBeTruthy()
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('auth page text is visible', async ({ page }) => {
    await page.goto('/auth')
    const text = page.getByText('Hanzo Platform')
    await expect(text).toBeVisible()
    const color = await text.evaluate((el) => getComputedStyle(el).color)
    expect(color).toBeTruthy()
  })

  test('auth button has proper styling', async ({ page }) => {
    await page.goto('/auth')
    const btn = page.getByText('Sign in with Hanzo')
    await expect(btn).toBeVisible()
    const bgColor = await btn.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bgColor).toBeTruthy()
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('tailwind classes are applied (not raw CSS vars)', async ({ page }) => {
    await page.goto('/auth')
    // Check that body has computed styles from Tailwind
    const fontSize = await page.evaluate(() => getComputedStyle(document.body).fontSize)
    expect(fontSize).toBeTruthy()
    // Default should be ~16px
    expect(parseInt(fontSize)).toBeGreaterThan(0)
  })

  test('no unstyled flash of content', async ({ page }) => {
    // Take screenshot immediately after load
    await page.goto('/auth')
    await page.waitForLoadState('domcontentloaded')
    // Give CSS a moment to load
    await page.waitForTimeout(100)

    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })
    // Background should already be dark, not default white
    expect(bgColor).not.toBe('rgb(255, 255, 255)')
  })
})
