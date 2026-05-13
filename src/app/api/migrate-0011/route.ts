export async function GET() {
  try {
    const { db, sql } = await import('@/db');
    const { eq } = await import('drizzle-orm');

    const results: string[] = [];

    const check = await db.execute(sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'assistant_tenants')`);
    const exists = check.rows[0].exists;
    results.push(`Table exists: ${exists}`);

    if (!exists) {
      await db.execute(sql`
        CREATE TABLE app.assistant_tenants (
          assistant_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL,
          CONSTRAINT assistant_tenants_pk PRIMARY KEY (assistant_id, tenant_id)
        )
      `);
      results.push('Table created.');

      await db.execute(sql`
        INSERT INTO app.assistant_tenants (assistant_id, tenant_id, created_at)
        SELECT id, tenant_id, created_at FROM app.assistants WHERE tenant_id IS NOT NULL
      `);
      results.push('Data migrated.');

      await db.execute(sql`
        ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_assistant_id_fk
        FOREIGN KEY (assistant_id) REFERENCES app.assistants(id) ON DELETE CASCADE
      `);
      await db.execute(sql`
        ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_tenant_id_fk
        FOREIGN KEY (tenant_id) REFERENCES iam.tenants(id) ON DELETE CASCADE
      `);
      results.push('FKs added.');

      const colCheck = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'assistants' AND column_name = 'tenant_id'`);
      if (colCheck.rows.length > 0) {
        await db.execute(sql`ALTER TABLE app.assistants DROP CONSTRAINT IF EXISTS assistants_tenant_id_tenants_id_fk`);
        await db.execute(sql`ALTER TABLE app.assistants DROP COLUMN tenant_id`);
        results.push('tenant_id column dropped.');
      }
    }

    return Response.json({ ok: true, results }, { status: 200 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
