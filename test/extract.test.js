import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { extractText } from "../src/extract.js";

async function temporaryFile(name, content) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "evidence-inbox-extract-"));
  const filePath = path.join(directory, name);
  await writeFile(filePath, content);
  return filePath;
}

test("extracts visible HTML text and removes active content", async () => {
  const filePath = await temporaryFile(
    "sample.html",
    "<style>.hidden{display:none}</style><h1>Research &amp; Notes</h1><script>alert(1)</script><p>market size</p>",
  );
  const result = await extractText(filePath);
  assert.equal(result.supported, true);
  assert.equal(result.text, "Research & Notes market size");
});

test("normalizes valid JSON and rejects invalid JSON", async () => {
  const valid = await temporaryFile("valid.json", '{"name":"demo","count":2}');
  const invalid = await temporaryFile("invalid.json", "{not-json}");
  assert.match((await extractText(valid)).text, /\n  "count": 2\n/);
  assert.equal((await extractText(invalid)).reason, "invalid_json");
});

test("detects binary and oversized text input", async () => {
  const binary = await temporaryFile("binary.txt", Buffer.from([65, 0, 66]));
  const oversized = await temporaryFile("large.txt", Buffer.alloc(5 * 1024 * 1024 + 1, 65));
  assert.equal((await extractText(binary)).reason, "binary_content_detected");
  assert.match((await extractText(oversized)).reason, /^text_file_too_large:/);
});

test("uses the original file name while reading a staged payload", async () => {
  const payload = await temporaryFile("payload", "会议纪要：参会人员、议程和行动项。");
  const result = await extractText(payload, { fileName: "notes.txt" });
  assert.equal(result.supported, true);
  assert.equal(result.extension, ".txt");
});
