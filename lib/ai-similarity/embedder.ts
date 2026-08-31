/**
 * Provider-agnostic embeddings.
 *
 * - "openai-compatible": any OpenAI-shaped /embeddings endpoint (OpenAI,
 *   Qwen via DashScope/ModelScope, Ollama, OpenRouter…). Configure via
 *   EMBEDDINGS_API_URL / EMBEDDINGS_API_KEY / EMBEDDINGS_MODEL.
 * - "mock": deterministic lexical fallback so the app runs out of the box
 *   and tests stay hermetic. Clearly labeled in every result.
 */

import { mockEmbed, MOCK_EMBED_DIM } from "./mock-embed";

export interface Embedder {
  name: string;
  embed(texts: string[]): Promise<number[][]>;
}

function openAiCompatibleEmbedder(
  url: string,
  apiKey: string,
  model: string,
): Embedder {
  return {
    name: "openai-compatible",
    async embed(texts: string[]) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: texts }),
      });
      if (!res.ok) {
        throw new Error(`Embeddings API ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };
      return json.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    },
  };
}

const mockEmbedder: Embedder = {
  name: "mock",
  async embed(texts: string[]) {
    return texts.map(mockEmbed);
  },
};

export function getEmbedder(): Embedder {
  const url = process.env.EMBEDDINGS_API_URL;
  const key = process.env.EMBEDDINGS_API_KEY;
  if (url && key) {
    return openAiCompatibleEmbedder(
      url,
      key,
      process.env.EMBEDDINGS_MODEL || "text-embedding-3-small",
    );
  }
  return mockEmbedder;
}

export { MOCK_EMBED_DIM };
