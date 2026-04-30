// src/lib/error-handlers.ts
// Global error handlers voor server-side (Node.js) crashes.
// Wordt eenmalig geladen via instrumentation of bij opstart.

import { logError } from './logger'

let installed = false

export function installGlobalErrorHandlers(): void {
  if (installed) return
  installed = true

  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', (reason: unknown) => {
      logError('unhandledRejection', reason)
    })

    process.on('uncaughtException', (error: Error) => {
      logError('uncaughtException', error)
      // Process blijft draaien in Node 18+ bij uncaughtException in async context,
      // maar bij sync errors zonder catch crasht het alsnog. We loggen en hopen op het beste.
    })
  }
}
