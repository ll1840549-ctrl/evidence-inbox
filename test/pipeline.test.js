import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { listRecords, scanInbox, verifyRecords } from "../src/pipeline.js";
import { initWorkspace } from "../src/store.js";

async function temporaryWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "evidence-inbox-test-"));
  const paths = await initWorkspace(root);
  return { root, paths };
}

test("imports, classifies, records, and verifies a file", async () => {
  const { root, paths } = await temporaryWorkspace();
  await writeFile(
    path.join(paths.inbox, "任意名称.txt"),
    "研究报告：行业分析显示市场规模增长，但竞争格局和风险提示仍需关注。",
    "utf8",
  );

  const imported = await scanInbox(root);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].status, "processed");
  assert.equal(imported[0].classification.category, "research_report");
  assert.match(imported[0].sha256, /^[a-f0-9]{64}$/);

  const index = JSON.parse(await readFile(paths.index, "utf8"));
  assert.equal(index.records.length, 1);
  const verification = await verifyRecords(root);
  assert.deepEqual(verification.map((item) => item.status), ["ok"]);
});

test("moves repeated content to duplicate and links the original", async () => {
  const { root, paths } = await temporaryWorkspace();
  const content = "会议纪要：参会人员确认议程并列出待办事项与行动项。";
  await writeFile(path.join(paths.inbox, "first.txt"), content, "utf8");
  const [original] = await scanInbox(root);

  await writeFile(path.join(paths.inbox, "second.txt"), content, "utf8");
  const [duplicate] = await scanInbox(root);

  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.duplicate_of, original.id);
  assert.equal(duplicate.sha256, original.sha256);
  assert.equal((await listRecords(root)).length, 2);
});

test("routes unsupported formats to manual review", async () => {
  const { root, paths } = await temporaryWorkspace();
  await writeFile(path.join(paths.inbox, "scan.pdf"), Buffer.from("%PDF-example"));

  const [record] = await scanInbox(root);
  assert.equal(record.status, "needs_review");
  assert.equal(record.review_reason, "unsupported_extension:.pdf");
  assert.equal(record.classification.category, "unknown");
});

test("routes low-confidence text to manual review", async () => {
  const { root, paths } = await temporaryWorkspace();
  await writeFile(path.join(paths.inbox, "note.txt"), "普通文本，没有足够分类线索。", "utf8");

  const [record] = await scanInbox(root);
  assert.equal(record.status, "needs_review");
  assert.equal(record.review_reason, "low_classification_confidence");
});
