/**
 * "Why flagged" explanation — ADVISORY text shown to teams and organizers.
 *
 * Providers:
 * - openai-compatible chat endpoint (LLM_API_URL / LLM_API_KEY / LLM_MODEL)
 * - Anthropic Messages API (ANTHROPIC_API_KEY / ANTHROPIC_MODEL)
 * - template fallback when no key is configured (clearly labeled)
 */

import type { SimilarityMatch } from "./types";

export interface ExplainerResult {
  explanation: string;
  provider: string;
}

const TEMPLATE = (matches: SimilarityMatch[]): string => {
  const top = matches[0];
  const others =
    matches.length > 1
      ? ` ${matches.length - 1} other historical submission${
          matches.length > 2 ? "s" : ""
        } also cleared the threshold.`
      : "";
  return (
    `This submission is ${(top.score * 100).toFixed(0)}% similar to a ` +
    `submission previously recorded at "${top.eventId}" under a different ` +
    `team wallet (${top.teamWallet.slice(0, 8)}…). The project descriptions ` +
    `overlap heavily, which suggests the same project may have been ` +
    `resubmitted.${others} This flag is advisory — an organizer reviews it ` +
    `before any decision is made.`
  );
};

function buildPrompt(description: string, matches: SimilarityMatch[]): string {
  const list = matches
    .map(
      (m, i) =>
        `${i + 1}. score=${(m.score * 100).toFixed(0)}% event="${m.eventId}" ` +
        `team=${m.teamWallet.slice(0, 8)}… description="${m.description.slice(0, 300)}"`,
    )
    .join("\n");
  return (
    `You review hackathon submissions for possible resubmission.\n` +
    `NEW submission description: """${description.slice(0, 1200)}"""\n\n` +
    `Closest historical matches from OTHER events:\n${list}\n\n` +
    `Write 2-3 plain sentences explaining why this was flagged, citing the ` +
    `similarity percentage and the event names. Note that it is advisory and ` +
    `an organizer makes the final decision.`
  );
}

async function openAiCompatible(
  description: string,
  matches: SimilarityMatch[],
): Promise<ExplainerResult> {
  const res = await fetch(process.env.LLM_API_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a hackathon integrity reviewer." },
        { role: "user", content: buildPrompt(description, matches) },
      ],
      max_tokens: 300,
    }),
  });
  if (!res.ok) throw new Error(`LLM API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return {
    explanation: json.choices[0]?.message?.content?.trim() ?? "",
    provider: "openai-compatible",
  };
}

async function anthropic(
  description: string,
  matches: SimilarityMatch[],
): Promise<ExplainerResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: "You are a hackathon integrity reviewer.",
      messages: [{ role: "user", content: buildPrompt(description, matches) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  return {
    explanation:
      json.content.find((c) => c.type === "text")?.text.trim() ?? "",
    provider: "anthropic",
  };
}

export async function explainFlag(
  description: string,
  matches: SimilarityMatch[],
): Promise<ExplainerResult> {
  if (matches.length === 0) {
    return { explanation: "", provider: "none" };
  }
  try {
    if (process.env.LLM_API_URL && process.env.LLM_API_KEY) {
      return await openAiCompatible(description, matches);
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return await anthropic(description, matches);
    }
  } catch {
    // Fall through to the template so a provider outage never breaks the
    // review queue.
  }
  return { explanation: TEMPLATE(matches), provider: "template" };
}
