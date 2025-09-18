// FILE: http-error.js

import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'X-Request-Id';

export function ensureRequestId(req, res) {
  const existing = res?.getHeader?.(REQUEST_ID_HEADER)
    ?? req?.id
    ?? req?.headers?.[REQUEST_ID_HEADER.toLowerCase()]
    ?? req?.headers?.['x-correlation-id'];

  if (existing) {
    if (res && typeof res.getHeader === 'function' && !res.getHeader(REQUEST_ID_HEADER)) {
      res.setHeader(REQUEST_ID_HEADER, existing);
    }
    if (req) {
      req.id = existing;
    }
    return existing;
  }

  const generated = randomUUID();
  if (res && typeof res.setHeader === 'function') {
    res.setHeader(REQUEST_ID_HEADER, generated);
  }
  if (req) {
    req.id = generated;
  }
  return generated;
}

export function buildErrorPayload(req, res, code, message, details) {
  const payload = {
    code,
    message,
    requestId: ensureRequestId(req, res),
  };

  if (details !== undefined && details !== null) {
    payload.details = details;
  }

  return payload;
}

export function sendError(res, req, statusCode, code, message, details) {
  const payload = buildErrorPayload(req, res, code, message, details);
  return res.status(statusCode).json(payload);
}
