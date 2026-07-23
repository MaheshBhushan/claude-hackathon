/**
 * Offline smoke check for T3.1: proves the prompt assembles, embeds the
 * taxonomy, and renders a user message - no API key or network needed.
 */

import { FounderInput } from "./input.js";
import { TAGGING_SYSTEM_PROMPT, buildTaggingUserMessage } from "./prompt.js";

const sample = FounderInput.parse({
  name: "VoltForge",
  sector: "Climate hardware",
  narrative:
    "We build grid-scale iron-air batteries so utilities can store surplus solar and wind and release it overnight, cutting reliance on gas peaker plants.",
  toc: { activity: "Manufacture long-duration battery units", outcome: "Utilities firm up renewable supply" },
  maturity: "pilot",
});

const user = buildTaggingUserMessage(sample, "2026-07-23T14:00:00.000Z");

const checks: Array<[string, boolean]> = [
  ["system embeds taxonomy", TAGGING_SYSTEM_PROMPT.includes("<taxonomy>") && TAGGING_SYSTEM_PROMPT.includes("Affordable and Clean Energy")],
  ["system states human gate", TAGGING_SYSTEM_PROMPT.includes("flaggedForReview") && TAGGING_SYSTEM_PROMPT.includes("contribution")],
  ["system forbids composite score", TAGGING_SYSTEM_PROMPT.toLowerCase().includes("no composite score")],
  ["user echoes maturity", user.includes("maturity tier: pilot")],
  ["user injects narrative", user.includes("iron-air batteries")],
  ["user carries lastEvaluated", user.includes("2026-07-23T14:00:00.000Z")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`\n${failed} prompt check(s) failed.`);
  process.exit(1);
}
console.log("\nPrompt assembles correctly.");
