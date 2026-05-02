/**
 * Smart Shaadi — typed Server Action result envelope
 *
 * Use:
 *   "use server";
 *   export const myAction = wrapAction(async (input: Input) => {
 *     // ...
 *     return { id: 123 };
 *   });
 *
 * Callers receive { ok, data | message, code }, never an unhandled throw.
 */

export type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; code: string; message: string };

interface AppError extends Error {
  code?:    string;
  status?:  number;
}

export function wrapAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<ActionResult<TResult>> {
  return async (...args) => {
    try {
      const data = await fn(...args);
      return { ok: true, data };
    } catch (e) {
      const err = e as AppError;
      const code = err.code ?? 'ACTION_FAILED';
      const message = err.message ?? 'Something went wrong';
      // Surface to Sentry in production via console.error (instrumentation will pick it up)
      console.error('[action-error]', { code, message, stack: err.stack });
      return { ok: false, code, message };
    }
  };
}

export function isOk<T>(r: ActionResult<T>): r is { ok: true; data: T } {
  return r.ok === true;
}
