/**
 * Emits a pure JSON-Schema mirror of the `ImpactProfile` contract (T1) so
 * non-Zod consumers (frontend tooling, docs, validators) share one definition.
 * Run: `npm run gen:schema` → writes `impact-profile.schema.json`.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ImpactProfile } from "./schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "impact-profile.schema.json");

const jsonSchema = zodToJsonSchema(ImpactProfile, {
  name: "ImpactProfile",
  $refStrategy: "none",
});

writeFileSync(outPath, JSON.stringify(jsonSchema, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
