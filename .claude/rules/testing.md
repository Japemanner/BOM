# Testregels — BOM Platform

## Playwright E2E

- Tests staan in `e2e/` — per pagina een eigen spec-bestand
- Auth bypass via `SKIP_AUTH_REDIRECT=true` (geconfigureerd in `playwright.config.ts`)
- Gebruik `getByText()` voor shadcn `CardTitle` (rendert als `<div>`, niet als heading)
- Gebruik `locator('xpath=../..')` voor DOM-traversal omhoog — geen CSS `..`
- Formuliervelden zonder `htmlFor`: gebruik `input[type="password"]` of `input[placeholder="..."]`

## Vuistregels

- Test gedrag, niet implementatie
- Geen tests die afhankelijk zijn van demo/seed-data die verwijderd kan worden
- Bij modal-tests: sluit altijd af met een sluit-verificatie
