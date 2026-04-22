import { test, expect } from '@playwright/test'

/**
 * E2E test suite voor de chat flow.
 *
 * Precondities (test database moet zijn ge-seed):
 *   - Een user met een actieve sessie (cookie is gezet via test setup)
 *   - Een tenant gekoppeld aan de user
 *   - Minstens 1 actieve assistent in app.assistants
 *
 * Deze test mocked de `/api/chat` endpoint op browser niveau zodat er
 * geen echte N8N webhook nodig is.
 */

test.describe('Chat flow — bericht versturen en antwoord ontvangen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wacht tot het dashboard gerenderd is (minstens 1 card of lege staat)
    await page.waitForLoadState('networkidle')
  })

  test('ChatWindow opent bij klikken op een AssistantCard', async ({ page }) => {
    const card = page.locator('[data-testid="assistant-card"]').first()

    // Skip als er geen assistenten zijn (leeg dashboard)
    const count = await card.count()
    if (count === 0) {
      test.skip(true, 'Geen assistenten aanwezig — test overgeslagen')
      return
    }

    await card.click()

    // ChatWindow elementen moeten zichtbaar zijn
    await expect(page.getByTestId('chat-input')).toBeVisible()
    await expect(page.getByTestId('chat-send-button')).toBeVisible()
    await expect(page.getByTestId('chat-messages')).toBeVisible()
  })

  test('gebruiker typt bericht en ontvangt mock-antwoord', async ({ page }) => {
    const card = page.locator('[data-testid="assistant-card"]').first()

    const count = await card.count()
    if (count === 0) {
      test.skip(true, 'Geen assistenten aanwezig — test overgeslagen')
      return
    }

    // Mock /api/chat zodat er geen echte N8N call plaatsvindt
    await page.route('/api/chat', async (route) => {
      const request = route.request()
      const postData = request.postDataJSON()

      // Valideer dat de request de verwachte velden bevat
      expect(postData).toHaveProperty('assistantId')
      expect(postData).toHaveProperty('message')
      expect(postData).toHaveProperty('history')

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          text: 'Dit is een geregisseerd E2E-antwoord.',
          runId: 'e2e-run-id',
        }),
      })
    })

    // Open chat
    await card.click()

    // Typ bericht
    const input = page.getByTestId('chat-input')
    await input.fill('Hallo vanuit E2E test')

    // Verstuur
    await page.getByTestId('chat-send-button').click()

    // Typing indicator moet verschijnen
    await expect(page.getByTestId('chat-typing-indicator')).toBeVisible()

    // Antwoord moet zichtbaar worden
    await expect(
      page.getByText('Dit is een geregisseerd E2E-antwoord.')
    ).toBeVisible()

    // Ook het bericht van de gebruiker moet in de lijst staan
    await expect(page.getByText('Hallo vanuit E2E test')).toBeVisible()
  })

  test('fout van API wordt netjes getoond in chat', async ({ page }) => {
    const card = page.locator('[data-testid="assistant-card"]').first()

    const count = await card.count()
    if (count === 0) {
      test.skip(true, 'Geen assistenten aanwezig — test overgeslagen')
      return
    }

    await page.route('/api/chat', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'N8N webhook mislukt: timeout',
        }),
      })
    })

    await card.click()

    await page.getByTestId('chat-input').fill('Trigger een fout')
    await page.getByTestId('chat-send-button').click()

    // De frontend toont een ⚠️ prefix bij errors
    await expect(page.getByText(/⚠️/)).toBeVisible()
  })
})
