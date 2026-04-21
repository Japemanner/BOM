// src/types/index.ts

export const UserRole = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const TenantPlan = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const
export type TenantPlan = (typeof TenantPlan)[keyof typeof TenantPlan]

export const AssistantStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error',
} as const
export type AssistantStatus = (typeof AssistantStatus)[keyof typeof AssistantStatus]

export const ReviewPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const
export type ReviewPriority = (typeof ReviewPriority)[keyof typeof ReviewPriority]

export const ReviewStatus = {
  OPEN: 'open',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  IGNORED: 'ignored',
} as const
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus]

export const IntegrationType = {
  EXACT: 'exact',
  MS365: 'ms365',
  SLACK: 'slack',
  UBL: 'ubl',
  CUSTOM: 'custom',
} as const
export type IntegrationType = (typeof IntegrationType)[keyof typeof IntegrationType]

export const IntegrationStatus = {
  ACTIVE: 'active',
  ERROR: 'error',
  SETUP: 'setup',
} as const
export type IntegrationStatus = (typeof IntegrationStatus)[keyof typeof IntegrationStatus]

export const RunStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus]

export interface WebhookToken {
  id: string
  name: string
  assistantId: string | null
  createdAt: string
  lastUsedAt: string | null
}

// API response types
export interface ApiError {
  error: string
  code?: string
}

export interface DashboardMetrics {
  tasksToday: number
  timeSavedMinutes: number
  activeAssistants: number
  totalAssistants: number
  openReviewItems: number
}

// RBAC-permissie types
export const PermissionResource = {
  ASSISTANTS: 'assistants',
  INTEGRATIONS: 'integrations',
  TENANT: 'tenant',
  WEBHOOKS: 'webhooks',
} as const
export type PermissionResource = (typeof PermissionResource)[keyof typeof PermissionResource]

export const PermissionAction = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  TOGGLE_STATUS: 'toggle_status',
  UPDATE_PLAN: 'update_plan',
  INVITE_USER: 'invite_user',
  REMOVE_USER: 'remove_user',
  UPDATE_MEMBER_ROLE: 'update_member_role',
  MANAGE: 'manage',
} as const
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction]
