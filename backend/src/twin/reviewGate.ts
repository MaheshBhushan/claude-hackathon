/**
 * Review-gate enforcement (T4.3).
 *
 * The human-review gate is a product guardrail (PRD §9): the Risk and
 * Contribution dimensions must NEVER be presented as auto-scored - they always
 * route to a human. The prompt asks the model to do this, but a prompt is a
 * request, not a guarantee. This module enforces it deterministically in code,
 * after the model returns, so the invariant holds even if the model forgets:
 *
 *   1. Every dimension in HUMAN_REVIEW_DIMENSIONS gets `flaggedForReview: true`.
 *   2. `reviewFlags` contains a `pending` entry for each flagged dimension,
 *      synthesized from the dimension summary if the model didn't emit one.
 *
 * Idempotent: applying it twice yields the same profile.
 */

import {
  ImpactProfile,
  HUMAN_REVIEW_DIMENSIONS,
  type ReviewFlag,
  type ReviewFlagKind,
} from "../contract/schema.js";

/** Dimension keys that map 1:1 to a review-flag kind. */
const DIMENSION_TO_FLAG_KIND: Record<string, ReviewFlagKind> = {
  risk: "risk",
  contribution: "contribution",
};

export function enforceReviewGate(profile: ImpactProfile): ImpactProfile {
  const dimensions = profile.dimensions.map((d) =>
    HUMAN_REVIEW_DIMENSIONS.includes(d.dimension)
      ? { ...d, flaggedForReview: true }
      : d,
  );

  const flags: ReviewFlag[] = [...profile.reviewFlags];
  for (const dim of dimensions) {
    if (!HUMAN_REVIEW_DIMENSIONS.includes(dim.dimension)) continue;
    const kind = DIMENSION_TO_FLAG_KIND[dim.dimension];
    if (!kind) continue;
    // Ensure at least one pending flag exists for this dimension kind.
    if (!flags.some((f) => f.kind === kind)) {
      flags.push({
        kind,
        claim: dim.summary,
        status: "pending",
      });
    }
  }

  // Re-validate so a bug here can't emit an off-contract profile.
  return ImpactProfile.parse({ ...profile, dimensions, reviewFlags: flags });
}
