// src/lib/validations.ts
import { z } from 'zod'
import { ReviewStatus, AssistantStatus, TenantPlan } from '@/types'

export const loginSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(8, 'Wachtwoord minimaal 8 tekens'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  name: z.string().min(2, 'Naam minimaal 2 tekens'),
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(8, 'Wachtwoord minimaal 8 tekens'),
})
export type RegisterInput = z.infer<typeof registerSchema>

export const updateAssistantStatusSchema = z.object({
  status: z.enum([
    AssistantStatus.ACTIVE,
    AssistantStatus.PAUSED,
    AssistantStatus.ERROR,
  ]),
})
export type UpdateAssistantStatusInput = z.infer<
  typeof updateAssistantStatusSchema
>

export const updateReviewStatusSchema = z.object({
  status: z.enum([
    ReviewStatus.APPROVED,
    ReviewStatus.REJECTED,
    ReviewStatus.IGNORED,
  ]),
})
export type UpdateReviewStatusInput = z.infer<typeof updateReviewStatusSchema>

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Naam minimaal 2 tekens'),
  slug: z
    .string()
    .min(2, 'Slug minimaal 2 tekens')
    .regex(/^[a-z0-9-]+$/, 'Allen kleine letters, cijfers en koppeltekens'),
  plan: z.enum([TenantPlan.FREE, TenantPlan.PRO, TenantPlan.ENTERPRISE]).default(TenantPlan.FREE),
  userName: z.string().min(2, 'Naam minimaal 2 tekens'),
  userEmail: z.string().email('Ongeldig e-mailadres'),
  userPassword: z.string().min(8, 'Wachtwoord minimaal 8 tekens'),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>
