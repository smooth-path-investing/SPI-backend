import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "node:http";

import { env } from "../config/env";

const BASE_RESPONSE_HEADERS: OutgoingHttpHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const ALLOWED_HTTP_METHODS = ["GET", "OPTIONS"] as const;
const CORS_ALLOWED_METHODS = ALLOWED_HTTP_METHODS.join(", ");
const CORS_ALLOWED_HEADERS = "Content-Type, Authorization";

type JsonValue =
  | boolean
  | number
  | null
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function resolveAllowedOrigin(origin: string): string | null {
  if (env.corsAllowedOrigins.length === 0) {
    return null;
  }

  if (env.corsAllowedOrigins.includes("*")) {
    return "*";
  }

  return env.corsAllowedOrigins.includes(origin) ? origin : null;
}

function buildCorsHeaders(req: IncomingMessage): OutgoingHttpHeaders {
  const requestOrigin = req.headers.origin;

  if (!requestOrigin) {
    return {};
  }

  const allowedOrigin = resolveAllowedOrigin(requestOrigin);

  if (!allowedOrigin) {
    return {};
  }

  const headers: OutgoingHttpHeaders = {
    "Access-Control-Allow-Headers": CORS_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": CORS_ALLOWED_METHODS,
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Max-Age": "600"
  };

  if (allowedOrigin !== "*") {
    headers.Vary = "Origin";
  }

  return headers;
}

function buildHeaders(
  req: IncomingMessage,
  extraHeaders: OutgoingHttpHeaders = {}
): OutgoingHttpHeaders {
  return {
    ...BASE_RESPONSE_HEADERS,
    ...buildCorsHeaders(req),
    ...extraHeaders
  };
}

export function isOriginAllowed(req: IncomingMessage): boolean {
  const requestOrigin = req.headers.origin;

  if (!requestOrigin) {
    return true;
  }

  return resolveAllowedOrigin(requestOrigin) !== null;
}

export function sendJson(
  req: IncomingMessage,
  res: ServerResponse,
  statusCode: number,
  payload: JsonValue | unknown,
  extraHeaders: OutgoingHttpHeaders = {}
): void {
  res.writeHead(
    statusCode,
    buildHeaders(req, {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    })
  );
  res.end(JSON.stringify(payload));
}

export function sendNoContent(
  req: IncomingMessage,
  res: ServerResponse,
  statusCode = 204,
  extraHeaders: OutgoingHttpHeaders = {}
): void {
  res.writeHead(statusCode, buildHeaders(req, extraHeaders));
  res.end();
}

export function sendMethodNotAllowed(
  req: IncomingMessage,
  res: ServerResponse
): void {
  sendJson(
    req,
    res,
    405,
    {
      message: "Method not allowed.",
      method: req.method ?? "UNKNOWN"
    },
    {
      Allow: ALLOWED_HTTP_METHODS.join(", ")
    }
  );
}

export function sendOriginNotAllowed(
  req: IncomingMessage,
  res: ServerResponse
): void {
  sendJson(req, res, 403, {
    message: "Origin not allowed."
  });
}
