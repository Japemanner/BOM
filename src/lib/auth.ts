// src/lib/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { db } from '@/db'
import { users, sessions, accounts, verifications } from '@/db/schema/auth'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
        // In productie: vervang door echte e-mail provider (bijv. Resend)
        console.log(`[Magic Link] ${email}: ${url}`)
      },
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
})

export type Session = typeof auth.$Infer.Session