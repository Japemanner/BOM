import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config
 *
 * Lokaal:   PLAYWRIGHT_BASE_URL is niet gezet → start Next.js dev server
 * CI:       PostgreSQL service draait, DATABASE_URL is gezet
 * Productie smoke test: PLAYWRIGHT_BASE_URL=https://jouwdomein.coolify.app
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(process.env.CI ? ([['github']] as const) : []),
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'nl-NL',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Alleen een lokale server starten als we NIET tegen een externe URL testen
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:testpassword@localhost:5432/testdb',
          BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'playwright-test-secret-min-32-chars!!',
          BETTER_AUTH_URL: 'http://localhost:3000',
          NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
          SKIP_AUTH_REDIRECT: 'true',
        },
      },
})
