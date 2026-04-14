import { test, expect } from '@playwright/test'

test.describe('Auth — Login pagina', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('login pagina rendert correct', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Inloggen' })).toBeVisible()
    await expect(page.getByText('BackOffice AI Platform')).toBeVisible()
  })

  test('login formulier bevat e-mail en wachtwoord velden', async ({ page }) => {
    await expect(page.getByLabel('E-mailadres')).toBeVisible()
    await expect(page.getByLabel('Wachtwoord')).toBeVisible()
  })

  test('inloggen-knop is aanwezig', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Inloggen' })).toBeVisible()
  })

  test('link naar registreren is aanwezig', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Registreren' })).toBeVisible()
  })

  test('leeg formulier indienen toont validatiefouten', async ({ page }) => {
    await page.getByRole('button', { name: 'Inloggen' }).click()

    // Zod-validatie via react-hook-form: foutmeldingen verschijnen
    await expect(page.locator('.text-red-600').first()).toBeVisible()
  })

  test('ongeldig e-mailadres toont foutmelding', async ({ page }) => {
    await page.getByLabel('E-mailadres').fill('geen-email')
    await page.getByLabel('Wachtwoord').fill('wachtwoord123')
    await page.getByRole('button', { name: 'Inloggen' }).click()

    await expect(page.locator('.text-red-600').first()).toBeVisible()
  })

  test('klik op Registreren navigeert naar register pagina', async ({ page }) => {
    await page.getByRole('link', { name: 'Registreren' }).click()
    await expect(page).toHaveURL(/\/register/)
  })
})

test.describe('Auth — Register pagina', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
  })

  test('register pagina rendert correct', async ({ page }) => {
    // Registreer-pagina heeft heading "Account aanmaken"
    await expect(
      page.getByRole('heading', { name: /account aanmaken/i })
    ).toBeVisible()
  })

  test('register formulier bevat naam, e-mail en wachtwoord', async ({ page }) => {
    await expect(page.getByLabel(/naam/i)).toBeVisible()
    await expect(page.getByLabel(/e-mail/i)).toBeVisible()
    await expect(page.getByLabel(/wachtwoord/i)).toBeVisible()
  })

  test('link naar inloggen is aanwezig', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: /inloggen/i })
    ).toBeVisible()
  })
})
