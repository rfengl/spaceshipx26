import type { HttpError } from '../types.js';

/** Create an Error carrying an HTTP status code, recognized by the error handler. */
export function httpError(status: number, message: string): HttpError {
  const err: HttpError = new Error(message);
  err.status = status;
  return err;
}

// Named helpers for the common statuses.
export const badRequest = (message: string): HttpError => httpError(400, message);
export const unauthorized = (message = 'Authentication required'): HttpError =>
  httpError(401, message);
export const forbidden = (message = 'Insufficient permissions'): HttpError =>
  httpError(403, message);
export const notFound = (message = 'Not found'): HttpError => httpError(404, message);
export const conflict = (message: string): HttpError => httpError(409, message);
export const serverError = (message: string): HttpError => httpError(500, message);
