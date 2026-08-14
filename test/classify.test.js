import assert from "node:assert/strict";
import test from "node:test";
import { classifyContent } from "../src/classify.js";

test("classifies Chinese financial content from content rather than filename", () => {
  const result = classifyContent(
    "本期营业收入增长，净利润与经营现金流同步改善，资产负债表保持稳健。",
    "random-name.txt",
  );
  assert.equal(result.category, "financial_report");
  assert.ok(result.confidence >= 0.55);
  assert.ok(result.matched_keywords.includes("营业收入"));
});

test("uses general for text without enough evidence", () => {
  const result = classifyContent("今天天气不错。", "财务报告.txt");
  assert.equal(result.category, "general");
  assert.equal(result.confidence, 0.25);
});

test("classifies bilingual meeting notes", () => {
  const result = classifyContent(
    "会议纪要：参会人员讨论了发布计划。Action items: update documentation.",
    "notes.md",
  );
  assert.equal(result.category, "meeting_notes");
});
