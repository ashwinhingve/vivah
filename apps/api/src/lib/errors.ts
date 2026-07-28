/**
 * Smart Shaadi — Shared typed error for business logic
 *
 * Used throughout the API for consistent error handling. The global Express
 * error middleware checks for `code` (string) and `status` (number) properties
 * and uses them to format the response. All thrown AppErrors reach the middleware
 * with structured error information.
 *
 * Usage:
 *   throw new AppError('NOT_FOUND', 'Profile does not exist', 404);
 *   throw new AppError('INVALID_INPUT', 'Email already registered', 400);
 *   throw new AppError('FORBIDDEN', 'Not authorized', 403);
 */

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
