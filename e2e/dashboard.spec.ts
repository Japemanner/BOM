import { test, expect } from '@playwright/test'

test.describe('Dashboard — Mijn assistenten', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('toont pagina-titel in topbar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Mijn assistenten' }).or(
      page.locator('text=Mijn assistenten').first()
    )).toBeVisible()
  })

  test('toont lege staat wanneer geen assistenten aanwezig zijn', async ({ page }) => {
    await expect(page.getByText('Nog geen assistenten')).toBeVisible()
  })

  test('stats bar toont 3 statistieken', async ({ page }) => {
    await expect(page.getByText('bespaard vandaag')).toBeVisible()
    await expect(page.getByText('actief').first()).toBeVisible()
    await expect(page.getByText('taken vandaag')).toBeVisible()
  })

  test('zoekbalk is zichtbaar en filtert op lege staat', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Doorzoek assistenten...')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('Factuur')
    await expect(page.getByText('Geen resultaten voor "Factuur"')).toBeVisible()
  })

  test('zoekbalk leegmaken toont lege staat terug', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Doorzoek assistenten...')
    await searchInput.fill('test')
    await searchInput.clear()
    await expect(page.getByText('Nog geen assistenten')).toBeVisible()
  })

  test('config panel toont lege staat', async ({ page }) => {
    // Zonder geselecteerde assistent toont het panel een placeholder
    await expect(page.getByText('Selecteer een assistent')).toBeVisible()
  })

  test('knop +Nieuw opent leeg config-panel', async ({ page }) => {
    await page.getByRole('button', { name: /Nieuw/ }).first().click()

    // Config panel in nieuw-modus: leeg naam-veld
    const nameInput = page.getByPlaceholder('Assistent naam')
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toHaveValue('')
  })

  test('template chips zijn zichtbaar', async ({ page }) => {
    // Template sectie toont chips
    await expect(page.locator('text=Templates').first()).toBeVisible()
    await expect(page.locator('[data-testid="template-chip"]').first()).toBeVisible()
  })

  test('klik op template chip vult config-panel', async ({ page }) => {
    const chips = page.locator('[data-testid="template-chip"]')
    const count = await chips.count()

    if (count > 0) {
      await chips.first().click()
      const nameInput = page.getByPlaceholder('Assistent naam')
      await expect(nameInput).not.toHaveValue('')
    }
  })
})
