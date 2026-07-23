/**
 * Offline test for T3.2: mocks the Anthropic client so the extract → validate →
 * repair loop is exercised with no API key or network. Proves (a) a clean valid
 * response returns in 1 attempt, and (b) a malformed first response is repaired
 * on the second attempt.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { FounderInput } from "./input.js";
import { tagProfile } from "./tagProfile.js";
import {
  DIMENSION_ORDER,
  TOC_ORDER,
  STAKEHOLDER_ORDER,
} from "../contract/schema.js";

const NOW = "2026-07-23T14:00:00.000Z";

const input = FounderInput.parse({
  name: "VoltForge",
  sector: "Climate hardware",
  narrative: "Grid-scale iron-air batteries for utilities.",
  maturity: "pilot",
});

/** A well-formed profile the mock model "returns". */
function validProfileJson(): string {
  return JSON.stringify({
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
      flaggedForReview: dimension === "risk" || dimension === "contribution",
    })),
    toc: TOC_ORDER.map((stage) => ({ stage, text: `ToC ${stage}.` })),
    stakeholders: STAKEHOLDER_ORDER.map((area) => ({
      area,
      score: 2,
      note: `Note ${area}.`,
    })),
    reviewFlags: [
      { kind: "risk", claim: "Chemistry supply risk.", status: "pending" },
      { kind: "contribution", claim: "Counterfactual unproven.", status: "pending" },
    ],
    publicNarrative: "VoltForge stores clean energy at grid scale.",
    themeTags: ["Energy", "SDG 7"],
  });
}

function fakeMessage(text: string): Anthropic.Message {
  return { content: [{ type: "text", text }] } as unknown as Anthropic.Message;
}

/** Builds a mock client whose messages.create returns canned texts in order. */
function mockClient(responses: string[]): { client: Anthropic; calls: () => number } {
  let i = 0;
  const client = {
    messages: {
      create: async () => fakeMessage(responses[Math.min(i++, responses.length - 1)]),
    },
  } as unknown as Anthropic;
  return { client, calls: () => i };
}

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failures++;
}

async function main() {
  // Case 1: clean valid response, wrapped in stray prose + fences the extractor must strip.
  const noisy = "Here is the profile:\n```json\n" + validProfileJson() + "\n```";
  const { client: c1 } = mockClient([noisy]);
  const r1 = await tagProfile(c1, input, NOW);
  check("clean response validates in 1 attempt", r1.attempts === 1);
  check("profile id parsed", r1.profile.id === "voltforge");
  check("risk flagged for review", r1.profile.dimensions.find((d) => d.dimension === "risk")?.flaggedForReview === true);

  // Case 2: malformed first response (score out of range) → repair succeeds.
  const bad = validProfileJson().replace('"score":3', '"score":9');
  const { client: c2 } = mockClient([bad, validProfileJson()]);
  const r2 = await tagProfile(c2, input, NOW);
  check("malformed response repaired on 2nd attempt", r2.attempts === 2);
  check("repaired profile valid", r2.profile.name === "VoltForge");

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\ntagProfile loop works offline.");
}

main();
