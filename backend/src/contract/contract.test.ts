/**
 * Contract sanity checks for T1. Not a full test suite - just proves the schema
 * accepts a well-formed profile and rejects the violations that matter most for
 * the frontend/backend boundary. Run: `npm run test:contract`.
 */

import {
  ImpactProfile,
  DIMENSION_ORDER,
  TOC_ORDER,
  STAKEHOLDER_ORDER,
} from "./schema.js";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}`);
  }
}

/** A minimal, valid profile built from the canonical key orders. */
function validProfile(): unknown {
  return {
    id: "voltforge",
    name: "VoltForge",
    sector: "Climate hardware",
    mission: "Grid-scale battery storage to firm up renewable supply.",
    maturity: "pilot",
    lastEvaluated: "2026-07-23T14:00:00.000Z",
    dimensions: DIMENSION_ORDER.map((dimension) => ({
      dimension,
      score: 3,
      summary: `Summary for ${dimension}.`,
      confidence: "emerging",
      flaggedForReview: dimension === "risk" || dimension === "contribution",
    })),
    toc: TOC_ORDER.map((stage) => ({
      stage,
      text: `ToC ${stage} description.`,
    })),
    stakeholders: STAKEHOLDER_ORDER.map((area) => ({
      area,
      score: 2,
      note: `Note for ${area}.`,
    })),
    reviewFlags: [
      { kind: "risk", claim: "Battery chemistry supply-chain risk.", status: "pending" },
    ],
    publicNarrative: "VoltForge stores clean energy at grid scale.",
    themeTags: ["Clean Energy", "SDG 7"],
  };
}

// 1. Valid profile parses.
check("valid profile passes", ImpactProfile.safeParse(validProfile()).success);

// 2. Wrong dimensions length is rejected.
{
  const p = validProfile() as any;
  p.dimensions = p.dimensions.slice(0, 4);
  check("4 dimensions rejected", !ImpactProfile.safeParse(p).success);
}

// 3. Out-of-range score is rejected.
{
  const p = validProfile() as any;
  p.stakeholders[0].score = 5;
  check("score > 4 rejected", !ImpactProfile.safeParse(p).success);
}

// 4. Unknown enum value is rejected.
{
  const p = validProfile() as any;
  p.maturity = "growth";
  check("bad maturity enum rejected", !ImpactProfile.safeParse(p).success);
}

// 5. Unknown dimension key is rejected.
{
  const p = validProfile() as any;
  p.dimensions[0].dimension = "impactfulness";
  check("bad dimension key rejected", !ImpactProfile.safeParse(p).success);
}

if (failures > 0) {
  console.error(`\n${failures} contract check(s) failed.`);
  process.exit(1);
}
console.log("\nAll contract checks passed.");
