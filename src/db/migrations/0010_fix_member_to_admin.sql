-- Migratie: upgrade bestaande tenant_members met role='member' naar 'admin'
-- Dit fixt de bug waarbij de default role 'member' werd gebruikt
-- en gebruikers daardoor "Geen toestemming" kregen ondanks dat ze admin horen te zijn.

UPDATE iam.tenant_members
SET role = 'admin'
WHERE role = 'member'
  AND user_id IN (
    -- Selecteer de eerste user per tenant (chronologisch)
    SELECT DISTINCT ON (tenant_id) user_id
    FROM iam.tenant_members
    ORDER BY tenant_id, joined_at ASC
  );
