import { db } from '@/db'
import { assistantTenants } from '@/db/schema/app'
import { eq, and } from 'drizzle-orm'

/**
 * Controleert of een assistent beschikbaar is in een tenant via de koppeltabel.
 */
export async function assistantBelongsToTenant(
  assistantId: string,
  tenantId: string
): Promise<boolean> {
  const [row] = await db
    .select({ assistantId: assistantTenants.assistantId })
    .from(assistantTenants)
    .where(
      and(
        eq(assistantTenants.assistantId, assistantId),
        eq(assistantTenants.tenantId, tenantId)
      )
    )
    .limit(1)

  return row !== undefined
}
