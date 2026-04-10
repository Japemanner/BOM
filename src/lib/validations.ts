// src/lib/validations.ts
import { z } from 'zod'
import { ReviewStatus, AssistantStatus } from '@/types'

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
