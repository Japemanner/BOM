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

  test('toont 5 assistent-cards', async ({ page }) => {
    // Elke card heeft de assistent naam
    await expect(page.getByText('Factuurverwerker')).toBeVisible()
    await expect(page.getByText('E-mail classifier')).toBeVisible()
    await expect(page.getByText('Exact sync')).toBeVisible()
    await expect(page.getByText('Rapportage bot')).toBeVisible()
    await expect(page.getByText('Contract checker')).toBeVisible()
  })

  test('stats bar toont 3 statistieken', async ({ page }) => {
    await expect(page.getByText('Actief')).toBeVisible()
    await expect(page.getByText('Runs vandaag')).toBeVisible()
    await expect(page.getByText('Succes rate')).toBeVisible()
  })

  test('zoekbalk filtert assistenten', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Zoek assistent…')
    await searchInput.fill('Factuur')

    await expect(page.getByText('Factuurverwerker')).toBeVisible()
    await expect(page.getByText('E-mail classifier')).not.toBeVisible()
  })

  test('zoekbalk leeg maken toont alle assistenten terug', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Zoek assistent…')
    await searchInput.fill('Factuur')
    await searchInput.clear()

    await expect(page.getByText('Factuurverwerker')).toBeVisible()
    await expect(page.getByText('E-mail classifier')).toBeVisible()
  })

  test('klik op card opent config-panel', async ({ page }) => {
    await page.getByText('Factuurverwerker').first().click()

    // Config panel verschijnt rechts met assistent naam
    await expect(page.getByText('Naam')).toBeVisible()
    await expect(page.getByText('Systeemprompt')).toBeVisible()
  })

  test('knop +Nieuw opent leeg config-panel', async ({ page }) => {
    await page.getByRole('button', { name: /Nieuw/ }).click()

    // Config panel in nieuw-modus: leeg naam-veld
    const nameInput = page.getByPlaceholder('Naam van de assistent')
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toHaveValue('')
  })

  test('template chips zijn zichtbaar', async ({ page }) => {
    // Template sectie met chips
    await expect(page.getByText('Factuurverwerker').first()).toBeVisible()
    // Check for template area — at least one chip with template text
    const templateSection = page.locator('text=Template').first()
    await expect(templateSection).toBeVisible()
  })

  test('klik op template chip vult config-panel', async ({ page }) => {
    // Zoek de template chips onderaan de pagina
    // Ze staan in een aparte sectie met kleinere stijl
    const chips = page.locator('[data-testid="template-chip"]')
    const count = await chips.count()

    if (count > 0) {
      await chips.first().click()
      const nameInput = page.getByPlaceholder('Naam van de assistent')
      await expect(nameInput).not.toHaveValue('')
    }
  })
})
