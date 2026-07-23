# Zollhof Impact Digital Twin - Backend

Sector-agnostic startup **impact-evaluation** engine for the Zollhof incubator.
A founder's freeform description of their startup goes in; a structured,
multi-dimensional **Impact Profile** comes out - never a single composite score.

The frontend is built separately (Lovable/Vercel). This service is everything
behind the one contract the frontend consumes: `POST /api/tag → ImpactProfile`.

## What it does

```
POST /api/tag
  → validate the founder submission            (src/api/http.ts)
  → tag it via claude-opus-4-8                  (src/twin/tagProfile.ts)
      · prompt grounded in a fixed taxonomy     (src/twin/prompt.ts + taxonomy.json)
      · output validated against the contract   (src/contract/schema.ts)
      · one automatic repair on invalid JSON
  → enforce the human-review gate               (src/twin/reviewGate.ts)
  → return a validated ImpactProfile            (src/contract/schema.ts)
```

The evaluation engine is the **Impact Management Project's five dimensions**
(What, Who, How Much, Contribution, Risk), fed by two lenses - a mission
Theory-of-Change tagged to IRIS+/SDG themes, and B-Lab stakeholder areas.

### Guardrails enforced in code (not just requested in the prompt)

- **No composite score.** The contract has no aggregate field, by design.
- **Risk & Contribution are always flagged for human review**, regardless of
  what the model returns - enforced server-side in `reviewGate.ts`.
- **Tags are grounded.** The model may only use dimensions, IRIS+ themes, SDG
  codes, and stakeholder areas from `taxonomy.json`.
- **Confidence is capped by maturity tier** (concept → hypothesis only, etc.).

## Project layout

```
backend/
├── api/
│   └── tag.ts                  POST /api/tag - Vercel serverless handler
├── src/
│   ├── contract/               the shared data contract (source of truth)
│   │   ├── schema.ts             Zod schemas + TS types for ImpactProfile
│   │   ├── impact-profile.schema.json   emitted JSON-Schema mirror
│   │   ├── emit-json-schema.ts   regenerates the JSON schema
│   │   ├── taxonomy.json         grounding vocabulary (IMP/IRIS+/SDG/B-Lab)
│   │   └── contract.test.ts
│   ├── twin/                   the "twin core" - the intelligence
│   │   ├── input.ts              FounderInput schema (the request body)
│   │   ├── prompt.ts             tagging prompt (system + user builder)
│   │   ├── tagProfile.ts         Anthropic call + validate/repair loop
│   │   ├── reviewGate.ts         forces Risk/Contribution → human review
│   │   └── *.smoke.ts            offline tests (no key/network)
│   └── api/                    HTTP helpers for the route
│       ├── http.ts               CORS, typed errors, request validation
│       └── api.smoke.ts          offline handler test
├── vercel.json                 marks api/tag.ts as a 60s function
└── tsconfig.json
```

`schema.ts` is the single contract that the whole backend **and** the Lovable
frontend agree on. Treat it as frozen - any change must be re-published to both
sides.

## Requirements

- Node 18+
- An Anthropic API key

## Setup

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
```

## Scripts

| Command | What it does |
|---|---|
| `npm test` | typecheck + all offline test suites (no key/network needed) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:contract` | contract accepts valid / rejects invalid profiles |
| `npm run test:prompt` | the tagging prompt assembles correctly |
| `npm run test:tag` | the tag + repair loop (mocked client) |
| `npm run test:api` | review gate + validation + full handler path |
| `npm run gen:schema` | regenerate `impact-profile.schema.json` from `schema.ts` |

All tests run fully offline - the Anthropic client is injected, so no API key
or network is required to validate the pipeline.

## API

### `POST /api/tag`

Request body (`FounderInput`):

```json
{
  "name": "VoltForge",
  "sector": "Climate hardware",
  "narrative": "We build grid-scale iron-air batteries so utilities can store surplus solar and wind.",
  "toc": { "activity": "Manufacture battery units", "outcome": "Utilities firm up renewable supply" },
  "maturity": "pilot"
}
```

`toc` is optional; `maturity` is one of `concept` | `pilot` | `scale`.

Response: a validated `ImpactProfile` (see `src/contract/schema.ts` /
`impact-profile.schema.json`).

| Status | Meaning |
|---|---|
| 200 | Valid `ImpactProfile` returned (`X-Tagging-Attempts` header: 1 = clean, 2 = repaired) |
| 400 | Body failed validation (`error.issues` lists the problems) |
| 405 | Method other than POST |
| 500 | Server missing `ANTHROPIC_API_KEY` |
| 502 | Model output failed the contract even after one repair |

Error responses share a typed shape:

```json
{ "error": { "code": "invalid_request", "message": "...", "issues": ["..."] } }
```

## Deployment

Deploys to Vercel as a serverless function. Set `ANTHROPIC_API_KEY` (and
optionally `ALLOWED_ORIGINS`, a comma-separated CORS allow-list) in the project
environment. `vercel.json` gives the function a 60-second timeout.
