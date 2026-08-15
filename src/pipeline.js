import { randomUUID } from "node:crypto";
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { classifyContent } from "./classify.js";
import { extractText } from "./extract.js";
import { addRecord, findOriginalByHash, initWorkspace, loadIndex } from "./store.js";
import {
  atomicWriteJson,
  dateParts,
  ensureDir,
  fileAgeMs,
  moveFile,
  pathExists,
  readJson,
  relativePortable,
  resolvePortable,
  safeName,
  sha256File,
} from "./utils.js";

const PROCESSING_JOB_VERSION = 1;

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

function destinationPath(base, classification, sha256, originalName, now, jobId) {
  const { year, month } = dateParts(now);
  const suffix = `${now.getTime().toString(36)}-${jobId.slice(-12)}`;
  return path.join(base, classification, year, month, `${sha256.slice(0, 12)}-${suffix}--${safeName(originalName)}`);
}

function makeId(prefix, sha256, jobId) {
  return `${prefix}-${sha256.slice(0, 12)}-${jobId}`;
}

async function checkpoint(options, stage, context) {
  if (options.onCheckpoint) await options.onCheckpoint(stage, context);
}

function processingPaths(paths, jobId) {
  const directory = path.join(paths.processing, jobId);
  return {
    directory,
    metadata: path.join(directory, "job.json"),
    payload: path.join(directory, "payload"),
  };
}

function validateJob(paths, job) {
  const valid =
    job &&
    job.version === PROCESSING_JOB_VERSION &&
    typeof job.id === "string" &&
    path.basename(job.id) === job.id &&
    typeof job.original_name === "string" &&
    typeof job.original_inbox_path === "string" &&
    typeof job.claimed_at === "string" &&
    Number.isFinite(Date.parse(job.claimed_at));
  if (!valid) throw new Error("Invalid processing job metadata");
  if (
    job.record &&
    (typeof job.event !== "string" ||
      typeof job.record.id !== "string" ||
      typeof job.record.sha256 !== "string" ||
      typeof job.record.stored_path !== "string")
  ) {
    throw new Error("Invalid prepared processing job");
  }
  resolvePortable(paths.inbox, job.original_inbox_path);
  return job;
}

async function saveJob(jobPaths, job) {
  await atomicWriteJson(jobPaths.metadata, job);
  return job;
}

async function claimFile(paths, sourcePath, options) {
  const now = options.now ?? new Date();
  const jobId = `${now.getTime().toString(36)}-${randomUUID().slice(0, 12)}`;
  const locations = processingPaths(paths, jobId);
  const job = {
    version: PROCESSING_JOB_VERSION,
    id: jobId,
    state: "claiming",
    original_name: path.basename(sourcePath),
    original_inbox_path: relativePortable(paths.inbox, sourcePath),
    claimed_at: now.toISOString(),
  };

  await ensureDir(locations.directory);
  await saveJob(locations, job);
  try {
    await moveFile(sourcePath, locations.payload);
  } catch (error) {
    await rm(locations.directory, { recursive: true, force: true });
    throw error;
  }

  job.state = "claimed";
  await saveJob(locations, job);
  await checkpoint(options, "claimed", { job, paths: locations });
  return { job, locations };
}

function recordForDuplicate(paths, job, sha256, details, original, now) {
  const destination = destinationPath(paths.duplicate, "duplicate", sha256, job.original_name, now, job.id);
  return {
    event: "duplicate_detected",
    record: {
      id: makeId("dup", sha256, job.id),
      sha256,
      original_name: job.original_name,
      original_inbox_path: job.original_inbox_path,
      stored_path: relativePortable(paths.root, destination),
      size_bytes: details.size,
      status: "duplicate",
      duplicate_of: original.id,
      classification: original.classification,
      imported_at: now.toISOString(),
    },
  };
}

function recordForUnsupported(paths, job, sha256, details, extracted, now) {
  const destination = destinationPath(paths.needs_review, "unsupported", sha256, job.original_name, now, job.id);
  return {
    event: "manual_review_required",
    record: {
      id: makeId("review", sha256, job.id),
      sha256,
      original_name: job.original_name,
      original_inbox_path: job.original_inbox_path,
      stored_path: relativePortable(paths.root, destination),
      extension: extracted.extension,
      size_bytes: details.size,
      status: "needs_review",
      review_reason: extracted.reason,
      classification: { category: "unknown", confidence: 0, matched_keywords: [] },
      extracted_characters: 0,
      imported_at: now.toISOString(),
    },
  };
}

function recordForText(paths, job, sha256, details, extracted, now) {
  const classification = classifyContent(extracted.text, job.original_name);
  const requiresReview = classification.category === "general" || classification.confidence < 0.55;
  const base = requiresReview ? paths.needs_review : paths.processed;
  const destination = destinationPath(base, classification.category, sha256, job.original_name, now, job.id);
  return {
    event: requiresReview ? "manual_review_required" : "file_processed",
    record: {
      id: makeId(requiresReview ? "review" : "doc", sha256, job.id),
      sha256,
      original_name: job.original_name,
      original_inbox_path: job.original_inbox_path,
      stored_path: relativePortable(paths.root, destination),
      extension: extracted.extension,
      size_bytes: details.size,
      status: requiresReview ? "needs_review" : "processed",
      review_reason: requiresReview ? "low_classification_confidence" : null,
      classification,
      extracted_characters: extracted.text.length,
      imported_at: now.toISOString(),
    },
  };
}

function recordForFailure(paths, job, sha256, details, error, now) {
  const destination = destinationPath(paths.failed, "failed", sha256, job.original_name, now, job.id);
  return {
    event: "processing_failed",
    record: {
      id: makeId("failed", sha256, job.id),
      sha256,
      original_name: job.original_name,
      original_inbox_path: job.original_inbox_path,
      stored_path: relativePortable(paths.root, destination),
      size_bytes: details.size,
      status: "failed",
      error: error.message,
      imported_at: now.toISOString(),
    },
  };
}

async function prepareJob(root, paths, locations, job, options) {
  const now = new Date(job.claimed_at);
  const details = await stat(locations.payload);
  const sha256 = await sha256File(locations.payload);
  await checkpoint(options, "hashed", { job, sha256, paths: locations });
  const original = await findOriginalByHash(root, sha256);
  let prepared;

  if (original) {
    prepared = recordForDuplicate(paths, job, sha256, details, original, now);
  } else {
    try {
      const extracted = await extractText(locations.payload, { fileName: job.original_name });
      prepared = extracted.supported
        ? recordForText(paths, job, sha256, details, extracted, now)
        : recordForUnsupported(paths, job, sha256, details, extracted, now);
    } catch (error) {
      prepared = recordForFailure(paths, job, sha256, details, error, now);
    }
  }

  const updated = {
    ...job,
    state: "prepared",
    sha256,
    event: prepared.event,
    record: prepared.record,
  };
  await saveJob(locations, updated);
  await checkpoint(options, "prepared", { job: updated, paths: locations });
  return updated;
}

async function finalizeJob(root, paths, locations, job, options) {
  const destination = resolvePortable(paths.root, job.record.stored_path);
  const payloadPresent = await pathExists(locations.payload);
  const destinationPresent = await pathExists(destination);

  if (payloadPresent && destinationPresent) {
    const [payloadHash, destinationHash] = await Promise.all([
      sha256File(locations.payload),
      sha256File(destination),
    ]);
    if (payloadHash !== destinationHash || payloadHash !== job.record.sha256) {
      throw new Error(`Conflicting recovery destination: ${job.record.stored_path}`);
    }
    await rm(locations.payload);
  } else if (payloadPresent) {
    await moveFile(locations.payload, destination);
  } else if (!destinationPresent) {
    throw new Error(`Processing payload is missing: ${job.id}`);
  }

  const storedHash = await sha256File(destination);
  if (storedHash !== job.record.sha256) {
    throw new Error(`Stored file hash mismatch: ${job.record.stored_path}`);
  }

  await checkpoint(options, "stored", { job, paths: locations });
  const record = await addRecord(root, job.record, job.event);
  await checkpoint(options, "recorded", { job, record, paths: locations });
  await rm(locations.directory, { recursive: true, force: true });
  return record;
}

async function resumeJob(root, paths, directory, options) {
  const locations = processingPaths(paths, path.basename(directory));
  const rawJob = await readJson(locations.metadata, null);
  if (!rawJob && !(await pathExists(locations.payload))) {
    await rm(locations.directory, { recursive: true, force: true });
    return null;
  }
  const job = validateJob(paths, rawJob);

  if (job.record) return finalizeJob(root, paths, locations, job, options);
  if (await pathExists(locations.payload)) {
    const prepared = await prepareJob(root, paths, locations, job, options);
    return finalizeJob(root, paths, locations, prepared, options);
  }

  const original = resolvePortable(paths.inbox, job.original_inbox_path);
  if (await pathExists(original)) {
    await rm(locations.directory, { recursive: true, force: true });
    return null;
  }
  throw new Error(`Processing payload is missing: ${job.id}`);
}

async function recoverProcessing(root, paths, options) {
  const entries = await readdir(paths.processing, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(paths.processing, entry.name))
    .sort();
  const records = [];
  for (const directory of directories) {
    const record = await resumeJob(root, paths, directory, options);
    if (record) records.push(record);
  }
  return records;
}

async function ingestFile(root, paths, sourcePath, options) {
  const { job, locations } = await claimFile(paths, sourcePath, options);
  const prepared = await prepareJob(root, paths, locations, job, options);
  return finalizeJob(root, paths, locations, prepared, options);
}

export async function scanInbox(root, options = {}) {
  const paths = await initWorkspace(root);
  const minAgeMs = options.minAgeMs ?? 0;
  const records = await recoverProcessing(root, paths, options);
  const files = await listFiles(paths.inbox);
  for (const filePath of files) {
    if (minAgeMs > 0 && (await fileAgeMs(filePath)) < minAgeMs) continue;
    records.push(await ingestFile(root, paths, filePath, options));
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
    const processingEntries = await readdir(paths.processing, { withFileTypes: true });
    return {
      healthy: true,
      root: paths.root,
      records: index.records.length,
      processing_jobs: processingEntries.filter((entry) => entry.isDirectory()).length,
      unexpected_processing_entries: processingEntries.filter((entry) => !entry.isDirectory()).length,
      version: index.version,
    };
  } catch (error) {
    return { healthy: false, root: path.resolve(root), error: error.message };
  }
}
