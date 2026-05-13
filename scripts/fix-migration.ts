import { db } from '@/db'
import { sql } from 'drizzle-orm'

async function checkAndFix() {
  console.log('=== Migratie 0011/0012 check & fix ===')

  // 1. Check data count in assistant_tenants
  const countRes = await db.execute(sql`SELECT count(*) as count FROM app.assistant_tenants`)
  const rowCount = Number(countRes[0]?.count ?? 0)
  console.log('assistant_tenants rows:', rowCount)

  if (rowCount === 0) {
    console.log('Data migreren...')
    await db.execute(sql`
      INSERT INTO app.assistant_tenants (assistant_id, tenant_id, created_at)
      SELECT id, tenant_id, created_at FROM app.assistants WHERE tenant_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `)
    const afterRes = await db.execute(sql`SELECT count(*) as count FROM app.assistant_tenants`)
    console.log('Na migratie assistant_tenants rows:', afterRes[0]?.count)
  }

  // 2. Check FKs
  const fkRows = await db.execute(sql`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'app.assistant_tenants'::regclass AND contype = 'f'
  `)
  console.log('FKs op assistant_tenants:', fkRows.map((r: Record<string, unknown>) => r.conname))

  // Voeg FKs toe als ze ontbreken
  const fkNames = fkRows.map((r: Record<string, unknown>) => String(r.conname))

  if (!fkNames.includes('assistant_tenants_assistant_id_fk')) {
    console.log('FK assistant_id toevoegen...')
    await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_assistant_id_fk FOREIGN KEY (assistant_id) REFERENCES app.assistants(id) ON DELETE CASCADE`)
  }
  if (!fkNames.includes('assistant_tenants_tenant_id_fk')) {
    console.log('FK tenant_id toevoegen...')
    await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES iam.tenants(id) ON DELETE CASCADE`)
  }

  // 3. Drop tenant_id van assistants indien nog aanwezig
  const colCheck = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'app' AND table_name = 'assistants' AND column_name = 'tenant_id'
  `)
  if (colCheck.length > 0) {
    console.log('tenant_id kolom verwijderen...')
    await db.execute(sql`ALTER TABLE app.assistants DROP CONSTRAINT IF EXISTS assistants_tenant_id_tenants_id_fk`)
    await db.execute(sql`ALTER TABLE app.assistants DROP COLUMN IF EXISTS tenant_id`)
    console.log('tenant_id kolom verwijderd')
  } else {
    console.log('tenant_id kolom al verwijderd')
  }

  console.log('=== Done ===')
}

checkAndFix().catch((e) => {
  console.error('Fout:', e)
  process.exit(1)
})
