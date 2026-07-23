/**
 * Twin-core tagging engine (T3.2).
 *
 * Runs the T3.1 prompt through `claude-opus-4-8`, extracts the JSON object from
 * the response, and validates it against the T1 `ImpactProfile` contract. On a
 * validation or parse failure it makes ONE repair attempt, feeding the model its
 * own bad output plus the specific validation errors, then re-validates.
 *
 * Why validate with Zod rather than `output_config.format`: the contract encodes
 * constraints structured outputs don't enforce (integer score range 0–4, and the
 * fixed-length-5 arrays for dimensions/toc/stakeholders). Zod is the authority,
 * so we parse-then-validate and repair, rather than trusting a constrained decode.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ImpactProfile } from "../contract/schema.js";
import type { FounderInput } from "./input.js";
import {
  TAGGING_SYSTEM_PROMPT,
  buildTaggingUserMessage,
} from "./prompt.js";

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 16000;

export interface TagResult {
  profile: ImpactProfile;
  /** Number of model calls made (1 = clean, 2 = one repair). */
  attempts: number;
}

/** Pulls the first top-level JSON object out of a model response string. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  // Strip accidental ```json fences if the model added them despite instructions.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response.");
  }
  return body.slice(start, end + 1);
}

/** Concatenates the text blocks of a message response. */
function responseText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Validate a raw model string against the contract. Returns the parsed profile
 * or a human-readable error string describing exactly what failed (fed back to
 * the model on the repair attempt).
 */
function validate(
  raw: string,
): { ok: true; profile: ImpactProfile } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(raw));
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }
  const result = ImpactProfile.safeParse(json);
  if (result.success) return { ok: true, profile: result.data };
  const issues = result.error.issues
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  return { ok: false, error: `Schema validation failed:\n${issues}` };
}

/**
 * Turn a founder submission into a validated ImpactProfile.
 *
 * @param client an initialized Anthropic client (inject for testability)
 * @param input  the founder submission (already schema-checked upstream)
 * @param now    ISO timestamp stamped onto the profile (defaults to now)
 */
export async function tagProfile(
  client: Anthropic,
  input: FounderInput,
  now: string = new Date().toISOString(),
): Promise<TagResult> {
  const userMessage = buildTaggingUserMessage(input, now);

  const first = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: TAGGING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const firstText = responseText(first);
  const firstCheck = validate(firstText);
  if (firstCheck.ok) return { profile: firstCheck.profile, attempts: 1 };

  // One repair attempt: show the model its output and the exact failures.
  const repair = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: TAGGING_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userMessage },
      { role: "user", content: firstText },
      {
        role: "user",
        content: `Your previous response did not satisfy the contract. Fix exactly these problems and return the corrected JSON object only — no prose, no fences:\n\n${firstCheck.error}`,
      },
    ],
  });

  const repairCheck = validate(responseText(repair));
  if (repairCheck.ok) return { profile: repairCheck.profile, attempts: 2 };

  throw new Error(
    `Tagging failed contract validation after repair.\n${repairCheck.error}`,
  );
}
