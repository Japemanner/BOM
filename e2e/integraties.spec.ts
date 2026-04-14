import { test, expect } from '@playwright/test'

test.describe('Integraties — Telegram en E-mail/SMTP', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/integrations')
  })

  test('pagina laadt zonder fouten', async ({ page }) => {
    // Geen error-boundary getoond
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()
    await expect(page.locator('text=Error')).not.toBeVisible()
  })

  test('toont Telegram integratiekaart', async ({ page }) => {
    await expect(page.getByText('Telegram')).toBeVisible()
  })

  test('toont E-mail / SMTP integratiekaart', async ({ page }) => {
    await expect(page.getByText('E-mail').first()).toBeVisible()
  })

  test('Telegram kaart toont status badge', async ({ page }) => {
    // Kaart heeft een status: "Niet verbonden" of "Verbonden"
    const telegramSection = page.locator('text=Telegram').first()
    await expect(telegramSection).toBeVisible()
  })

  test('klikken op Telegram kaart expandeert formulier', async ({ page }) => {
    // Klik op de header van de Telegram kaart om te expanderen
    await page.getByText('Telegram').first().click()

    // Bot Token veld is een password input
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('Telegram formulier bevat bot token en chat ID velden', async ({ page }) => {
    await page.getByText('Telegram').first().click()

    // Bot Token (password input) en Chat ID (text input met bekende placeholder)
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.locator('input[placeholder="-1001234567890"]')).toBeVisible()
  })

  test('klikken op E-mail kaart expandeert SMTP formulier', async ({ page }) => {
    await page.getByText('E-mail').first().click()

    // SMTP host veld verschijnt met bekende placeholder
    await expect(page.locator('input[placeholder="smtp.resend.com"]')).toBeVisible()
  })

  test('SMTP formulier bevat host, poort en credentials', async ({ page }) => {
    await page.getByText('E-mail').first().click()

    await expect(page.locator('input[placeholder="smtp.resend.com"]')).toBeVisible()
    await expect(page.locator('input[placeholder="587"]')).toBeVisible()
  })

  test('Verbinding testen knop is aanwezig in Telegram formulier', async ({ page }) => {
    await page.getByText('Telegram').first().click()

    await expect(page.getByRole('button', { name: /verbinding testen/i })).toBeVisible()
  })
})
