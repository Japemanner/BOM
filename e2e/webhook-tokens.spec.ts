import { test, expect } from '@playwright/test'

test.describe('Admin tab — Inbound webhook in assistent modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Admin' }).click()
  })

  test('edit modal toont inbound webhook sectie na klik op Instellingen', async ({ page }) => {
    await page.getByTitle('Instellingen').first().click()
    await expect(page.getByText('Inbound webhook')).toBeVisible()
  })

  test('toont Nieuw inbound token knop in modal', async ({ page }) => {
    await page.getByTitle('Instellingen').first().click()
    await expect(page.getByRole('button', { name: 'Nieuw inbound token' })).toBeVisible()
  })

  test('klik Nieuw inbound token opent naam-invoerveld', async ({ page }) => {
    await page.getByTitle('Instellingen').first().click()
    await page.getByRole('button', { name: 'Nieuw inbound token' }).click()
    await expect(page.getByPlaceholder("Token naam, bijv. 'N8N productie'")).toBeVisible()
  })

  test('sluit naam-invoerveld met X knop', async ({ page }) => {
    await page.getByTitle('Instellingen').first().click()
    await page.getByRole('button', { name: 'Nieuw inbound token' }).click()
    await expect(page.getByPlaceholder("Token naam, bijv. 'N8N productie'")).toBeVisible()
    const createArea = page.locator('input[placeholder="Token naam, bijv. \'N8N productie\'"]').locator('xpath=../..')
    await createArea.locator('button').last().click()
    await expect(page.getByPlaceholder("Token naam, bijv. 'N8N productie'")).not.toBeVisible()
  })
})

test.describe('Admin tab — Edit modal outbound webhook velden', () => {
  test('edit modal toont Webhook URL veld', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByTitle('Instellingen').first().click()
    await expect(page.getByPlaceholder('https://n8n.jouwdomein.nl/webhook/...')).toBeVisible()
  })

  test('edit modal toont Webhook token veld met Bewerken knop', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByTitle('Instellingen').first().click()
    await expect(page.getByRole('button', { name: 'Bewerken' })).toBeVisible()
  })

  test('Bewerken knop maakt webhook token veld bewerkbaar', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByTitle('Instellingen').first().click()
    await page.getByRole('button', { name: 'Bewerken' }).click()
    await expect(page.getByPlaceholder('Nieuw token invoeren')).toBeVisible()
  })

  test('Annuleren verbergt token invoerveld', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByTitle('Instellingen').first().click()
    await page.getByRole('button', { name: 'Bewerken' }).click()
    await page.getByRole('button', { name: 'Annuleren' }).click()
    await expect(page.getByPlaceholder('Nieuw token invoeren')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Bewerken' })).toBeVisible()
  })
})