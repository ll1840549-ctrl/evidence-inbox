import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { TEXT_EXTENSIONS } from "./constants.js";

const MAX_TEXT_BYTES = 5 * 1024 * 1024;

function cleanHtml(text) {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractText(filePath) {
  const extension = path.extname(filePath).toLocaleLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) {
    return {
      supported: false,
      text: "",
      extension,
      reason: `unsupported_extension:${extension || "none"}`,
    };
  }

  const details = await stat(filePath);
  if (details.size > MAX_TEXT_BYTES) {
    return {
      supported: false,
      text: "",
      extension,
      reason: `text_file_too_large:${details.size}`,
    };
  }

  const raw = await readFile(filePath);
  if (raw.includes(0)) {
    return { supported: false, text: "", extension, reason: "binary_content_detected" };
  }

  let text = raw.toString("utf8").replace(/^\uFEFF/, "");
  if (extension === ".html" || extension === ".htm") text = cleanHtml(text);
  if (extension === ".json") {
    try {
      text = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return { supported: false, text: "", extension, reason: "invalid_json" };
    }
  }

  return { supported: true, text, extension, reason: null };
}
