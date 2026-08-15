import { createHash, randomUUID } from "node:crypto";
import { access, copyFile, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(directory) {
  await mkdir(directory, { recursive: true });
}

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function atomicWriteJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

export async function appendJsonLine(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const handle = await open(filePath, "a");
  try {
    await handle.appendFile(`${JSON.stringify(value)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

export async function sha256File(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

export function safeName(name) {
  const normalized = name.normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  return normalized.replace(/\s+/g, " ").trim().slice(0, 180) || "unnamed";
}

export function dateParts(date = new Date()) {
  const iso = date.toISOString();
  return { year: iso.slice(0, 4), month: iso.slice(5, 7), iso };
}

export async function moveFile(source, destination) {
  await ensureDir(path.dirname(destination));
  try {
    await rename(source, destination);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    await copyFile(source, destination);
    await rm(source);
  }
}

export async function fileAgeMs(filePath, now = Date.now()) {
  const details = await stat(filePath);
  return now - details.mtimeMs;
}

export async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function relativePortable(root, target) {
  return path.relative(root, target).split(path.sep).join("/");
}

export function resolvePortable(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...relativePath.split("/"));
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }
  return resolved;
}
