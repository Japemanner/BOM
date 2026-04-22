-- Migratie: assistant_runs uitbreiden met user_id, tenant_id
-- Doel: gesprekshistorie per tenant kunnen opvragen inclusief wie de vraag stelde

ALTER TABLE app.assistant_runs
  ADD COLUMN user_id TEXT REFERENCES auth.users(id),
  ADD COLUMN tenant_id UUID REFERENCES iam.tenants(id);
