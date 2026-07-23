/**
 * HTTP helpers for the API layer (T4.2): CORS, typed error responses, and
 * request-body validation against the FounderInput contract. Kept free of any
 * Vercel-specific types so it's unit-testable and reusable across runtimes.
 */

import { z } from "zod";
import { FounderInput } from "../twin/input.js";

/**
 * Allowed browser origins for the frontend (Lovable preview + the deployed
 * Vercel app). Configure via ALLOWED_ORIGINS (comma-separated) in prod; the
 * defaults cover local dev and Lovable's preview domains.
 */
export function allowedOrigins(): string[] {
  const fromEnv = process.env.ALLOWED_ORIGINS;
  if (fromEnv) return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  return [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://lovable.dev",
    "https://lovableproject.com",
  ];
}

/** Resolves the CORS `Access-Control-Allow-Origin` value for a request origin. */
export function corsOrigin(requestOrigin: string | undefined): string {
  const allowed = allowedOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  // Also allow any *.lovableproject.com / *.vercel.app preview subdomain.
  if (
    requestOrigin &&
    /\.(lovableproject\.com|vercel\.app)$/.test(new URL(requestOrigin).hostname)
  ) {
    return requestOrigin;
  }
  return allowed[0];
}

/** Standard CORS headers for a given request origin. */
export function corsHeaders(requestOrigin: string | undefined): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": corsOrigin(requestOrigin),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** The error body shape the frontend can rely on. */
export interface ApiError {
  error: {
    code: "invalid_request" | "method_not_allowed" | "tagging_failed" | "internal_error";
    message: string;
    /** Field-level validation issues, present only for invalid_request. */
    issues?: string[];
  };
}

export function apiError(
  code: ApiError["error"]["code"],
  message: string,
  issues?: string[],
): ApiError {
  return { error: { code, message, ...(issues ? { issues } : {}) } };
}

/**
 * Parse and validate a raw request body into a FounderInput.
 * Returns the typed input or a structured list of validation issues.
 */
export function parseFounderInput(
  body: unknown,
): { ok: true; input: z.infer<typeof FounderInput> } | { ok: false; issues: string[] } {
  const result = FounderInput.safeParse(body);
  if (result.success) return { ok: true, input: result.data };
  const issues = result.error.issues.map(
    (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
  );
  return { ok: false, issues };
}
