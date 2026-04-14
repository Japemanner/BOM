import { test, expect } from '@playwright/test'

test.describe('Navigatie — Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    // Dashboard layout is bereikbaar zonder auth in dev (middleware nog open)
    await page.goto('/')
  })

  test('sidebar toont logo en platform naam', async ({ page }) => {
    await expect(page.getByText('AssistHub')).toBeVisible()
    await expect(page.getByText('AI Platform')).toBeVisible()
  })

  test('sidebar bevat alle navigatie-items', async ({ page }) => {
    await expect(page.getByText('Mijn assistenten')).toBeVisible()
    await expect(page.getByText('Templates')).toBeVisible()
    await expect(page.getByText('Gesprekken')).toBeVisible()
    await expect(page.getByText('Analyse')).toBeVisible()
    await expect(page.getByText('Instellingen')).toBeVisible()
    await expect(page.getByText('Integraties')).toBeVisible()
  })

  test('klik op Instellingen navigeert naar /settings', async ({ page }) => {
    await page.getByRole('link', { name: 'Instellingen' }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByText('Instellingen')).toBeVisible()
  })

  test('klik op Integraties navigeert naar /integrations', async ({ page }) => {
    await page.getByRole('link', { name: 'Integraties' }).click()
    await expect(page).toHaveURL(/\/integrations/)
  })

  test('klik op Mijn assistenten navigeert naar dashboard', async ({ page }) => {
    // Navigeer eerst weg
    await page.goto('/settings')
    await page.getByRole('link', { name: 'Mijn assistenten' }).click()
    await expect(page).toHaveURL(/\/$|\/dashboard/)
  })
})
