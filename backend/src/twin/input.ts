/**
 * FounderInput (T3) - the raw intake payload the frontend posts to `/api/tag`.
 * Deliberately light: a freeform narrative plus optional structured ToC hints
 * and a self-selected maturity tier. The twin core turns this into a full
 * `ImpactProfile`.
 */

import { z } from "zod";
import { MaturityTier } from "../contract/schema.js";

export const FounderInput = z.object({
  /** Startup name. */
  name: z.string().min(1),
  /** Sector / domain in the founder's own words (e.g. "Climate hardware"). */
  sector: z.string().min(1),
  /** Freeform description of what the startup does and the change it seeks. */
  narrative: z.string().min(1),
  /** Optional structured Theory-of-Change hints; the LLM fills gaps. */
  toc: z
    .object({
      input: z.string().optional(),
      activity: z.string().optional(),
      output: z.string().optional(),
      outcome: z.string().optional(),
      impact: z.string().optional(),
    })
    .partial()
    .optional(),
  /** Founder-selected stage; gates how much confidence the tagger may assign. */
  maturity: MaturityTier,
});

export type FounderInput = z.infer<typeof FounderInput>;
