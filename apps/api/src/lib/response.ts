import type { Response } from 'express';
import type { ApiSuccess, ApiError } from '@smartshaadi/types';

function baseMeta() {
  return { timestamp: new Date().toISOString() };
}

export function ok<T>(
  res: Response,
  data: T,
  status = 200,
  extraMeta?: Record<string, unknown>,
): void {
  const meta = { ...baseMeta(), ...(extraMeta ?? {}) };
  const body: ApiSuccess<T> = { success: true, data, error: null, meta };
  res.status(status).json(body);
}

export function err(
  res: Response,
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>,
): void {
  const body: ApiError = {
    success: false,
    data: null,
    error: details ? { code, message, ...details } : { code, message },
    meta: baseMeta(),
  };
  res.status(status).json(body);
}
