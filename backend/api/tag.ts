/**
 * POST /api/tag - the twin-core HTTP endpoint (T4.1).
 *
 * Pipeline:  request → validate (T4.2) → tagProfile LLM engine (T3) →
 *            enforce review gate (T4.3) → ImpactProfile JSON.
 *
 * The one contract the frontend consumes: a valid `ImpactProfile` (LOVABLE_PRD
 * §7 / backend contract T1). This handler is the seam T5 points the Lovable
 * frontend's `getProfile()` at.
 *
 * Runtime: Vercel Node serverless. Requires ANTHROPIC_API_KEY in the env.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { tagProfile } from "../src/twin/tagProfile.js";
import { enforceReviewGate } from "../src/twin/reviewGate.js";
import { apiError, corsHeaders, parseFounderInput } from "../src/api/http.js";

function applyHeaders(res: VercelResponse, headers: Record<string, string>) {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
}

/**
 * Client factory - injectable so tests can supply a mock without a real key or
 * network. Production builds a real Anthropic client from the env key.
 */
type ClientFactory = (apiKey: string) => Anthropic;
let clientFactory: ClientFactory = (apiKey) => new Anthropic({ apiKey });

/** Test hook: override the Anthropic client factory. */
export function __setClientFactory(factory: ClientFactory): void {
  clientFactory = factory;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const origin = (req.headers.origin as string | undefined) ?? undefined;
  applyHeaders(res, corsHeaders(origin));

  // CORS preflight.
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res
      .status(405)
      .json(apiError("method_not_allowed", "Use POST to tag a startup."));
    return;
  }

  // Vercel parses JSON bodies automatically; fall back to a manual parse for
  // string bodies (edge cases / other runtimes).
  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json(apiError("invalid_request", "Body is not valid JSON."));
      return;
    }
  }

  const parsed = parseFounderInput(body);
  if (!parsed.ok) {
    res
      .status(400)
      .json(apiError("invalid_request", "Founder input failed validation.", parsed.issues));
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res
      .status(500)
      .json(apiError("internal_error", "Server is missing ANTHROPIC_API_KEY."));
    return;
  }

  const client = clientFactory(apiKey);

  try {
    const { profile, attempts } = await tagProfile(client, parsed.input);
    const gated = enforceReviewGate(profile); // T4.3 - non-negotiable server-side
    res.setHeader("X-Tagging-Attempts", String(attempts));
    res.status(200).json(gated);
  } catch (err) {
    // Model produced output we couldn't coerce into the contract even after repair.
    res
      .status(502)
      .json(
        apiError(
          "tagging_failed",
          "The tagging engine could not produce a valid impact profile.",
        ),
      );
  }
}
