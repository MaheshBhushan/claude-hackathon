/**
 * Offline tests for T4.1–T4.3: the review-gate rule, request validation, CORS,
 * and the full handler path with a mocked Anthropic client (no key/network).
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { enforceReviewGate } from "../twin/reviewGate.js";
import { parseFounderInput, corsOrigin } from "./http.js";
import {
  ImpactProfile,
  DIMENSION_ORDER,
  TOC_ORDER,
  STAKEHOLDER_ORDER,
} from "../contract/schema.js";
import handler, { __setClientFactory } from "../../api/tag.js";

const NOW = "2026-07-23T14:00:00.000Z";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failures++;
}

/** Valid profile object, but with review flags/gates deliberately stripped. */
function ungatedProfile(): ImpactProfile {
  return ImpactProfile.parse({
    id: "voltforge",
    name: "VoltForge",
    sector: "Climate hardware",
    mission: "Store surplus renewable energy at grid scale.",
    maturity: "pilot",
    lastEvaluated: NOW,
    dimensions: DIMENSION_ORDER.map((dimension) => ({
      dimension,
      score: 3,
      summary: `Summary for ${dimension}.`,
      confidence: "emerging",
      // NOTE: no flaggedForReview set anywhere — the gate must add it.
    })),
    toc: TOC_ORDER.map((stage) => ({ stage, text: `ToC ${stage}.` })),
    stakeholders: STAKEHOLDER_ORDER.map((area) => ({
      area,
      score: 2,
      note: `Note ${area}.`,
    })),
    reviewFlags: [], // empty — the gate must synthesize risk + contribution flags
    publicNarrative: "VoltForge stores clean energy at grid scale.",
    themeTags: ["Energy"],
  });
}

function fakeMessage(text: string): Anthropic.Message {
  return { content: [{ type: "text", text }] } as unknown as Anthropic.Message;
}

/** Minimal VercelResponse capture. */
function mockRes() {
  const captured = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const res = {
    setHeader: (k: string, v: string) => {
      captured.headers[k] = v;
    },
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
    end() {
      return this;
    },
  } as unknown as VercelResponse;
  return { res, captured };
}

async function main() {
  // --- T4.3 review gate ---
  const gated = enforceReviewGate(ungatedProfile());
  const risk = gated.dimensions.find((d) => d.dimension === "risk");
  const contrib = gated.dimensions.find((d) => d.dimension === "contribution");
  const what = gated.dimensions.find((d) => d.dimension === "what");
  check("gate flags risk", risk?.flaggedForReview === true);
  check("gate flags contribution", contrib?.flaggedForReview === true);
  check("gate leaves non-gated dims unflagged", what?.flaggedForReview === undefined);
  check("gate synthesizes 2 review flags", gated.reviewFlags.length === 2);
  check("gate is idempotent", enforceReviewGate(gated).reviewFlags.length === 2);

  // --- T4.2 validation + CORS ---
  const bad = parseFounderInput({ name: "X" }); // missing sector/narrative/maturity
  check("validation rejects incomplete input", bad.ok === false);
  const good = parseFounderInput({
    name: "VoltForge",
    sector: "Climate hardware",
    narrative: "Grid-scale batteries.",
    maturity: "pilot",
  });
  check("validation accepts complete input", good.ok === true);
  check("cors echoes allowed localhost origin", corsOrigin("http://localhost:3000") === "http://localhost:3000");
  check("cors allows lovableproject subdomain", corsOrigin("https://abc.lovableproject.com") === "https://abc.lovableproject.com");
  check("cors falls back for unknown origin", corsOrigin("https://evil.example.com") !== "https://evil.example.com");

  // --- T4.1 handler: method guard ---
  {
    const { res, captured } = mockRes();
    await handler({ method: "GET", headers: {} } as VercelRequest, res);
    check("GET is 405", captured.status === 405);
  }

  // --- T4.1 handler: invalid body ---
  {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { res, captured } = mockRes();
    await handler(
      { method: "POST", headers: {}, body: { name: "X" } } as VercelRequest,
      res,
    );
    check("invalid POST body is 400", captured.status === 400);
  }

  // --- T4.1 handler: full success path (inject a mock client) ---
  {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const validJson = JSON.stringify(ungatedProfile());
    __setClientFactory(
      () =>
        ({
          messages: { create: async () => fakeMessage(validJson) },
        }) as unknown as Anthropic,
    );

    const { res, captured } = mockRes();
    await handler(
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: {
          name: "VoltForge",
          sector: "Climate hardware",
          narrative: "Grid-scale iron-air batteries for utilities.",
          maturity: "pilot",
        },
      } as unknown as VercelRequest,
      res,
    );
    check("valid POST returns 200", captured.status === 200);
    check("response is a valid ImpactProfile", ImpactProfile.safeParse(captured.body).success);
    check("response has enforced risk flag", (captured.body as ImpactProfile)?.dimensions?.find((d) => d.dimension === "risk")?.flaggedForReview === true);
  }

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAPI layer (T4.1–T4.3) works offline.");
}

main();
