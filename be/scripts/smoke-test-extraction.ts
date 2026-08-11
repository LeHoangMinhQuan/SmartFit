/**
 * scripts/smoke-test-extraction.ts
 *
 * Runtime smoke test for document_extraction.service.ts
 * (rag-document-upload-plan.md §4.2, step 3).
 *
 * Exercises the real service against real files — no hand-rolled PDF
 * bytes. A previous attempt at this hand-assembled a raw PDF (its own
 * xref table + /Length values) and chased a string of resulting bugs
 * (stream length mismatch, corrupted xref offsets) that turned out to be
 * bugs in that hand-rolled fixture, not in the extraction service or in
 * pdf-parse/pdfjs-dist. Using `scripts/fixtures/test-policy.pdf` (a real
 * 5-page PDF exported from a browser) sidesteps that whole class of
 * problem — it's already spec-valid because a real PDF writer produced
 * it, not a script assembling bytes by hand.
 *
 * Run with: npx tsx scripts/smoke-test-extraction.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  extractDocumentText,
  DocumentExtractionError,
} from "../src/services/document_extraction.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

let failures = 0;

function pass(label: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
}
function fail(label: string, detail?: string) {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
}

async function testRealPdf() {
  console.log("\n[1] Real text-bearing PDF (test-policy.pdf)");
  const buffer = fs.readFileSync(path.join(FIXTURES, "test-policy.pdf"));
  try {
    const text = await extractDocumentText(
      buffer,
      "application/pdf",
      "test-policy.pdf",
    );
    text.length > 500
      ? pass(`extracted ${text.length} chars`)
      : fail("extracted text suspiciously short", `${text.length} chars`);

    // Content assertions against known text from the source PDF — not
    // just "did it throw", but "did it get the right content".
    const mustContain = [
      "Longan Detection App",
      "Camera Permission",
      "Google Cloud Storage",
      "quanb2206008@student.ctu.edu.vn",
    ];
    for (const needle of mustContain) {
      text.includes(needle)
        ? pass(`contains "${needle}"`)
        : fail(`missing expected text`, `"${needle}"`);
    }
  } catch (err) {
    fail(
      "threw unexpectedly",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function testPlainText() {
  console.log("\n[2] Plain text file (test-plain.txt)");
  const buffer = fs.readFileSync(path.join(FIXTURES, "test-plain.txt"));
  try {
    const text = await extractDocumentText(
      buffer,
      "text/plain",
      "test-plain.txt",
    );
    text.includes("Longan Detection App")
      ? pass("extracted plain text content correctly")
      : fail("plain text content wrong", text.slice(0, 50));
  } catch (err) {
    fail(
      "threw unexpectedly",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function testEmptyFile() {
  console.log(
    "\n[3] Empty file (test-empty.txt) — should THROW DocumentExtractionError",
  );
  const buffer = fs.readFileSync(path.join(FIXTURES, "test-empty.txt"));
  try {
    await extractDocumentText(buffer, "text/plain", "test-empty.txt");
    fail("did not throw — empty file was accepted");
  } catch (err) {
    err instanceof DocumentExtractionError
      ? pass(`correctly threw DocumentExtractionError: "${err.message}"`)
      : fail(
          "threw the wrong error type",
          err instanceof Error ? err.constructor.name : String(err),
        );
  }
}

async function testMalformedPdf() {
  console.log(
    "\n[4] Garbage bytes with a .pdf name — should THROW cleanly, not crash the process",
  );
  const buffer = Buffer.from("this is not a pdf at all, just text bytes");
  try {
    await extractDocumentText(buffer, "application/pdf", "fake.pdf");
    fail("did not throw — garbage bytes were accepted as a PDF");
  } catch (err) {
    err instanceof DocumentExtractionError
      ? pass(`correctly threw DocumentExtractionError: "${err.message}"`)
      : fail(
          "threw the wrong error type (or crashed uncaught)",
          err instanceof Error ? err.constructor.name : String(err),
        );
  }
}

async function main() {
  await testRealPdf();
  await testPlainText();
  await testEmptyFile();
  await testMalformedPdf();

  console.log(
    failures === 0
      ? "\n\x1b[32mAll checks passed.\x1b[0m"
      : `\n\x1b[31m${failures} check(s) failed.\x1b[0m`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
