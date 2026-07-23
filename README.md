<h1 align="center">Zollhof Impact Digital Twin</h1>

<p align="center">
  A founder describes their startup in plain English. Out comes a structured,
  multi-dimensional impact profile — never a single "impact score."
</p>

<p align="center">
  <a href="https://zollhof-twin.vercel.app"><img alt="Live demo" src="https://img.shields.io/badge/live%20demo-zollhof--twin.vercel.app-1A16F0"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Claude Opus 4.8" src="https://img.shields.io/badge/Claude-Opus%204.8-D97757">
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white">
</p>

<p align="center">
  <b><a href="https://zollhof-twin.vercel.app">▶ Try it live</a></b> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#api">API</a>
</p>

<!-- HERO: add a screenshot/GIF of the live app (radar + review gate) as assets/demo.png,
     then uncomment the line below. Until then this stays hidden so nothing 404s.
<p align="center"><img src="assets/demo.png" alt="Impact profile with five-dimension radar and human-review gate" width="820"></p>
-->
<p align="center"><a href="https://zollhof-twin.vercel.app"><b>▶ Open the live demo →</b></a></p>

## The problem

Zollhof is a no-equity incubator that backs deep-tech, health, climate, and B2B
SaaS founders in one program. Two things are hard to do fairly across that mix:

- Compare a fintech app with "no social mission" to a climate startup without
  pretending they're on the same axis.
- Say anything credible about a startup that walked in the door six weeks ago
  and has no data yet.

A single composite "impact score" is the wrong answer — it's the exact opacity
ESG ratings get criticized for, and it invents an incentive to *perform* impact
for a badge. So this tool never produces one.

## What it produces instead

One sector-agnostic engine — the Impact Management Project's **five dimensions**
(What, Who, How Much, Contribution, Risk) — fed by two lenses: the startup's own
Theory of Change (tagged to IRIS+ themes and UN SDG targets) and B-Lab
stakeholder areas. The output is a profile: a five-dimension evidence radar, a
tagged Theory-of-Change chain, stakeholder breakdown, and a maturity badge
(Concept / Pilot / Scale). No number, no leaderboard.

## How it works

A single Claude call turns freeform text into a contract-validated profile:

```
POST /api/tag
  → validate the founder submission            backend/src/api/http.ts
  → tag it via claude-opus-4-8                  backend/src/twin/tagProfile.ts
      · prompt grounded in a fixed taxonomy     backend/src/twin/prompt.ts + taxonomy.json
      · output validated against the contract   backend/src/contract/schema.ts
      · one automatic repair on invalid JSON
  → enforce the human-review gate               backend/src/twin/reviewGate.ts
  → return a validated ImpactProfile            backend/src/contract/schema.ts
```

The web UI and the API are served **same-origin** from one Vercel project. If the
API is unreachable, the UI falls back to an on-device heuristic engine so a live
demo never breaks.

### Guardrails enforced in code, not just prompted

- **No composite score.** The data contract has no aggregate field, by design.
- **Risk & Contribution always route to a human.** Flagged server-side in
  `reviewGate.ts`, regardless of what the model returns.
- **Tags are grounded.** The model may only use dimensions, IRIS+ themes, SDG
  codes, and stakeholder areas from `taxonomy.json` — no invented labels.
- **Confidence is capped by maturity.** A concept-stage idea can only claim
  `hypothesis`; you can't declare Scale without evidence.

## Quickstart

```bash
git clone https://github.com/MaheshBhushan/claude-hackathon.git
cd claude-hackathon/backend
npm install
npm test                      # typecheck + 31 offline checks, no API key needed
```

Run against the real model:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npx vercel dev                # serves the UI at / and the API at /api/tag
```

> [!NOTE]
> `npm test` runs fully offline — the Anthropic client is injected, so no key or
> network is required to validate the whole pipeline. You only need a key to hit
> the live model via `vercel dev` or a deploy.

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

`toc` is optional; `maturity` is `concept` | `pilot` | `scale`. The response is a
validated `ImpactProfile` (schema in `backend/src/contract/schema.ts`).

| Status | Meaning |
|---|---|
| 200 | Valid `ImpactProfile` (`X-Tagging-Attempts` header: 1 = clean, 2 = repaired) |
| 400 | Body failed validation (`error.issues` lists the problems) |
| 405 | Method other than POST |
| 500 | Server missing `ANTHROPIC_API_KEY` |
| 502 | Model output failed the contract even after one repair |

## Repository structure

```
backend/
├── public/index.html         the web UI (same-origin with the API)
├── api/tag.ts                POST /api/tag — Vercel serverless handler
├── src/
│   ├── contract/             the shared data contract (source of truth)
│   │   ├── schema.ts             Zod schemas + TS types for ImpactProfile
│   │   ├── taxonomy.json         grounding vocabulary (IMP / IRIS+ / SDG / B-Lab)
│   │   └── contract.test.ts
│   ├── twin/                 the "twin core"
│   │   ├── prompt.ts             tagging prompt (system + user builder)
│   │   ├── tagProfile.ts         Anthropic call + validate/repair loop
│   │   └── reviewGate.ts         forces Risk/Contribution → human review
│   └── api/http.ts           CORS, typed errors, request validation
└── vercel.json               marks api/tag.ts as a 60s function
```

`schema.ts` is the single contract the API and the web UI both agree on — treat
it as frozen.

## Requirements

- Node 18+
- An Anthropic API key (only for the live model, not for tests)

## Contributors

- Harismitha Gogikar ([@missharismitha](https://github.com/missharismitha))
- Althaf ([@Althaf607](https://github.com/Althaf607))
- Md Nayeem ([@thelostbong](https://github.com/thelostbong))

## License

No license yet — add a `LICENSE` file (e.g. MIT) before reuse.
