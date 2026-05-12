CREATE TABLE "app"."assistant_tenants" (
  "assistant_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "assistant_tenants_assistant_id_tenant_id_pk" PRIMARY KEY ("assistant_id", "tenant_id")
);--> statement-breakpoint

INSERT INTO "app"."assistant_tenants" ("assistant_id", "tenant_id", "created_at")
SELECT "id", "tenant_id", "created_at"
FROM "app"."assistants"
WHERE "tenant_id" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "app"."assistant_tenants" ADD CONSTRAINT "assistant_tenants_assistant_id_assistants_id_fk"
  FOREIGN KEY ("assistant_id") REFERENCES "app"."assistants" ("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "app"."assistant_tenants" ADD CONSTRAINT "assistant_tenants_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "iam"."tenants" ("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "app"."assistants" DROP CONSTRAINT IF EXISTS "assistants_tenant_id_tenants_id_fk";--> statement-breakpoint

ALTER TABLE "app"."assistants" DROP COLUMN "tenant_id";
