// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as authSchema from './schema/auth'
import * as iamSchema from './schema/iam'
import * as rbacSchema from './schema/rbac'
import * as appSchema from './schema/app'

const connectionString = process.env['DATABASE_URL']
if (!connectionString) {
  throw new Error('DATABASE_URL omgevingsvariabele is niet ingesteld')
}

const client = postgres(connectionString)
export const db = drizzle(client, {
  schema: { ...authSchema, ...iamSchema, ...rbacSchema, ...appSchema },
})
