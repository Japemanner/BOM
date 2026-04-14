import { test, expect } from '@playwright/test'

test.describe('Analytics pagina', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics')
  })

  test('pagina laadt zonder fouten', async ({ page }) => {
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()
  })

  test('toont topbar met titel Analyse', async ({ page }) => {
    await expect(page.locator('text=Analyse').first()).toBeVisible()
  })

  test('toont periode dropdown met 7 dagen als standaard', async ({ page }) => {
    const dropdown = page.getByRole('combobox')
    await expect(dropdown).toHaveValue('7')
  })

  test('toont de drie stat-blokjes', async ({ page }) => {
    await expect(page.getByText('Totaal events')).toBeVisible()
    await expect(page.getByText('Meest actief')).toBeVisible()
    await expect(page.getByText('Actief vandaag')).toBeVisible()
  })

  test('toont recente events sectie', async ({ page }) => {
    await expect(page.getByText('Recente events')).toBeVisible()
  })

  test('periode dropdown wijzigt naar 30 dagen', async ({ page }) => {
    await page.getByRole('combobox').selectOption('30')
    await expect(page.getByRole('combobox')).toHaveValue('30')
  })

  test('sidebar link Analyse navigeert naar /analytics', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Analyse' }).click()
    await expect(page).toHaveURL(/\/analytics/)
  })
})
