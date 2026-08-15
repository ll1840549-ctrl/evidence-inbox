import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolvePortable, safeName } from "../src/utils.js";

test("resolves portable paths only inside the workspace", () => {
  const root = path.resolve("workspace-root");
  assert.equal(resolvePortable(root, "processed/report.txt"), path.join(root, "processed", "report.txt"));
  assert.throws(() => resolvePortable(root, "../outside.txt"), /Path escapes workspace/);
});

test("normalizes unsafe file names", () => {
  assert.equal(safeName('  report<>:"/\\|?*.txt  '), "report_________.txt");
  assert.equal(safeName("   "), "unnamed");
});
