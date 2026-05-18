# Feature Specification: Tenant Aanmaken met Gebruiker

**Feature Branch**: `001-create-tenant-with-user`

**Created**: 2026-05-18

**Status**: Draft

**Input**: User description: "ik wil een tenant toevoegen. Naam tenant: Hans, gebruiker Hans Vernooij, Wachtwoord: SexyJaap. Deze tenant krijgt ook een unieke tenant id"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tenant met admin-gebruiker aanmaken (Priority: P1)

Een super admin wil een nieuwe organisatie-tenant aanmaken met een initiële beheerder. De super admin vult een formulier in met de tenantnaam, slug, abonnementsplan, en de gegevens van de eerste gebruiker (naam, e-mailadres, wachtwoord). Het systeem maakt in één atomische operatie de tenant aan, registreert de gebruiker, en kent de gebruiker de admin-rol toe binnen de nieuwe tenant.

**Why this priority**: Dit is de kernfunctionaliteit — zonder deze stap kan een organisatie überhaupt niet starten met het platform. Momenteel vereist dit handmatig databasewerk.

**Independent Test**: Een super admin kan het formulier invullen en ontvangt een bevestiging met de gegenereerde tenant-ID. De nieuwe gebruiker kan vervolgens inloggen met de opgegeven credentials en ziet de admin-dashboard.

**Acceptance Scenarios**:

1. **Given** een ingelogde super admin bevindt zich op de admin-pagina, **When** deze het "Tenant aanmaken"-formulier invult met geldige gegevens en verzendt, **Then** wordt de tenant aangemaakt met een uniek UUID, wordt de gebruiker geregistreerd met admin-rol, en verschijnt een bevestigingsmelding met de tenant-ID.
2. **Given** de nieuwe tenant en gebruiker zijn aangemaakt, **When** de nieuwe gebruiker inlogt met het opgegeven e-mailadres en wachtwoord, **Then** krijgt de gebruiker toegang tot het dashboard van de nieuwe tenant als beheerder.

---

### User Story 2 - Foutafhandeling bij dubbele gegevens (Priority: P2)

Het systeem voorkomt dat een tenant met een bestaande slug of een gebruiker met een bestaand e-mailadres wordt aangemaakt, en toont duidelijke foutmeldingen.

**Why this priority**: Voorkomt data-corruptie en verwarring, maar blokkeert de happy flow niet.

**Independent Test**: Een super admin probeert een tenant aan te maken met een slug die al bestaat. Het systeem toont direct een foutmelding zonder data te wijzigen.

**Acceptance Scenarios**:

1. **Given** er bestaat al een tenant met slug "hans", **When** een super admin een nieuwe tenant probeert aan te maken met dezelfde slug "hans", **Then** toont het systeem een foutmelding "Deze slug is al in gebruik" en wordt er geen data gewijzigd.
2. **Given** er bestaat al een gebruiker met e-mail "hans.vernooij@gmail.com", **When** een super admin een nieuwe tenant probeert aan te maken met ditzelfde e-mailadres, **Then** toont het systeem een foutmelding "Dit e-mailadres is al in gebruik" en wordt er geen data gewijzigd.

---

### User Story 3 - Validatie van verplichte velden (Priority: P3)

Het formulier valideert alle verplichte velden voordat het verzoek wordt verzonden, zodat de super admin direct ziet wat er mist.

**Why this priority**: Verbetert gebruikservaring maar is geen blokkerende functionaliteit.

**Independent Test**: Een super admin laat verplichte velden leeg en probeert te verzenden. Het systeem markeert de ontbrekende velden zonder een API-aanroep te doen.

**Acceptance Scenarios**:

1. **Given** het formulier is geopend, **When** de super admin probeert te verzenden zonder tenantnaam in te vullen, **Then** wordt het naamveld gemarkeerd als verplicht en wordt het formulier niet verzonden.
2. **Given** het formulier is geopend, **When** de super admin een wachtwoord van minder dan 8 tekens invult, **Then** toont het systeem een validatiefout "Wachtwoord minimaal 8 tekens".

---

### Edge Cases

- Wat gebeurt er als de Better Auth signUpEmail-aanroep faalt nadat de tenant al is aangemaakt? Het systeem voert de operatie uit in een database-transactie: als de gebruiker niet aangemaakt kan worden, wordt de tenant ook teruggedraaid (rollback).
- Wat gebeurt er als een niet-super-admin het API-endpoint probeert aan te roepen? Het endpoint retourneert 403 Forbidden.
- Wat gebeurt er als de slug speciale tekens bevat? De slug wordt gevalideerd op alleen kleine letters, cijfers en koppeltekens.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Systeem MOET een API-endpoint (`POST /api/tenants`) beschikbaar stellen waarmee een geauthenticeerde super admin een nieuwe tenant kan aanmaken.
- **FR-002**: Het endpoint MOET de volgende velden accepteren: tenantnaam (verplicht, minimaal 2 tekens), slug (verplicht, uniek, kleine letters/cijfers/koppeltekens), abonnementsplan (verplicht, uit: free/pro/enterprise), gebruikersnaam (verplicht, minimaal 2 tekens), e-mailadres gebruiker (verplicht, geldig e-mailformaat), wachtwoord gebruiker (verplicht, minimaal 8 tekens).
- **FR-003**: Het endpoint MOET controleren of de aanroepende gebruiker super admin is. Zo niet, retourneer 403 Forbidden.
- **FR-004**: Het endpoint MOET controleren of de opgegeven slug nog niet bestaat. Bij een duplicate slug: retourneer 409 Conflict met melding "Deze slug is al in gebruik".
- **FR-005**: Het endpoint MOET controleren of het opgegeven e-mailadres nog niet bestaat. Bij een bestaand e-mailadres: retourneer 409 Conflict met melding "Dit e-mailadres is al in gebruik".
- **FR-006**: Het endpoint MOET de tenant en gebruiker in één database-transactie aanmaken: eerst de tenant, dan de gebruiker via Better Auth signUpEmail, dan het tenant_member-record met rol "admin". Bij falen in enige stap: volledige rollback.
- **FR-007**: Het endpoint MOET bij succes 201 Created retourneren met `{ tenantId, userId, tenantSlug }`.
- **FR-008**: Systeem MOET een gebruikersinterface beschikbaar stellen in de admin-dashboard (alleen zichtbaar voor super admins) met een formulier voor het aanmaken van een tenant met gebruiker.
- **FR-009**: De gebruikersinterface MOET client-side validatie uitvoeren op alle verplichte velden voordat het verzoek naar de API wordt gestuurd.
- **FR-010**: Het formulier MOET een auto-suggest tonen voor de slug op basis van de ingevulde tenantnaam (kleine letters, spaties vervangen door koppeltekens).

### Key Entities *(include if feature involves data)*

- **Tenant**: Een organisatie binnen het platform. Heeft een unieke ID (UUID), naam, slug (uniek, URL-vriendelijk), abonnementsplan (free/pro/enterprise), en aanmaakdatum.
- **Gebruiker (User)**: Een persoon met toegang tot het platform. Heeft een unieke ID, naam, e-mailadres (uniek), en wachtwoord (gehashed opgeslagen).
- **Lidmaatschap (TenantMember)**: De koppeling tussen een gebruiker en een tenant. Bevat de rol van de gebruiker binnen die tenant (admin bij aanmaak via deze feature).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een super admin kan een nieuwe tenant met admin-gebruiker aanmaken in minder dan 30 seconden (van formulier openen tot bevestiging).
- **SC-002**: Bij een duplicate slug of e-mailadres ontvangt de super admin binnen 2 seconden een duidelijke foutmelding.
- **SC-003**: 100% van de aanmaakpogingen met geldige invoer resulteren in een correct aangemaakte tenant en gebruiker (geen gedeeltelijke aanmaak of data-inconsistentie).
- **SC-004**: De nieuwe gebruiker kan binnen 10 seconden na aanmaak inloggen met de opgegeven credentials.

## Assumptions

- De super admin is al ingelogd en heeft toegang tot het admin-dashboard.
- De `speckit.git.feature` hook heeft een feature branch aangemaakt (001-create-tenant-with-user).
- Better Auth signUpEmail stuurt geen automatische bevestigingsmail die de login blokkeert (het account is direct bruikbaar).
- De RBAC-seed (`seed-rbac.ts`) wordt (her)uitgevoerd na toevoeging van de `tenant.create`-permissie, of de bestaande `onConflictDoNothing`-logica wordt uitgebreid.
- De feature is alleen beschikbaar voor super admins — reguliere admins en members zien deze functionaliteit niet.
