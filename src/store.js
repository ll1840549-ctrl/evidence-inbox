import path from "node:path";
import { INDEX_VERSION, WORKSPACE_DIRS } from "./constants.js";
import { appendJsonLine, atomicWriteJson, ensureDir, readJson } from "./utils.js";

export function workspacePaths(root) {
  const resolved = path.resolve(root);
  return {
    root: resolved,
    index: path.join(resolved, "index.json"),
    audit: path.join(resolved, "audit.jsonl"),
    ...Object.fromEntries(WORKSPACE_DIRS.map((name) => [name, path.join(resolved, name)])),
  };
}

export async function initWorkspace(root) {
  const paths = workspacePaths(root);
  await ensureDir(paths.root);
  for (const directory of WORKSPACE_DIRS) await ensureDir(paths[directory]);
  const current = await readJson(paths.index, null);
  if (!current) {
    await atomicWriteJson(paths.index, {
      version: INDEX_VERSION,
      created_at: new Date().toISOString(),
      records: [],
    });
  }
  return paths;
}

export async function loadIndex(root) {
  const paths = await initWorkspace(root);
  const index = await readJson(paths.index, null);
  if (!index || index.version !== INDEX_VERSION || !Array.isArray(index.records)) {
    throw new Error(`Invalid index format: ${paths.index}`);
  }
  return { paths, index };
}

export async function addRecord(root, record, event = "recorded") {
  const { paths, index } = await loadIndex(root);
  index.records.push(record);
  index.updated_at = new Date().toISOString();
  await atomicWriteJson(paths.index, index);
  await appendJsonLine(paths.audit, {
    event,
    at: new Date().toISOString(),
    record_id: record.id,
    sha256: record.sha256,
    status: record.status,
    stored_path: record.stored_path,
  });
  return record;
}

export async function findOriginalByHash(root, sha256) {
  const { index } = await loadIndex(root);
  return index.records.find(
    (record) => record.sha256 === sha256 && record.status !== "duplicate" && record.status !== "failed",
  );
}

export async function findRecord(root, query) {
  const { index } = await loadIndex(root);
  return index.records.find((record) => record.id === query || record.sha256 === query);
}
