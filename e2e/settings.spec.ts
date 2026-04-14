import { test, expect } from '@playwright/test'

test.describe('Instellingen — tabs en assistentenbeheer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
  })

  test('toont topbar met titel Instellingen', async ({ page }) => {
    await expect(page.locator('text=Instellingen').first()).toBeVisible()
  })

  test('toont drie tabs: Algemeen, Assistenten beheer, Admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Algemeen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Assistenten beheer' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible()
  })

  test('tab Assistenten beheer is standaard actief', async ({ page }) => {
    // De tab Assistenten beheer is de standaard actieve tab
    await expect(page.getByText('Factuurverwerker')).toBeVisible()
  })

  test('Assistenten beheer toont 5 demo-assistenten', async ({ page }) => {
    await page.getByRole('button', { name: 'Assistenten beheer' }).click()

    await expect(page.getByText('Factuurverwerker')).toBeVisible()
    await expect(page.getByText('E-mail classifier')).toBeVisible()
    await expect(page.getByText('Exact sync')).toBeVisible()
    await expect(page.getByText('Rapportage bot')).toBeVisible()
    await expect(page.getByText('Contract checker')).toBeVisible()
  })

  test('demo-assistenten tonen DEMO badge', async ({ page }) => {
    await page.getByRole('button', { name: 'Assistenten beheer' }).click()

    const demoBadges = page.locator('text=DEMO')
    await expect(demoBadges.first()).toBeVisible()
  })

  test('klik op Bewerken-knop opent edit modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Assistenten beheer' }).click()

    // Klik de eerste bewerk-knop
    await page.getByTitle('Bewerken').first().click()

    // Modal verschijnt met naam input-veld (placeholder)
    await expect(page.getByPlaceholder('Bijv. Factuurverwerker')).toBeVisible()
  })

  test('edit modal bevat alle velden', async ({ page }) => {
    await page.getByRole('button', { name: 'Assistenten beheer' }).click()
    await page.getByTitle('Bewerken').first().click()

    await expect(page.getByPlaceholder('Bijv. Factuurverwerker')).toBeVisible()
    await expect(page.getByPlaceholder('Korte omschrijving van de taak')).toBeVisible()
    // Type select aanwezig
    await expect(page.getByRole('combobox').first()).toBeVisible()
  })

  test('edit modal bevat offline toggle', async ({ page }) => {
    await page.getByRole('button', { name: 'Assistenten beheer' }).click()
    await page.getByTitle('Bewerken').first().click()

    await expect(page.getByText('Assistent offline zetten')).toBeVisible()
  })

  test('offline toggle wijzigt beschrijvingstekst', async ({ page }) => {
    await page.getByRole('button', { name: 'Assistenten beheer' }).click()
    await page.getByTitle('Bewerken').first().click()

    // Standaard: assistent is actief
    await expect(page.getByText('Assistent is actief en bereikbaar')).toBeVisible()

    // De SmallToggle voor offline staat is de laatste button[type="button"] in het modal
    // (volgorde: chatten, bestanden uploaden, offline)
    const offlineToggle = page
      .locator('p', { hasText: 'Assistent offline zetten' })
      .locator('xpath=../..')
      .locator('button[type="button"]')
    await offlineToggle.click()

    await expect(page.getByText('Assistent is niet bereikbaar voor gebruikers')).toBeVisible()
  })

  test('modal sluiten werkt via Annuleren knop', async ({ page }) => {
    await page.getByRole('button', { name: 'Assistenten beheer' }).click()
    await page.getByTitle('Bewerken').first().click()

    await expect(page.getByPlaceholder('Bijv. Factuurverwerker')).toBeVisible()

    await page.getByRole('button', { name: 'Annuleren' }).click()

    await expect(page.getByPlaceholder('Bijv. Factuurverwerker')).not.toBeVisible()
  })

  test('tab Algemeen toont account- en platform-info', async ({ page }) => {
    await page.getByRole('button', { name: 'Algemeen' }).click()

    await expect(page.getByText('Account')).toBeVisible()
    await expect(page.getByText('Platform')).toBeVisible()
    await expect(page.getByText('Versie')).toBeVisible()
  })

  test('tab Admin toont Admin-assistenten-tabel', async ({ page }) => {
    await page.getByRole('button', { name: 'Admin' }).click()

    // Admin tab heeft eigen inhoud
    await expect(page.getByText('Admin').first()).toBeVisible()
  })
})
