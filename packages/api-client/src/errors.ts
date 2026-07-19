/**
 * Error types thrown by the API client.
 *
 * Note on naming: `ApiError` is already taken in `@smartshaadi/types` — there it
 * is the *envelope* interface (`{ success: false, data: null, error, meta }`),
 * i.e. a wire shape, not a throwable. The thrown class is therefore
 * `ApiRequestError`, so both can be imported into the same module without an
 * alias.
 */

/**
 * A request that reached the API and came back unsuccessful — either a non-2xx
 * status or a `success: false` envelope.
 *
 * `code` is the API's own error code (`AuthErrorCode.UNAUTHORIZED`, etc.), which
 * is what UI should branch on. `httpStatus` is kept for the cases where the
 * distinction matters (401 → re-auth, 429 → back off) and for the rare response
 * that fails before a code exists (a proxy 502 returning HTML, say).
 */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    // Restores prototype chain under ES5-targeting transpilers, so
    // `err instanceof ApiRequestError` holds in the RN bundle too.
    Object.setPrototypeOf(this, ApiRequestError.prototype);
  }

  /** 401 — session missing or expired. Callers should route to sign-in. */
  get isUnauthorized(): boolean {
    return this.httpStatus === 401;
  }

  /** 403 — authenticated but not permitted. Never retry; never route to sign-in. */
  get isForbidden(): boolean {
    return this.httpStatus === 403;
  }
}

/**
 * The request never produced an API response at all — DNS failure, airplane
 * mode, TLS error, timeout. Distinct from `ApiRequestError` because the UI
 * affordance differs: this one is "retry", not "something is wrong with your
 * request". On mobile this is the common case, not the rare one.
 */
export class NetworkError extends Error {
  // `cause` is deliberately NOT redeclared as a field: ES2022's Error already
  // defines it, and shadowing it would need an `override` modifier while also
  // breaking the native cause chain that debuggers and Sentry follow. Passing
  // it through the options bag is the supported route.
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
