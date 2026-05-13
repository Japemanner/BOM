export async function GET() {
  const results: string[] = []

  try {
    const { db } = await import('@/db')
    const { sql } = await import('drizzle-orm')

    // 1. Check data
    const countRes = await db.execute(sql`SELECT count(*) as count FROM app.assistant_tenants`)
    const rowCount = Number(countRes[0]?.count ?? 0)
    results.push(`assistant_tenants rows: ${rowCount}`)

    if (rowCount === 0) {
      await db.execute(sql`
        INSERT INTO app.assistant_tenants (assistant_id, tenant_id, created_at)
        SELECT id, tenant_id, created_at FROM app.assistants WHERE tenant_id IS NOT NULL
        ON CONFLICT DO NOTHING
      `)
      const afterRes = await db.execute(sql`SELECT count(*) as count FROM app.assistant_tenants`)
      results.push(`Na migratie: ${afterRes[0]?.count} rows`)
    }

    // 2. FKs
    const fkRows = await db.execute(sql`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'app.assistant_tenants'::regclass AND contype = 'f'
    `)
    const fkNames = fkRows.map((r: Record<string, unknown>) => String(r.conname))
    results.push(`FKs: ${fkNames.join(', ') || 'geen'}`)

    if (!fkNames.includes('assistant_tenants_assistant_id_fk')) {
      await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_assistant_id_fk FOREIGN KEY (assistant_id) REFERENCES app.assistants(id) ON DELETE CASCADE`)
      results.push('FK assistant_id toegevoegd')
    }
    if (!fkNames.includes('assistant_tenants_tenant_id_fk')) {
      await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES iam.tenants(id) ON DELETE CASCADE`)
      results.push('FK tenant_id toegevoegd')
    }

    // 3. Drop tenant_id
    const colCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'assistants' AND column_name = 'tenant_id'
    `)
    if (colCheck.length > 0) {
      await db.execute(sql`ALTER TABLE app.assistants DROP CONSTRAINT IF EXISTS assistants_tenant_id_tenants_id_fk`)
      await db.execute(sql`ALTER TABLE app.assistants DROP COLUMN IF EXISTS tenant_id`)
      results.push('tenant_id kolom verwijderd')
    } else {
      results.push('tenant_id kolom al verwijderd')
    }

    return Response.json({ ok: true, results })
  } catch (e) {
    return Response.json({ ok: false, error: String(e), results }, { status: 500 })
  }
}
