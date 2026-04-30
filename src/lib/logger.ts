// src/lib/logger.ts
// Structured logging — vervangt console.error/warn/log met context-prefixes.
// Later uitbreidbaar met Sentry/Winston/zonder code-wijzigingen in de rest van de app.

type LogMeta = Record<string, unknown>

export function logError(context: string, error: unknown, meta?: LogMeta): void {
  const msg = error instanceof Error ? error.message : String(error)
  const metaStr = meta ? ' ' + JSON.stringify(meta) : ''
  const stack = error instanceof Error && error.stack ? '\n' + error.stack : ''

  console.error(`[ERROR] [${context}] ${msg}${metaStr}${stack}`)
}

export function logWarn(context: string, message: string): void {
  console.warn(`[WARN] [${context}] ${message}`)
}

export function logInfo(context: string, message: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[INFO] [${context}] ${message}`)
  }
}

/**
 * Gebruik in client-side components om API errors te loggen.
 * Retourneert de foutmelding voor weergave aan de gebruiker.
 */
export async function extractApiError(res: Response): Promise<string> {
  try {
    const body = await res.json() as { error?: string; message?: string } | null
    return body?.error ?? body?.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}
