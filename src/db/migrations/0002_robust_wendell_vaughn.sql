-- FK constraints droppen voor type-wijziging
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_user_id_users_id_fk";
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_user_id_users_id_fk";
ALTER TABLE "tenant_users" DROP CONSTRAINT IF EXISTS "tenant_users_user_id_users_id_fk";
ALTER TABLE "review_items" DROP CONSTRAINT IF EXISTS "review_items_resolved_by_users_id_fk";

-- Kolom types wijzigen naar text
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE text;
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "accounts" ALTER COLUMN "id" SET DATA TYPE text;
ALTER TABLE "accounts" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET DATA TYPE text;
ALTER TABLE "sessions" ALTER COLUMN "id" SET DATA TYPE text;
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "sessions" ALTER COLUMN "user_id" SET DATA TYPE text;
ALTER TABLE "verifications" ALTER COLUMN "id" SET DATA TYPE text;
ALTER TABLE "verifications" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "tenant_users" ALTER COLUMN "user_id" SET DATA TYPE text;
ALTER TABLE "review_items" ALTER COLUMN "resolved_by" SET DATA TYPE text;

-- FK constraints opnieuw toevoegen
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "users"("id");
