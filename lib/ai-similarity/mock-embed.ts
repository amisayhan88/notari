/**
 * Deterministic lexical embedder used as the zero-config fallback when no
 * embedding API key is configured, and as the fixed oracle for tests.
 *
 * Hashed bag-of-words into a fixed number of buckets, L2-normalized.
 * Two texts with mostly the same words get a high cosine similarity;
 * unrelated texts stay low. It is NOT a semantic embedder — real
 * deployments should configure an OpenAI-compatible embeddings endpoint.
 */

const DIM = 256;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "in", "is", "it", "its", "of", "on", "or", "our", "that",
  "the", "their", "them", "this", "to", "was", "we", "were", "will",
  "with", "you", "your", "using", "uses", "use", "can", "into",
]);

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function mockEmbed(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    vec[fnv1a(token) % DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // inputs are L2-normalized by construction in this module
}

export const MOCK_EMBED_DIM = DIM;
