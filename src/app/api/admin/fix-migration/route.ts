export async function GET() {
  const results: string[] = []

  try {
    const { db } = await import('@/db')
    const { sql } = await import('drizzle-orm')

    // 1. Check of tabel bestaat
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'app' AND table_name = 'assistant_tenants'
      ) as exists
    `)
    const tableExists = tableCheck[0]?.exists ?? false
    results.push(`Table exists: ${tableExists}`)

    if (!tableExists) {
      // Tabel aanmaken
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.assistant_tenants (
          assistant_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL,
          CONSTRAINT assistant_tenants_pk PRIMARY KEY (assistant_id, tenant_id)
        )
      `)
      results.push('Table created')

      // Check of assistants nog tenant_id kolom heeft
      const colCheck = await db.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'assistants' AND column_name = 'tenant_id'
      `)
      results.push(`tenant_id column exists: ${colCheck.length > 0}`)

      if (colCheck.length > 0) {
        // Data migreren
        await db.execute(sql`
          INSERT INTO app.assistant_tenants (assistant_id, tenant_id, created_at)
          SELECT id, tenant_id, created_at FROM app.assistants WHERE tenant_id IS NOT NULL
          ON CONFLICT DO NOTHING
        `)
        const countCheck = await db.execute(sql`SELECT count(*) as count FROM app.assistant_tenants`)
        results.push(`Rows migrated: ${countCheck[0]?.count}`)

        // FKs
        await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_assistant_id_fk FOREIGN KEY (assistant_id) REFERENCES app.assistants(id) ON DELETE CASCADE`)
        await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES iam.tenants(id) ON DELETE CASCADE`)
        results.push('FKs added')

        // Drop oude kolom
        await db.execute(sql`ALTER TABLE app.assistants DROP CONSTRAINT IF EXISTS assistants_tenant_id_tenants_id_fk`)
        await db.execute(sql`ALTER TABLE app.assistants DROP COLUMN IF EXISTS tenant_id`)
        results.push('tenant_id column dropped')
      }
    } else {
      // Tabel bestaat al — check state
      const countRes = await db.execute(sql`SELECT count(*) as count FROM app.assistant_tenants`)
      const rowCount = Number(countRes[0]?.count ?? 0)
      results.push(`Rows in table: ${rowCount}`)

      if (rowCount === 0) {
        const colCheck = await db.execute(sql`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'app' AND table_name = 'assistants' AND column_name = 'tenant_id'
        `)
        if (colCheck.length > 0) {
          await db.execute(sql`
            INSERT INTO app.assistant_tenants (assistant_id, tenant_id, created_at)
            SELECT id, tenant_id, created_at FROM app.assistants WHERE tenant_id IS NOT NULL
            ON CONFLICT DO NOTHING
          `)
          results.push('Data alsnog gemigreerd')
        }
      }

      // FKs check
      const fkRows = await db.execute(sql`
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'app.assistant_tenants'::regclass AND contype = 'f'
      `)
      const fkNames = fkRows.map((r: Record<string, unknown>) => String(r.conname))

      if (!fkNames.includes('assistant_tenants_assistant_id_fk')) {
        await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_assistant_id_fk FOREIGN KEY (assistant_id) REFERENCES app.assistants(id) ON DELETE CASCADE`)
        results.push('FK assistant_id bijgewerkt')
      }
      if (!fkNames.includes('assistant_tenants_tenant_id_fk')) {
        await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES iam.tenants(id) ON DELETE CASCADE`)
        results.push('FK tenant_id bijgewerkt')
      }

      // Drop tenant_id indien nog aanwezig
      const colCheck = await db.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'assistants' AND column_name = 'tenant_id'
      `)
      if (colCheck.length > 0) {
        await db.execute(sql`ALTER TABLE app.assistants DROP CONSTRAINT IF EXISTS assistants_tenant_id_tenants_id_fk`)
        await db.execute(sql`ALTER TABLE app.assistants DROP COLUMN IF EXISTS tenant_id`)
        results.push('tenant_id column dropped')
      }
    }

    results.push('=== DONE ===')
    return Response.json({ ok: true, results })
  } catch (e) {
    return Response.json({ ok: false, error: String(e), results }, { status: 500 })
  }
}
