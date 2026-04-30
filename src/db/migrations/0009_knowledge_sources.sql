-- Migratie: kennisbronnen tabellen
-- Voegt app.knowledge_sources, app.assistant_knowledge_sources toe
-- Wijzigt app.rag_documents: assistant_id nullable, knowledge_source_id toegevoegd

CREATE TABLE "app"."knowledge_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "iam"."tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'empty' NOT NULL,
  "document_count" integer DEFAULT 0 NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "app"."assistant_knowledge_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assistant_id" uuid NOT NULL REFERENCES "app"."assistants"("id") ON DELETE CASCADE,
  "knowledge_source_id" uuid NOT NULL REFERENCES "app"."knowledge_sources"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "app"."rag_documents" ALTER COLUMN "assistant_id" DROP NOT NULL;
ALTER TABLE "app"."rag_documents" ADD COLUMN "knowledge_source_id" uuid REFERENCES "app"."knowledge_sources"("id") ON DELETE CASCADE;
