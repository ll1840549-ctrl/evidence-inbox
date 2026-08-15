import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { doctorWorkspace, listRecords, scanInbox, verifyRecords } from "../src/pipeline.js";
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

test("default scan accepts a file whose mtime is slightly in the future", async () => {
  const { root, paths } = await temporaryWorkspace();
  const filePath = path.join(paths.inbox, "future-mtime.txt");
  await writeFile(filePath, "会议纪要：参会人员确认议程和行动项。", "utf8");
  const future = new Date(Date.now() + 5000);
  await utimes(filePath, future, future);

  const [record] = await scanInbox(root);
  assert.equal(record.status, "processed");
});

test("positive stability window skips a young file and later accepts it", async () => {
  const { root, paths } = await temporaryWorkspace();
  const filePath = path.join(paths.inbox, "young-file.txt");
  await writeFile(filePath, "会议纪要：参会人员确认议程和行动项。", "utf8");

  assert.equal((await scanInbox(root, { minAgeMs: 1500 })).length, 0);
  const old = new Date(Date.now() - 2000);
  await utimes(filePath, old, old);
  const [record] = await scanInbox(root, { minAgeMs: 1500 });
  assert.equal(record.status, "processed");
});

for (const stage of ["claimed", "hashed", "stored", "recorded"]) {
  test(`recovers idempotently after interruption at ${stage}`, async () => {
    const { root, paths } = await temporaryWorkspace();
    await writeFile(
      path.join(paths.inbox, "recovery.txt"),
      "研究报告：行业分析、市场规模、竞争格局、投资逻辑与风险提示。",
      "utf8",
    );

    let interrupted = false;
    await assert.rejects(
      scanInbox(root, {
        onCheckpoint(current) {
          if (!interrupted && current === stage) {
            interrupted = true;
            throw new Error(`simulated interruption:${stage}`);
          }
        },
      }),
      new RegExp(`simulated interruption:${stage}`),
    );

    assert.equal((await readdir(paths.inbox)).length, 0);
    assert.equal((await readdir(paths.processing)).length, 1);
    assert.equal((await doctorWorkspace(root)).processing_jobs, 1);

    const recovered = await scanInbox(root);
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].status, "processed");
    assert.equal((await scanInbox(root)).length, 0);
    assert.equal((await readdir(paths.processing)).length, 0);

    const index = JSON.parse(await readFile(paths.index, "utf8"));
    assert.equal(index.records.length, 1);
    const audit = (await readFile(paths.audit, "utf8")).trim().split(/\r?\n/);
    assert.equal(audit.length, 1);
    assert.deepEqual((await verifyRecords(root)).map((item) => item.status), ["ok"]);
  });
}

test("cleans an empty abandoned job without losing the inbox file", async () => {
  const { root, paths } = await temporaryWorkspace();
  await mkdir(path.join(paths.processing, "empty-job"));
  await writeFile(
    path.join(paths.inbox, "still-here.txt"),
    "会议纪要：参会人员确认议程和行动项。",
    "utf8",
  );

  const [record] = await scanInbox(root);
  assert.equal(record.status, "processed");
  assert.equal((await readdir(paths.processing)).length, 0);
});

test("leaves a payload untouched when recovery metadata is invalid", async () => {
  const { root, paths } = await temporaryWorkspace();
  const jobDirectory = path.join(paths.processing, "invalid-job");
  await mkdir(jobDirectory);
  await writeFile(path.join(jobDirectory, "payload"), "do not delete", "utf8");
  await writeFile(path.join(jobDirectory, "job.json"), "{}", "utf8");

  await assert.rejects(scanInbox(root), /Invalid processing job metadata/);
  assert.equal(await readFile(path.join(jobDirectory, "payload"), "utf8"), "do not delete");
});
