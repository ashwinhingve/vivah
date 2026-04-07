import type { Response } from 'express';
import type { ApiSuccess, ApiError } from '@vivah/types';

function meta() {
  return { timestamp: new Date().toISOString() };
}

export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { success: true, data, error: null, meta: meta() };
  res.status(status).json(body);
}

export function err(res: Response, code: string, message: string, status = 400): void {
  const body: ApiError = { success: false, data: null, error: { code, message }, meta: meta() };
  res.status(status).json(body);
}
