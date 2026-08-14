import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { classifyContent } from "./classify.js";
import { extractText } from "./extract.js";
import { addRecord, findOriginalByHash, initWorkspace, loadIndex } from "./store.js";
import {
  dateParts,
  fileAgeMs,
  moveFile,
  relativePortable,
  resolvePortable,
  safeName,
  sha256File,
} from "./utils.js";

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(fullPath)));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function destinationPath(base, classification, sha256, originalName, now) {
  const { year, month } = dateParts(now);
  const suffix = `${now.getTime().toString(36)}-${randomUUID().slice(0, 6)}`;
  return path.join(base, classification, year, month, `${sha256.slice(0, 12)}-${suffix}--${safeName(originalName)}`);
}

function makeId(prefix, sha256, now) {
  return `${prefix}-${sha256.slice(0, 12)}-${now.getTime().toString(36)}-${randomUUID().slice(0, 6)}`;
}

async function ingestFile(root, sourcePath, options = {}) {
  const paths = await initWorkspace(root);
  const now = options.now ?? new Date();
  const originalRelative = relativePortable(paths.inbox, sourcePath);
  const originalName = path.basename(sourcePath);
  const details = await stat(sourcePath);
  const sha256 = await sha256File(sourcePath);
  const original = await findOriginalByHash(root, sha256);

  if (original) {
    const destination = destinationPath(paths.duplicate, "duplicate", sha256, originalName, now);
    await moveFile(sourcePath, destination);
    return addRecord(
      root,
      {
        id: makeId("dup", sha256, now),
        sha256,
        original_name: originalName,
        original_inbox_path: originalRelative,
        stored_path: relativePortable(paths.root, destination),
        size_bytes: details.size,
        status: "duplicate",
        duplicate_of: original.id,
        classification: original.classification,
        imported_at: now.toISOString(),
      },
      "duplicate_detected",
    );
  }

  try {
    const extracted = await extractText(sourcePath);
    if (!extracted.supported) {
      const destination = destinationPath(paths.needs_review, "unsupported", sha256, originalName, now);
      await moveFile(sourcePath, destination);
      return addRecord(
        root,
        {
          id: makeId("review", sha256, now),
          sha256,
          original_name: originalName,
          original_inbox_path: originalRelative,
          stored_path: relativePortable(paths.root, destination),
          extension: extracted.extension,
          size_bytes: details.size,
          status: "needs_review",
          review_reason: extracted.reason,
          classification: { category: "unknown", confidence: 0, matched_keywords: [] },
          extracted_characters: 0,
          imported_at: now.toISOString(),
        },
        "manual_review_required",
      );
    }

    const classification = classifyContent(extracted.text, originalName);
    const requiresReview = classification.category === "general" || classification.confidence < 0.55;
    const base = requiresReview ? paths.needs_review : paths.processed;
    const destination = destinationPath(base, classification.category, sha256, originalName, now);
    await moveFile(sourcePath, destination);
    return addRecord(
      root,
      {
        id: makeId(requiresReview ? "review" : "doc", sha256, now),
        sha256,
        original_name: originalName,
        original_inbox_path: originalRelative,
        stored_path: relativePortable(paths.root, destination),
        extension: extracted.extension,
        size_bytes: details.size,
        status: requiresReview ? "needs_review" : "processed",
        review_reason: requiresReview ? "low_classification_confidence" : null,
        classification,
        extracted_characters: extracted.text.length,
        imported_at: now.toISOString(),
      },
      requiresReview ? "manual_review_required" : "file_processed",
    );
  } catch (error) {
    const destination = destinationPath(paths.failed, "failed", sha256, originalName, now);
    await moveFile(sourcePath, destination);
    return addRecord(
      root,
      {
        id: makeId("failed", sha256, now),
        sha256,
        original_name: originalName,
        original_inbox_path: originalRelative,
        stored_path: relativePortable(paths.root, destination),
        size_bytes: details.size,
        status: "failed",
        error: error.message,
        imported_at: now.toISOString(),
      },
      "processing_failed",
    );
  }
}

export async function scanInbox(root, options = {}) {
  const paths = await initWorkspace(root);
  const minAgeMs = options.minAgeMs ?? 0;
  const files = await listFiles(paths.inbox);
  const records = [];
  for (const filePath of files) {
    if ((await fileAgeMs(filePath)) < minAgeMs) continue;
    records.push(await ingestFile(root, filePath, options));
  }
  return records;
}

export async function listRecords(root, filter = {}) {
  const { index } = await loadIndex(root);
  const records = filter.status
    ? index.records.filter((record) => record.status === filter.status)
    : index.records;
  return [...records].reverse();
}

export async function verifyRecords(root) {
  const { paths, index } = await loadIndex(root);
  const results = [];
  for (const record of index.records) {
    if (record.status === "duplicate") continue;
    const filePath = resolvePortable(paths.root, record.stored_path);
    try {
      const actual = await sha256File(filePath);
      results.push({
        id: record.id,
        status: actual === record.sha256 ? "ok" : "changed",
        expected_sha256: record.sha256,
        actual_sha256: actual,
      });
    } catch (error) {
      results.push({ id: record.id, status: "missing", error: error.code ?? error.message });
    }
  }
  return results;
}

export async function doctorWorkspace(root) {
  try {
    const { paths, index } = await loadIndex(root);
    return {
      healthy: true,
      root: paths.root,
      records: index.records.length,
      version: index.version,
    };
  } catch (error) {
    return { healthy: false, root: path.resolve(root), error: error.message };
  }
}
