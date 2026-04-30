# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings.spec.ts >> Instellingen — tabs en assistentenbeheer >> opslaan op demo-assistent toont succes, niet Opslaan mislukt
- Location: e2e\settings.spec.ts:96:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Assistenten beheer' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]: BackOffice AI Platform
  - button "Open Next.js Dev Tools" [ref=e8] [cursor=pointer]:
    - img [ref=e9]
  - generic [ref=e14]:
    - generic [ref=e15]:
      - img [ref=e18]
      - generic [ref=e20]: Inloggen
      - generic [ref=e21]: BackOffice AI Platform
    - generic [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]:
          - generic [ref=e25]: E-mailadres
          - textbox "E-mailadres" [ref=e26]:
            - /placeholder: naam@bedrijf.nl
        - generic [ref=e27]:
          - generic [ref=e28]: Wachtwoord
          - textbox "Wachtwoord" [ref=e29]:
            - /placeholder: Minimaal 8 tekens
        - button "Inloggen" [ref=e30]
      - generic [ref=e31]:
        - text: Nog geen account?
        - link "Registreren" [ref=e32] [cursor=pointer]:
          - /url: /register
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | test.describe('Instellingen — tabs en assistentenbeheer', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/settings')
  6   |   })
  7   | 
  8   |   test('toont topbar met titel Instellingen', async ({ page }) => {
  9   |     await expect(page.locator('text=Instellingen').first()).toBeVisible()
  10  |   })
  11  | 
  12  |   test('toont drie tabs: Algemeen, Assistenten beheer, Admin', async ({ page }) => {
  13  |     await expect(page.getByRole('button', { name: 'Algemeen' })).toBeVisible()
  14  |     await expect(page.getByRole('button', { name: 'Assistenten beheer' })).toBeVisible()
  15  |     await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible()
  16  |   })
  17  | 
  18  |   test('tab Assistenten beheer is standaard actief', async ({ page }) => {
  19  |     // De tab Assistenten beheer is de standaard actieve tab
  20  |     await expect(page.getByText('Factuurverwerker')).toBeVisible()
  21  |   })
  22  | 
  23  |   test('Assistenten beheer toont 5 demo-assistenten', async ({ page }) => {
  24  |     await page.getByRole('button', { name: 'Assistenten beheer' }).click()
  25  | 
  26  |     await expect(page.getByText('Factuurverwerker')).toBeVisible()
  27  |     await expect(page.getByText('E-mail classifier')).toBeVisible()
  28  |     await expect(page.getByText('Exact sync')).toBeVisible()
  29  |     await expect(page.getByText('Rapportage bot')).toBeVisible()
  30  |     await expect(page.getByText('Contract checker')).toBeVisible()
  31  |   })
  32  | 
  33  |   test('demo-assistenten tonen DEMO badge', async ({ page }) => {
  34  |     await page.getByRole('button', { name: 'Assistenten beheer' }).click()
  35  | 
  36  |     const demoBadges = page.locator('text=DEMO')
  37  |     await expect(demoBadges.first()).toBeVisible()
  38  |   })
  39  | 
  40  |   test('klik op Bewerken-knop opent edit modal', async ({ page }) => {
  41  |     await page.getByRole('button', { name: 'Assistenten beheer' }).click()
  42  | 
  43  |     // Klik de eerste bewerk-knop
  44  |     await page.getByTitle('Bewerken').first().click()
  45  | 
  46  |     // Modal verschijnt met naam input-veld (placeholder)
  47  |     await expect(page.getByPlaceholder('Bijv. Factuurverwerker')).toBeVisible()
  48  |   })
  49  | 
  50  |   test('edit modal bevat alle velden', async ({ page }) => {
  51  |     await page.getByRole('button', { name: 'Assistenten beheer' }).click()
  52  |     await page.getByTitle('Bewerken').first().click()
  53  | 
  54  |     await expect(page.getByPlaceholder('Bijv. Factuurverwerker')).toBeVisible()
  55  |     await expect(page.getByPlaceholder('Korte omschrijving van de taak')).toBeVisible()
  56  |     // Type select aanwezig
  57  |     await expect(page.getByRole('combobox').first()).toBeVisible()
  58  |   })
  59  | 
  60  |   test('edit modal bevat offline toggle', async ({ page }) => {
  61  |     await page.getByRole('button', { name: 'Assistenten beheer' }).click()
  62  |     await page.getByTitle('Bewerken').first().click()
  63  | 
  64  |     await expect(page.getByText('Assistent offline zetten')).toBeVisible()
  65  |   })
  66  | 
  67  |   test('offline toggle wijzigt beschrijvingstekst', async ({ page }) => {
  68  |     await page.getByRole('button', { name: 'Assistenten beheer' }).click()
  69  |     await page.getByTitle('Bewerken').first().click()
  70  | 
  71  |     // Standaard: assistent is actief
  72  |     await expect(page.getByText('Assistent is actief en bereikbaar')).toBeVisible()
  73  | 
  74  |     // De SmallToggle voor offline staat is de laatste button[type="button"] in het modal
  75  |     // (volgorde: chatten, bestanden uploaden, offline)
  76  |     const offlineToggle = page
  77  |       .locator('p', { hasText: 'Assistent offline zetten' })
  78  |       .locator('xpath=../..')
  79  |       .locator('button[type="button"]')
  80  |     await offlineToggle.click()
  81  | 
  82  |     await expect(page.getByText('Assistent is niet bereikbaar voor gebruikers')).toBeVisible()
  83  |   })
  84  | 
  85  |   test('modal sluiten werkt via Annuleren knop', async ({ page }) => {
  86  |     await page.getByRole('button', { name: 'Assistenten beheer' }).click()
  87  |     await page.getByTitle('Bewerken').first().click()
  88  | 
  89  |     await expect(page.getByPlaceholder('Bijv. Factuurverwerker')).toBeVisible()
  90  | 
  91  |     await page.getByRole('button', { name: 'Annuleren' }).click()
  92  | 
  93  |     await expect(page.getByPlaceholder('Bijv. Factuurverwerker')).not.toBeVisible()
  94  |   })
  95  | 
  96  |   test('opslaan op demo-assistent toont succes, niet Opslaan mislukt', async ({ page }) => {
> 97  |     await page.getByRole('button', { name: 'Assistenten beheer' }).click()
      |                                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  98  | 
  99  |     await page.getByTitle('Bewerken').first().click()
  100 |     await expect(page.getByPlaceholder('Bijv. Factuurverwerker')).toBeVisible()
  101 | 
  102 |     await page.getByPlaceholder('Bijv. Factuurverwerker').fill('Gewijzigd')
  103 |     await page.getByRole('button', { name: 'Opslaan' }).click()
  104 | 
  105 |     await expect(page.getByText('Gewijzigd opgeslagen')).toBeVisible({ timeout: 5000 })
  106 |     await expect(page.getByText('Opslaan mislukt')).not.toBeVisible()
  107 |   })
  108 | 
  109 |   test('tab Algemeen toont account- en platform-info', async ({ page }) => {
  110 |     await page.getByRole('button', { name: 'Algemeen' }).click()
  111 | 
  112 |     await expect(page.getByText('Account')).toBeVisible()
  113 |     await expect(page.getByText('Platform')).toBeVisible()
  114 |     await expect(page.getByText('Versie')).toBeVisible()
  115 |   })
  116 | 
  117 |   test('tab Admin toont Admin-assistenten-tabel', async ({ page }) => {
  118 |     await page.getByRole('button', { name: 'Admin' }).click()
  119 | 
  120 |     // Admin tab heeft eigen inhoud
  121 |     await expect(page.getByText('Admin').first()).toBeVisible()
  122 |   })
  123 | })
  124 | 
```