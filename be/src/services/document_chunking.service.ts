/**
 * services/document_chunking.service.ts
 *
 * Fixed-size chunking with overlap for the RAG document upload feature
 * (rag-document-upload-plan.md §4.2 step 4, configs from §4.6).
 *
 * Chunk size/overlap are expressed in the plan (and the cited literature)
 * as TOKEN counts, but this project has no tokenizer dependency and
 * adding one just to size chunks isn't worth it — Gemini doesn't ship an
 * offline JS tokenizer, and a GPT-family tokenizer (e.g. tiktoken) would
 * count differently for Gemini's own tokenization anyway, so exactness
 * there would be a false precision. Word count is used as an approximate
 * proxy instead, via WORDS_PER_TOKEN below — reasonable for sizing
 * purposes since the candidates in §4.6 are being compared against each
 * other empirically (§16), not held to an exact literature-matched token
 * count.
 */

export type ChunkConfigName = "A" | "B" | "C" | "D";

export interface ChunkConfig {
  name: ChunkConfigName;
  label: string;
  chunkSizeTokens: number;
  overlapRatio: number; // fraction of chunkSizeTokens, e.g. 0.1 = 10%
}

// Straight from plan §4.6's table — kept in the same order/labels as the
// plan so a candidate test run (§16) can log "config B" and mean the same
// thing here as in the doc.
export const CHUNK_CONFIGS: Record<ChunkConfigName, ChunkConfig> = {
  A: {
    name: "A",
    label: "Fact-precise",
    chunkSizeTokens: 128,
    overlapRatio: 0.1,
  },
  B: { name: "B", label: "Balanced", chunkSizeTokens: 256, overlapRatio: 0.2 },
  C: {
    name: "C",
    label: "Context-rich",
    chunkSizeTokens: 512,
    overlapRatio: 0.15,
  },
  D: {
    name: "D",
    label: "High-overlap variant of A",
    chunkSizeTokens: 128,
    overlapRatio: 0.5,
  },
};

// Rough English-text approximation (~4 characters/token, ~5.3
// characters/word => ~0.75 words/token). This is a sizing heuristic, not
// a tokenizer — see module doc comment above. Vietnamese text (relevant
// for this store's actual policy documents) tends to run shorter per
// "word" since syllables are space-separated, so real Vietnamese chunks
// will likely land smaller-in-tokens than this ratio assumes; that's a
// known approximation gap to revisit if §16's candidate testing shows
// systematically undersized or oversized chunks for the real documents.
const WORDS_PER_TOKEN = 0.75;

// PLACEHOLDER pending §16/§17 (empirical candidate testing) — "Balanced"
// is used as the provisional default because it's the literature's own
// hedge ("middle ground... for policy sections that span more than one
// short sentence"), not because it's been measured against this
// project's actual documents yet. Whichever admin route calls chunkText
// should treat this as swappable, not final.
export const DEFAULT_CHUNK_CONFIG: ChunkConfigName = "B";

export interface DocumentChunk {
  content: string;
  chunk_index: number;
}

/**
 * Splits normalized document text into overlapping fixed-size chunks.
 * Word-boundary splitting (never mid-word) using whitespace as the
 * delimiter — content is expected to already be normalized/trimmed by
 * document_extraction.service.ts before reaching here.
 */
export function chunkText(
  text: string,
  configName: ChunkConfigName = DEFAULT_CHUNK_CONFIG,
): DocumentChunk[] {
  const config = CHUNK_CONFIGS[configName];
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    // Extraction already guarantees non-trivial text (see
    // MIN_EXTRACTED_TEXT_LENGTH), so this would only happen on a caller
    // bypassing that guarantee — fail loud rather than silently return
    // zero chunks for a "successfully indexed" document.
    throw new Error("chunkText: input text has no content to chunk");
  }

  const chunkSizeWords = Math.max(
    1,
    Math.round(config.chunkSizeTokens * WORDS_PER_TOKEN),
  );
  const overlapWords = Math.round(chunkSizeWords * config.overlapRatio);
  // stride is how far the window advances each step. overlapRatio is
  // defined as a fraction of chunk size (never >= 1 across all four
  // configs — max is D's 0.5), so this is always positive, but guarded
  // explicitly since an infinite loop from a bad config would be a much
  // worse failure mode than a clear thrown error.
  const stride = chunkSizeWords - overlapWords;
  if (stride <= 0) {
    throw new Error(
      `chunkText: overlapRatio ${config.overlapRatio} for config ${configName} leaves no forward progress (stride <= 0)`,
    );
  }

  const chunks: DocumentChunk[] = [];
  for (
    let start = 0, chunk_index = 0;
    start < words.length;
    start += stride, chunk_index++
  ) {
    const slice = words.slice(start, start + chunkSizeWords);
    chunks.push({ content: slice.join(" "), chunk_index });

    // Reached (or overshot) the end with this window — stop rather than
    // emit a trailing near-duplicate/empty chunk on the next stride step.
    if (start + chunkSizeWords >= words.length) break;
  }

  return chunks;
}
