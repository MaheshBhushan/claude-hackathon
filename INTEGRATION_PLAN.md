# Frontend ↔ Backend Integration Plan (T5)

Wire the single-file frontend (`zollhof-twin-app.html`) to the live backend
(`POST /api/tag`, `claude-opus-4-8` twin core), replacing the browser-side
heuristic engine with real LLM tagging while keeping the existing UI.

## What we're integrating

| | Frontend (`zollhof-twin-app.html`) | Backend (`/api/tag`) |
|---|---|---|
| Engine | `buildProfile()` — client-side JS heuristics, no network | `tagProfile()` → `claude-opus-4-8`, contract-validated |
| Profile shape | rich: `dims[]` (narrative/notes/gated), `toc[]`, `stakeholders[]`, **readiness band**, **verification ledger** | `ImpactProfile` contract: `dimensions[]` (score/summary/confidence/flaggedForReview), `toc[]`, `stakeholders[]`, `reviewFlags[]` |
| LLM | none (faked) | real |

**The single integration seam:** the intake wizard's "Generate impact twin"
handler (`wizGo` → `buildProfile(state.intakeData)` → `state.intakeProfile`).
Everything else (portfolio, twin view, radar, public card, review gate,
readiness) reads from the profile object and does not need to change *if* the
API response is adapted into the frontend's existing profile shape.

## Recommended approach: a thin adapter, not a rewrite

Keep the frontend's internal profile shape as the UI's contract. Add **one
adapter function** `apiToProfile(apiResp, intakeData)` that maps the backend
`ImpactProfile` into that shape. Swap the one call site from `buildProfile(...)`
(sync, local) to `await fetchProfile(...)` (async, API) → `apiToProfile(...)`.

This is the smallest change that makes the demo real, preserves the polished UI,
and matches the plan's T5 ("replace the mock `getProfile()` seam, reconcile
shape mismatches").

## Step 1 — Request mapping (intake → `FounderInput`)

The intake collects `problem`, `beneficiaries`, `activity`, `evidence`, `name`,
`tier`. The backend expects `FounderInput { name, sector, narrative, toc?, maturity }`.

| `FounderInput` field | Source in `state.intakeData` |
|---|---|
| `name` | `name` (fallback `"Unnamed venture"`) |
| `sector` | `category` if present, else a default like `"Uncategorised"` |
| `narrative` | compose: `problem` + `beneficiaries` + `activity` + `evidence` joined into prose (must be non-empty) |
| `toc.activity` | `activity` |
| `toc.outcome` | `problem` |
| `toc.output` | `evidence` |
| `maturity` | `tier` (already `concept`/`pilot`/`scale`) |

> The backend re-parses the narrative into all five ToC stages itself; the
> `toc` hints just seed it. `sector` is required (min length 1) — supply a
> default if the intake has no category field.

## Step 2 — Response mapping (`ImpactProfile` → frontend profile)

`apiToProfile(api, intake)` builds the frontend object:

| Frontend field | From `ImpactProfile` |
|---|---|
| `id, name, sector, mission` | same-named fields |
| `tier` | `TIERS[api.maturity]` (string → the frontend's tier object) |
| `dims[]` | map each `api.dimensions[d]`: `narrative ← summary`, `confidence ← confidence`, `gated ← flaggedForReview`, keep `score` for the radar |
| `dims[].notes` | synthesize from `needsSharpening` ToC nodes + risk flag claims (backend has no `notes` array) |
| `dims risk .flags` | from `api.reviewFlags` where `kind==="risk"` |
| `toc[]` | map stage (lowercase→Title), `text`, `sdg ← sdgTargets` (as `{label}`), `iris ← irisThemes` (as `{label}`), `needsSharpening` |
| `stakeholders[]` | `score ← score`, `note ← note`, `addressed ← score>0` |
| `riskFlags, gated` | from `reviewFlags` (risk) / `flaggedForReview` |
| `publicNarrative` | `publicNarrative` |
| `publicThemes` | `themeTags` |

### The radar
The frontend radar renders "Evidence by dimension." The backend gives a real
integer `score` (0–4) per dimension — feed that straight into the radar (an
upgrade over the heuristic version).

## Step 3 — Reconcile the frontend-only concepts

Two frontend features have **no backend equivalent** — decide per the options:

1. **Readiness band** (`assessReadiness`) — a "worth backing" lens computed from
   `dims[].notes`. Options:
   - **(a, recommended)** keep it client-side, computed from the *adapted*
     profile (synthesize the `notes` it reads from `needsSharpening` + tier
     mismatch signals). Zero backend change.
   - (b) extend the backend contract to emit readiness (bigger change, breaks
     the frozen T1 contract — avoid for the hackathon).
2. **Verification ledger** (`verifyClaim`/`verifyAll`) — cross-checks stated vs
   recorded numbers. This is a client-side check over the founder's own input;
   keep it entirely client-side, unchanged. It doesn't depend on the engine.

## Step 4 — Plumbing

- **API base URL:** add a single `const API_BASE = "..."` (the deployed Vercel
  URL) at the top of the `<script>`, with a `?api=` query-param override for
  local testing.
- **Loading state:** the call is now async (seconds, with thinking). Add a
  "Generating impact twin…" state on the step-4 transition (the UI already has a
  loading affordance pattern to reuse).
- **Error state:** on non-200, show the backend's typed `error.message`; offer a
  retry. Optionally fall back to the local `buildProfile()` so the demo degrades
  gracefully if the API is down.
- **CORS / origin:** the backend allow-list must include wherever the HTML is
  served. Note: opening the file as `file://` sends `Origin: null` — host the
  HTML (Vercel static, or the same project) rather than double-clicking it.
  Add the host to `ALLOWED_ORIGINS`.

## Step 5 — Hosting topology

Simplest: serve the HTML as a static file from the **same Vercel project** as
`api/tag.ts`. Then the frontend can call a same-origin relative path (`/api/tag`)
— no CORS at all — and `API_BASE` can default to `""`. Put `zollhof-twin-app.html`
in the project's `public/` (or as `index.html`) alongside the `api/` function.

## Step 6 — Verify end-to-end

- Deploy with `ANTHROPIC_API_KEY` set.
- Run the intake for the seeded example (Ackerlicht Robotics) and 2–3 contrasting
  sectors; confirm: profile renders, radar reflects real scores, Risk &
  Contribution show the review gate, theme chips are grounded, maturity badge is
  correct, no composite score anywhere.
- Confirm a vague submission triggers `needsSharpening` and lowers confidence.

## Task checklist

| # | Task | Where |
|---|---|---|
| I1 | Add `API_BASE` + `?api=` override | HTML `<script>` top |
| I2 | `buildFounderInput(intake)` (request mapping) | HTML |
| I3 | `fetchProfile(input)` → POST `/api/tag`, handle errors | HTML |
| I4 | `apiToProfile(api, intake)` (response adapter) | HTML |
| I5 | Swap `wizGo` handler to async fetch→adapt; add loading/error UI | HTML |
| I6 | Keep readiness + ledger client-side over adapted profile | HTML |
| I7 | Add `zollhof-twin-app.html` to backend `public/` (same-origin) | backend |
| I8 | Add host to `ALLOWED_ORIGINS` (only if cross-origin) | Vercel env |
| I9 | Deploy + end-to-end smoke (Step 6) | Vercel |

## Decisions to confirm

1. **Same-origin hosting** (serve the HTML from the Vercel backend project) vs
   keep the frontend on Lovable and call cross-origin? Same-origin removes CORS
   and is simplest — recommended.
2. **Readiness band:** keep client-side (recommended) or drop it in integrated
   mode?
3. **Offline fallback:** on API failure, fall back to the local heuristic
   `buildProfile` (nice for a live demo) or show a hard error?
