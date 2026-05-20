/**
 * Next.js 14+ App Router instrumentation hook.
 *
 * Without this file, the `sentry.server.config.ts` and `sentry.edge.config.ts`
 * placed at the project root are NEVER auto-loaded by Next — only the client
 * config is. Result: every Server Action, Route Handler, and RSC error is
 * silently dropped and never reaches Sentry. Closes P0-7 from
 * `docs/PHASE-1-4-AUDIT.md`.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env['NEXT_RUNTIME'] === 'edge') {
    await import('./sentry.edge.config');
  }
}
