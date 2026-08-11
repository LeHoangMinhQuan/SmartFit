/**
 * scripts/smoke-test-chunking.ts
 *
 * Runtime smoke test for document_chunking.service.ts
 * (rag-document-upload-plan.md §4.2 step 4, configs from §4.6).
 *
 * Unlike smoke-test-extraction.ts, this module has zero external
 * dependencies (pure string manipulation) — no pdf-parse, no network, no
 * S3. Run it with: npx tsx scripts/smoke-test-chunking.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  chunkText,
  CHUNK_CONFIGS,
  type ChunkConfigName,
} from "../src/services/document_chunking.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else {
    failures++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function testSyntheticText() {
  console.log("\n[1] Synthetic 500-word text, all 4 configs");
  const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
  const text = words.join(" ");

  for (const name of Object.keys(CHUNK_CONFIGS) as ChunkConfigName[]) {
    const config = CHUNK_CONFIGS[name];
    const chunks = chunkText(text, name);
    console.log(`\n  Config ${name} (${config.label}): ${chunks.length} chunks`);

    check("produced at least 1 chunk", chunks.length > 0);
    check(
      "chunk_index is sequential from 0",
      chunks.every((c, i) => c.chunk_index === i),
    );
    check("no empty chunks", chunks.every((c) => c.content.trim().length > 0));

    const allOutputWords = chunks.flatMap((c) => c.content.split(" "));
    check(
      "every original word survives chunking",
      words.every((w) => allOutputWords.includes(w)),
    );

    if (chunks.length > 1) {
      const first = new Set(chunks[0]!.content.split(" "));
      const overlap = chunks[1]!.content
        .split(" ")
        .filter((w) => first.has(w));
      check("consecutive chunks overlap", overlap.length > 0, `got ${overlap.length}`);
    }
  }
}

function testShortText() {
  console.log("\n[2] Text shorter than one chunk");
  const shortText = "just a few words here";
  const chunks = chunkText(shortText, "B");
  check("produces exactly 1 chunk", chunks.length === 1, `got ${chunks.length}`);
  check("chunk content matches input exactly", chunks[0]?.content === shortText);
}

function testEmptyTextThrows() {
  console.log("\n[3] Whitespace-only text should throw");
  try {
    chunkText("   \n\t  ", "A");
    check("threw on empty input", false, "did not throw");
  } catch {
    check("threw on empty input", true);
  }
}

function testRealPolicyPdfText() {
  console.log("\n[4] Real extracted text from scripts/fixtures/test-policy.pdf");
  // Reuses the same real-PDF fixture as smoke-test-extraction.ts, but
  // reads its plain-text sibling if present (produced by `pdftotext`) so
  // this script doesn't need to depend on pdf-parse just to get sample
  // text — chunking and extraction are tested independently on purpose.
  const txtPath = path.join(__dirname, "fixtures", "test-policy.extracted.txt");
  if (!fs.existsSync(txtPath)) {
    console.log(
      `  (skipped — ${txtPath} not found; run ` +
        `\`pdftotext scripts/fixtures/test-policy.pdf scripts/fixtures/test-policy.extracted.txt\` ` +
        `once to generate it, or just rely on [1]-[3] above)`,
    );
    return;
  }
  const text = fs.readFileSync(txtPath, "utf-8");
  for (const name of Object.keys(CHUNK_CONFIGS) as ChunkConfigName[]) {
    const chunks = chunkText(text, name);
    check(
      `config ${name} produces a sane chunk count for an 864-word doc`,
      chunks.length > 0 && chunks.length < 100,
      `got ${chunks.length}`,
    );
  }
}

testSyntheticText();
testShortText();
testEmptyTextThrows();
testRealPolicyPdfText();

console.log(
  failures === 0
    ? "\n\x1b[32mAll checks passed.\x1b[0m"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m`,
);
process.exit(failures === 0 ? 0 : 1);
