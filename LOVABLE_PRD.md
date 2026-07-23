# PRD — Zollhof Impact Digital Twin (Frontend / Lovable)

**Build target:** Lovable (React + Tailwind, pure mock data)
**Scope:** Frontend only. No real backend, no auth, no live LLM calls. All screens render against hardcoded fixtures.
**Priority view:** Internal Zollhof coach dashboard.

---

## 1. Product summary

Zollhof is a no-equity startup incubator. This tool is an **impact "digital twin"** for each startup it incubates: instead of a single opaque impact score, it renders a **multi-dimensional Impact Profile** that Zollhof's coaching team uses for decision support and mentoring.

The profile is built from one sector-agnostic engine — the Impact Management Project's **five dimensions** (What, Who, How Much, Contribution, Risk) — fed by two input lenses:
1. **Mission-specific outcomes** — the startup's Theory of Change, tagged to IRIS+ themes and UN SDG targets.
2. **Broad stakeholder impact** — B Lab's five areas (governance, workers, community, environment, customers).

**Core principle, enforced in the UI:** never a single composite number, never a leaderboard. Comparison happens only at the taxonomy layer (themes/dimensions), never at raw KPIs.

---

## 2. Users & views

| View | User | Priority | Notes |
|---|---|---|---|
| **Internal coach dashboard** | Zollhof incubation team | **P0 (primary)** | Full profile: five-dim radar, stakeholder breakdown, per-claim confidence labels, human-review flags, maturity tier. |
| Founder intake (ToC form) | Startup founder | P1 | Multi-step form; on submit shows a pre-baked profile (mock). |
| Public widget (read-only) | Website visitors | P2 (stretch) | Qualitative narrative + theme tags + maturity badge only. **No number, no ranking.** |

---

## 3. Screens / routes

1. `/` — **Portfolio list.** Cards for 3 seeded demo startups + maturity badge + top theme tags. Entry to each twin.
2. `/startup/:id` — **Internal coach dashboard (P0).** The full Impact Profile. This is the hero screen.
3. `/intake` — **Founder ToC intake form (P1).** Multi-step. Submit → loading state → routes to a seeded profile.
4. `/startup/:id/public` — **Public widget preview (P2).** Stripped-down read-only card.

---

## 4. Internal coach dashboard — detailed layout (P0)

Single scrollable profile page, left-to-right / top-to-bottom:

**Header band**
- Startup name, sector, one-line mission.
- **Maturity badge** — Concept / Pilot / Scale (pill, color-coded: grey / amber / green).
- "Last re-evaluated" timestamp (mock).

**Section A — Five Dimensions engine (hero)**
- **Radar chart** across the 5 dimensions (What, Who, How Much, Contribution, Risk), each 0–4.
- Beside it, 5 rows — one per dimension — each showing the dimension label, a short LLM-generated summary sentence, and a **confidence pill**: `hypothesis` / `emerging` / `evidenced`.
- **Risk** and **Contribution** rows carry a **"⚑ Flagged for human review"** callout instead of pretending to be auto-scored.

**Section B — Mission outcomes (Theory of Change)**
- Horizontal ToC chain: Input → Activity → Output → Outcome → Impact (5 connected nodes).
- Outcome/Impact nodes show **theme chips**: mapped **IRIS+ themes** and **UN SDG target** badges.
- Vague/unscorable claims render a subtle **"needs sharpening"** marker.

**Section C — Broad stakeholder impact (B Lab areas)**
- Five horizontal bars: Governance, Workers, Community, Environment, Customers (0–4 each).
- Each with a one-line qualitative note.

**Section D — Human-review queue (inline)**
- List of flagged items (Risk-dimension flags + Contribution hypotheses) with status `Pending review`.
- Deliberately separated from the auto-generated content — this is a **gate, not a score**.

---

## 5. Founder intake form (P1)

Multi-step, minimal:
1. **Mission narrative** — freeform textarea ("Describe what your startup does and the change it aims to create").
2. **Theory of Change** — light structured fields: Input, Activity, Output, Outcome.
3. **Stage self-select** — Concept / Pilot / Scale.
4. **Submit** → mock "Generating your impact twin…" loading state (~2s) → redirect to a seeded `/startup/:id`.

No validation beyond required fields. The narrative is *not* actually processed — it maps to a pre-baked fixture.

---

## 6. Public widget preview (P2, stretch)

Read-only card: startup name, qualitative narrative paragraph, theme-tag chips, maturity badge. **Explicitly excludes** the radar, numeric scores, stakeholder bars, and any cross-startup comparison.

---

## 7. Mock data model (fixtures)

Ship **3 seeded startups** chosen to demonstrate sector-agnostic comparability:
- **VoltForge** — climate hardware (grid-scale battery).
- **Mindloop** — mental-health app.
- **Palleto** — B2B warehouse robotics (no headline social mission).

Each fixture conforms to:

```ts
type ConfidenceLabel = "hypothesis" | "emerging" | "evidenced";
type MaturityTier = "concept" | "pilot" | "scale";

interface DimensionTag {
  dimension: "what" | "who" | "howMuch" | "contribution" | "risk";
  score: number;            // 0–4
  summary: string;          // LLM-style one-liner
  confidence: ConfidenceLabel;
  flaggedForReview?: boolean; // true for risk/contribution
}

interface ToCNode {
  stage: "input" | "activity" | "output" | "outcome" | "impact";
  text: string;
  irisThemes?: string[];    // e.g. "Clean Energy"
  sdgTargets?: string[];    // e.g. "7.2"
  needsSharpening?: boolean;
}

interface StakeholderArea {
  area: "governance" | "workers" | "community" | "environment" | "customers";
  score: number;            // 0–4
  note: string;
}

interface ReviewFlag {
  kind: "risk" | "contribution";
  claim: string;
  status: "pending" | "cleared";
}

interface ImpactProfile {
  id: string;
  name: string;
  sector: string;
  mission: string;
  maturity: MaturityTier;
  lastEvaluated: string;
  dimensions: DimensionTag[];      // length 5
  toc: ToCNode[];                  // length 5
  stakeholders: StakeholderArea[]; // length 5
  reviewFlags: ReviewFlag[];
  publicNarrative: string;
  themeTags: string[];
}
```

---

## 8. Design direction — match the Zollhof brand

The frontend must visually match **zollhof.de**. It's a **Swiss/brutalist grid** aesthetic, not a soft SaaS dashboard. Reference the Zollhof homepage screenshot.

### 8.1 Design language (mirror the reference)
- **Grid-cell layout with hard black dividers.** The page is split into rectangular cells separated by **thick black borders (2–3px, `#000`)**. Sections butt up against each other — no rounded outer containers, no gaps, no soft drop-shadows.
- **Brutalist / Swiss-International.** Flat color blocks, hard edges, high contrast, confident whitespace inside each cell.
- **Pill buttons.** Fully-rounded (`rounded-full`) flat-color buttons with **black uppercase bold text**, no gradient, no shadow. (e.g. Apply-as-Startup red pill, Apply-as-Talent lime pill.)
- **Rotated vertical label accents** allowed (like the site's vertical "NEWSNEWS!" and "NEWSLETTER" text) — good for section spines.
- **No soft shadows / no glassmorphism.** Depth comes from borders and flat color blocks only.

### 8.2 Color tokens (sampled from zollhof.de)
| Token | Hex | Use |
|---|---|---|
| `black` | `#000000` | Text, dividers, borders, black pill/nav blocks |
| `white` | `#FFFFFF` | Primary background |
| `electric-blue` | `#1A16F0` | Primary accent, big color blocks ("Office Rental" circle, "Everything you heard…" block), primary CTA |
| `lime` | `#CDEE00` | Secondary CTA / highlight pills ("Apply as Talent", "Learn more") |
| `coral-red` | `#FD4A3E` | Alert / primary action pills ("Apply as Startup", "Send") |
| `soft-pink` | `#F4C9DA` | Section background wash (newsletter block), gentle "Join now" pill |
| `lavender` | `#B9A8F5` | Subtle gradient/accent (hero gradient) |

Base surface stays **white with black grid lines**. Dark mode is **not required** for brand match — drop it in favor of authentic light Zollhof styling.

### 8.3 Typography
- **Display / headings:** heavy **uppercase grotesque**, tight tracking (matches "WELCOME", "JOIN OUR INCUBATION PROGRAM"). Use a bold neo-grotesque — **Archivo Black / Space Grotesk (700) / Anton** as a close free substitute.
- **Body:** clean neutral sans (**Inter / Helvetica-like**), normal case.
- Headings are **big and confident**; don't be timid with size.

### 8.4 Mapping brand colors to our impact UI (keep semantics, reskin)
- **Confidence pills** → flat pill chips, black uppercase text:
  - `hypothesis` = white pill w/ black border · `emerging` = `lime` · `evidenced` = `electric-blue` (white text).
- **Maturity badge** → same pill treatment: `concept` = white/black-border · `pilot` = `lime` · `scale` = `electric-blue`.
- **Review flags (Risk / Contribution)** → `coral-red` pill/callout, black text — the loud attention color, matching the site's red action pills.
- **Section backgrounds** → alternate white and `soft-pink` washes across cells like the reference newsletter block.
- **Charts (`recharts`):** radar + horizontal bars drawn in **flat brand colors on white**, black axis lines/labels, **no gradients, no glow**.

### 8.5 Visual guardrail (unchanged)
Nowhere may the UI show an aggregate "overall score" number or a sorted ranking — the brutalist styling makes bold numbers tempting; keep them out.

---

## 9. Non-goals / guardrails (tell Lovable explicitly)

- ❌ No single composite / overall impact score, anywhere.
- ❌ No leaderboard or ranked sorting of startups.
- ❌ No real API calls, no auth, no database.
- ❌ Founder narrative is not actually analyzed — it maps to fixtures.
- ✅ Risk & Contribution are **flagged for humans**, never auto-scored.
- ✅ Comparison only at theme/dimension layer.

---

## 10. Backend seam (for later, not built here)

The mock fetch that produces a profile should be isolated in one module (e.g. `lib/getProfile.ts`) returning `Promise<ImpactProfile>`, so the real `POST /api/tag` Anthropic-backed endpoint drops in later without touching components.

---

## 11. Suggested Lovable build order (prompt sequence)

1. Scaffold app + routing + design tokens + the 3 mock `ImpactProfile` fixtures.
2. Build `/` portfolio list (cards + maturity badge + theme chips).
3. Build `/startup/:id` **internal dashboard** — Section A radar + dimension rows first (hero), then B, C, D.
4. Build `/intake` multi-step form + mock loading → redirect.
5. Build `/startup/:id/public` stripped widget.
6. Polish: dark mode, empty/loading states, responsive.
