/**
 * Zollhof Impact Digital Twin - authoritative data contract (T1).
 *
 * This is the SINGLE SOURCE OF TRUTH for the `ImpactProfile` object that the
 * `POST /api/tag` endpoint returns and that the Lovable/Vercel frontend renders.
 * It must stay in lockstep with `LOVABLE_PRD.md §7`.
 *
 * Zod gives us runtime validation (used by the twin core + API to reject
 * malformed LLM output) and, via `z.infer`, the static TS types the rest of the
 * backend imports. A pure JSON-Schema mirror is emitted by `emit-json-schema.ts`
 * for consumers that can't import Zod (frontend tooling, docs).
 *
 * Guardrails encoded here (see PRD §9):
 *   - No aggregate / composite "overall score" field exists. By design.
 *   - Risk & Contribution dimensions carry `flaggedForReview` (enforced true
 *     server-side in T4.3, independent of what the LLM returns).
 */

import { z } from "zod";

/** 0-4 integer scale shared by dimension and stakeholder scores. */
export const Score = z.number().int().min(0).max(4);

export const ConfidenceLabel = z.enum(["hypothesis", "emerging", "evidenced"]);

export const MaturityTier = z.enum(["concept", "pilot", "scale"]);

export const DimensionKey = z.enum([
  "what",
  "who",
  "howMuch",
  "contribution",
  "risk",
]);

export const StakeholderAreaKey = z.enum([
  "governance",
  "workers",
  "community",
  "environment",
  "customers",
]);

export const ToCStage = z.enum([
  "input",
  "activity",
  "output",
  "outcome",
  "impact",
]);

export const ReviewFlagKind = z.enum(["risk", "contribution"]);
export const ReviewFlagStatus = z.enum(["pending", "cleared"]);

/** One of the five Impact Management Project dimensions, as scored/tagged. */
export const DimensionTag = z.object({
  dimension: DimensionKey,
  score: Score,
  summary: z.string().min(1), // LLM-style one-liner
  confidence: ConfidenceLabel,
  /**
   * Routes this claim to the human-review gate. Always true for `risk` and
   * `contribution` (enforced in T4.3); optional/false for the other three.
   */
  flaggedForReview: z.boolean().optional(),
});

/** A node in the founder's Theory of Change chain. */
export const ToCNode = z.object({
  stage: ToCStage,
  text: z.string().min(1),
  irisThemes: z.array(z.string()).optional(), // e.g. "Clean Energy"
  sdgTargets: z.array(z.string()).optional(), // e.g. "7.2"
  needsSharpening: z.boolean().optional(), // vague/unscorable claim
});

/** One B Lab stakeholder area. */
export const StakeholderArea = z.object({
  area: StakeholderAreaKey,
  score: Score,
  note: z.string().min(1),
});

/** An item routed to the human-review queue (Risk / Contribution gate). */
export const ReviewFlag = z.object({
  kind: ReviewFlagKind,
  claim: z.string().min(1),
  status: ReviewFlagStatus,
});

/**
 * The full Impact Profile - the object returned by `POST /api/tag`.
 *
 * Fixed-length tuples of 5 for `dimensions`, `toc`, and `stakeholders` are
 * intentional: the five IMP dimensions, the five ToC stages, and the five B Lab
 * areas are each a complete, fixed set. Missing or extra entries are a contract
 * violation, not a valid partial.
 */
export const ImpactProfile = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sector: z.string().min(1),
  mission: z.string().min(1),
  maturity: MaturityTier,
  lastEvaluated: z.string().min(1), // ISO-8601 timestamp
  dimensions: z.array(DimensionTag).length(5),
  toc: z.array(ToCNode).length(5),
  stakeholders: z.array(StakeholderArea).length(5),
  reviewFlags: z.array(ReviewFlag),
  publicNarrative: z.string().min(1),
  themeTags: z.array(z.string()),
});

// ---- Inferred static types (import these across the backend) ----------------

export type Score = z.infer<typeof Score>;
export type ConfidenceLabel = z.infer<typeof ConfidenceLabel>;
export type MaturityTier = z.infer<typeof MaturityTier>;
export type DimensionKey = z.infer<typeof DimensionKey>;
export type StakeholderAreaKey = z.infer<typeof StakeholderAreaKey>;
export type ToCStage = z.infer<typeof ToCStage>;
export type ReviewFlagKind = z.infer<typeof ReviewFlagKind>;
export type ReviewFlagStatus = z.infer<typeof ReviewFlagStatus>;
export type DimensionTag = z.infer<typeof DimensionTag>;
export type ToCNode = z.infer<typeof ToCNode>;
export type StakeholderArea = z.infer<typeof StakeholderArea>;
export type ReviewFlag = z.infer<typeof ReviewFlag>;
export type ImpactProfile = z.infer<typeof ImpactProfile>;

// ---- Canonical key ordering (useful for prompts + UI iteration) -------------

export const DIMENSION_ORDER: DimensionKey[] = [
  "what",
  "who",
  "howMuch",
  "contribution",
  "risk",
];

export const TOC_ORDER: ToCStage[] = [
  "input",
  "activity",
  "output",
  "outcome",
  "impact",
];

export const STAKEHOLDER_ORDER: StakeholderAreaKey[] = [
  "governance",
  "workers",
  "community",
  "environment",
  "customers",
];

/** Dimensions that must always route to the human-review gate. */
export const HUMAN_REVIEW_DIMENSIONS: DimensionKey[] = ["risk", "contribution"];
