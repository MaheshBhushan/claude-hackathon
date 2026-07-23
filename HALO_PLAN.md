# Halo Execution Plan — Zollhof Impact Digital Twin

**Scope:** Backend + integration only. The frontend is built externally in **Lovable/Vercel** against the mock `ImpactProfile` shape defined in `LOVABLE_PRD.md §7`. This plan covers everything behind that boundary.

**Attribution rule:** never credit Claude as a co-author anywhere — no `Co-Authored-By` trailers, no "Generated with Claude Code" footers in commits, PRs, or docs. Pass this to every subagent that commits.

---

## Overview
Frontend (Lovable/Vercel) renders against the `ImpactProfile` contract. This plan builds the shared data contract, the LLM tagging engine (the "twin core"), the API the frontend calls, the taxonomy grounding data, the server-side guardrail enforcement, and the seam that swaps Lovable's mock fetch for the live endpoint.

## Boundary / interface with the frontend
Frontend and backend meet at exactly **one contract**: `POST /api/tag` → returns an `ImpactProfile` JSON. Everything here produces or serves that object. The TS `ImpactProfile` type in `LOVABLE_PRD.md §7` is the single source of truth both sides import.

---

## Task tree

```
T1  Shared data contract           [root — no deps]   ← authoritative ImpactProfile schema
T2  Taxonomy seed data             [no deps]          ← IRIS+ / SDG / B-Lab / 5-dim grounding
T3  LLM tagging engine (twin core) [dep: T1, T2]
│    ├── T3.1  Prompt design (narrative → ToC + 5-dim tags + theme suggestions + vagueness/flags)
│    └── T3.2  Anthropic call + JSON validation/repair against T1 schema
T4  API service                    [dep: T1, T3]
│    ├── T4.1  POST /api/tag route (Vercel serverless / edge function)
│    ├── T4.2  Input validation, error shapes, CORS for Lovable origin
│    └── T4.3  Rule post-processing: force Risk/Contribution → flaggedForReview
T5  Integration & seam swap        [dep: T4]           ← replace Lovable mock getProfile() with live fetch
T6  Deploy + demo wiring           [dep: T5]           ← Vercel env (ANTHROPIC_API_KEY), seeded demo data
```

Dependency edges: T3 ← (T1, T2); T4 ← (T1, T3); T5 ← T4; T6 ← T5.

---

## Subtask table

| id | description | deps | inputs → output | model | effort | rationale |
|---|---|---|---|---|---|---|
| **T1** | Authoritative `ImpactProfile`/`ToCNode`/`DimensionTag`/`StakeholderArea`/`ReviewFlag` schema as shared TS + JSON-Schema (runtime validation). Must match `LOVABLE_PRD.md §7` exactly. | none | PRD §7 → `schema.ts` + `impact-profile.schema.json` | `claude-opus-4-8` | high | The one interface both frontend and backend depend on; drift breaks integration. |
| **T2** | Curated grounding data: 5 IMP dimension definitions, IRIS+ themes, SDG targets, 5 B-Lab areas → JSON the prompt cites. | none | frameworks → `taxonomy.json` | `claude-sonnet-4-6` | medium | Structured reference assembly; accuracy over reasoning. |
| **T3.1** | Tagging prompt: freeform founder narrative → structured ToC nodes, 5-dimension tags w/ confidence, SDG/IRIS+/B-Lab suggestions grounded in `taxonomy.json`, flag vague/unscorable claims. Must refuse to invent tags. | T1, T2 | schema + taxonomy → prompt template | `claude-opus-4-8` | high | This prompt *is* the product's intelligence; grounding + calibrated refusal is make-or-break. |
| **T3.2** | Anthropic SDK call (`claude-opus-4-8`), parse output, validate against JSON-Schema, repair/retry loop on malformed JSON. | T3.1 | prompt → `tagProfile()` module | `claude-sonnet-4-6` | medium | Conventional SDK + validation glue. |
| **T4.1** | `POST /api/tag` serverless function on Vercel; accepts narrative + ToC fields, returns `ImpactProfile`. | T1, T3 | `tagProfile()` → API route | `claude-sonnet-4-6` | medium | Standard serverless endpoint. |
| **T4.2** | Request validation, typed error responses, CORS allow-list for the Lovable/Vercel frontend origin. | T4.1 | route → hardened route | `claude-sonnet-4-6` | medium | Boilerplate hardening; low ambiguity. |
| **T4.3** | Deterministic post-processing: force `flaggedForReview=true` on Risk + Contribution regardless of LLM output (enforces the human-gate guardrail server-side). | T4.1 | route → rule layer | `claude-sonnet-4-6` | low | Small deterministic rule. |
| **T5** | Integration: replace Lovable's mock `lib/getProfile.ts` with a live `fetch('/api/tag')`; reconcile shape mismatches; verify end-to-end with the 3 seeded startups (VoltForge / Mindloop / Palleto). | T4 | frontend seam + API → working E2E | `claude-opus-4-8` | medium | Cross-boundary reconciliation where mock vs. real shapes meet; needs judgment. |
| **T6** | Deploy: Vercel project, `ANTHROPIC_API_KEY` env, seed demo profiles, smoke-test the live URL. | T5 | integrated app → live deployment | `claude-sonnet-4-6` | medium | Standard deploy + config. |

---

## Critical path & parallelism
- **Critical path:** T1 → T3.1 → T3.2 → T4.1 → T5 → T6.
- **Parallel:** T2 runs alongside T1; T4.2/T4.3 can be built against a stubbed `tagProfile()` while T3 is finalized.
- **Freeze T1 early** — the Lovable frontend is coded against the same schema; any change to `ImpactProfile` must be published as a versioned contract, not silently edited.

## Re-evaluation triggers (Halo §4)
- **T3.1 invents tags outside `taxonomy.json`** → insufficient-care shape → keep effort high, strengthen grounding/few-shot; if reasoning still wrong → escalate model to `claude-fable-5`.
- **T3.2 malformed JSON persists after retry** → capability shape → split into two calls (parse ToC, then tag) or bump extraction model.
- **T5 reveals frontend/backend shape mismatch** → root-cause in the T1 contract; fix the schema and re-publish to both sides rather than patching in the seam.

---

*Plan only — no code written. Frontend-build tasks are intentionally excluded (owned by Lovable/Vercel).*
