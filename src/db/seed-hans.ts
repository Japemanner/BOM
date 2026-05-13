// src/db/seed-hans.ts
// Gebruik: npx tsx src/db/seed-hans.ts
// Maakt tenant "Hans" aan met admin-gebruiker info@jaaphoeve.com
import { db } from '@/db'
import { tenants, tenantMembers } from '@/db/schema/iam'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

async function seed() {
  const EMAIL = 'info@jaaphoeve.com'
  const SLUG = 'hans'

  const [exists] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, SLUG))
    .limit(1)

  if (exists) {
    console.log(`Tenant "${SLUG}" bestaat al.`)
    process.exit(0)
  }

  console.log(`Gebruiker voor ${EMAIL} aanmaken via Better Auth...`)
  const result = await auth.api.signUpEmail({
    body: { name: 'Hans', email: EMAIL, password: 'JaapSexy' },
    asResponse: false,
  })

  const userId = (result as { user?: { id?: string } } | null)?.user?.id
  if (!userId) throw new Error('Gebruiker aanmaken mislukt')
  console.log(`  ✓ Gebruiker aangemaakt (${userId})`)

  console.log(`Tenant "${SLUG}" aanmaken...`)
  const [tenant] = await db
    .insert(tenants)
    .values({ name: 'Hans', slug: SLUG, plan: 'pro' })
    .returning({ id: tenants.id, slug: tenants.slug, name: tenants.name })

  if (!tenant) throw new Error('Tenant aanmaken mislukt')
  console.log(`  ✓ Tenant aangemaakt (id=${tenant.id}, slug=${tenant.slug})`)

  console.log(`Gebruiker koppelen als admin...`)
  await db
    .insert(tenantMembers)
    .values({ tenantId: tenant.id, userId, role: 'admin' })
  console.log(`  ✓ Lid toegevoegd als admin`)

  console.log(`\n✅ Klaar. Tenant "Hans" met admin info@jaaphoeve.com (ww: JaapSexy)`)
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
