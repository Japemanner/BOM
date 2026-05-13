import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const check = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'assistant_tenants')");
    console.log('Table exists:', check.rows[0].exists);

    if (check.rows[0].exists) {
      console.log('Already exists, nothing to do.');
      return;
    }

    console.log('Creating table...');
    await client.query(`CREATE TABLE app.assistant_tenants (
      assistant_id uuid NOT NULL,
      tenant_id uuid NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      CONSTRAINT assistant_tenants_pk PRIMARY KEY (assistant_id, tenant_id)
    )`);
    console.log('Table created.');

    console.log('Migrating data...');
    await client.query(`INSERT INTO app.assistant_tenants (assistant_id, tenant_id, created_at)
      SELECT id, tenant_id, created_at FROM app.assistants WHERE tenant_id IS NOT NULL`);
    console.log('Data migrated.');

    await client.query(`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_assistant_id_fk
      FOREIGN KEY (assistant_id) REFERENCES app.assistants(id) ON DELETE CASCADE`);
    await client.query(`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_tenant_id_fk
      FOREIGN KEY (tenant_id) REFERENCES iam.tenants(id) ON DELETE CASCADE`);
    console.log('FKs added.');

    const colCheck = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'assistants' AND column_name = 'tenant_id'");
    if (colCheck.rows.length > 0) {
      await client.query("ALTER TABLE app.assistants DROP CONSTRAINT IF EXISTS assistants_tenant_id_tenants_id_fk");
      await client.query("ALTER TABLE app.assistants DROP COLUMN tenant_id");
      console.log('tenant_id column dropped.');
    }

    console.log('Done.');
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(e => { console.error(e); process.exit(1); });
