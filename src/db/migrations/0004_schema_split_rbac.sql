-- src/db/migrations/0004_schema_split_rbac.sql
-- Atomische migratie: verplaats bestaande tabellen naar logische schemas
-- en voeg RBAC-tabellen toe.

--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS auth;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS iam;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS rbac;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app;

-- ─── Auth schema ──────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "public"."users" SET SCHEMA auth;
--> statement-breakpoint
ALTER TABLE "auth"."users" DROP COLUMN IF EXISTS "role";
--> statement-breakpoint
ALTER TABLE "public"."sessions" SET SCHEMA auth;
--> statement-breakpoint
ALTER TABLE "public"."accounts" SET SCHEMA auth;
--> statement-breakpoint
ALTER TABLE "public"."verifications" SET SCHEMA auth;

-- ─── IAM schema ───────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "public"."tenants" SET SCHEMA iam;
--> statement-breakpoint
ALTER TABLE "public"."tenant_users" RENAME TO "tenant_members";
--> statement-breakpoint
ALTER TABLE "public"."tenant_members" SET SCHEMA iam;
--> statement-breakpoint
ALTER TABLE "iam"."tenant_members"
  ADD COLUMN IF NOT EXISTS "joined_at" timestamp NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE "iam"."tenant_members"
  ADD CONSTRAINT "tenant_members_pk" PRIMARY KEY ("tenant_id", "user_id");

-- ─── App schema ───────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "public"."assistants" SET SCHEMA app;
--> statement-breakpoint
ALTER TABLE "public"."assistant_runs" SET SCHEMA app;
--> statement-breakpoint
ALTER TABLE "public"."assistant_events" SET SCHEMA app;
--> statement-breakpoint
ALTER TABLE "public"."review_items" SET SCHEMA app;
--> statement-breakpoint
ALTER TABLE "public"."integrations" SET SCHEMA app;

-- ─── RBAC schema: tabellen aanmaken ───────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "rbac"."roles" (
  "id"          text PRIMARY KEY,
  "description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac"."permissions" (
  "id"          text PRIMARY KEY,
  "resource"    text NOT NULL,
  "action"      text NOT NULL,
  "description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac"."role_permissions" (
  "role_id"       text NOT NULL REFERENCES "rbac"."roles"("id") ON DELETE CASCADE,
  "permission_id" text NOT NULL REFERENCES "rbac"."permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("role_id", "permission_id")
);

-- ─── FK voor tenant_members.role ──────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "iam"."tenant_members"
  ADD CONSTRAINT "tenant_members_role_fk"
  FOREIGN KEY ("role") REFERENCES "rbac"."roles"("id");

-- ─── RBAC seed-data ───────────────────────────────────────────────────────────
--> statement-breakpoint
INSERT INTO "rbac"."roles" ("id", "description") VALUES
  ('admin',  'Volledige toegang tot alle functies'),
  ('member', 'Alleen-lezen toegang tot assistenten, integraties en tenant-info');

--> statement-breakpoint
INSERT INTO "rbac"."permissions" ("id", "resource", "action", "description") VALUES
  ('assistants.create',         'assistants',   'create',              'Assistent aanmaken'),
  ('assistants.read',           'assistants',   'read',                'Assistenten bekijken'),
  ('assistants.update',         'assistants',   'update',              'Assistent bewerken'),
  ('assistants.delete',         'assistants',   'delete',              'Assistent verwijderen'),
  ('assistants.toggle_status',  'assistants',   'toggle_status',       'Assistent activeren of pauzeren'),
  ('integrations.read',         'integrations', 'read',                'Integraties bekijken'),
  ('integrations.create',       'integrations', 'create',              'Integratie aanmaken'),
  ('integrations.update',       'integrations', 'update',              'Integratie bewerken'),
  ('integrations.delete',       'integrations', 'delete',              'Integratie verwijderen'),
  ('tenant.read',               'tenant',       'read',                'Tenant-info bekijken'),
  ('tenant.update_plan',        'tenant',       'update_plan',         'Abonnement wijzigen'),
  ('tenant.delete',             'tenant',       'delete',              'Tenant verwijderen'),
  ('tenant.invite_user',        'tenant',       'invite_user',         'Gebruiker uitnodigen'),
  ('tenant.remove_user',        'tenant',       'remove_user',         'Gebruiker verwijderen'),
  ('tenant.update_member_role', 'tenant',       'update_member_role',  'Rol van lid wijzigen');

--> statement-breakpoint
INSERT INTO "rbac"."role_permissions" ("role_id", "permission_id")
SELECT 'admin', "id" FROM "rbac"."permissions";

--> statement-breakpoint
INSERT INTO "rbac"."role_permissions" ("role_id", "permission_id") VALUES
  ('member', 'assistants.read'),
  ('member', 'integrations.read'),
  ('member', 'tenant.read');
