import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../src/cli.js", import.meta.url));

async function runCli(args) {
  return execFileAsync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
}

test("runs the documented CLI workflow end to end", async () => {
  assert.equal((await runCli(["version"])).stdout.trim(), "0.2.0");
  const root = await mkdtemp(path.join(os.tmpdir(), "evidence-inbox-cli-"));
  const initialized = await runCli(["init", "--root", root]);
  assert.match(initialized.stdout, /Initialized/);

  await writeFile(
    path.join(root, "inbox", "demo.txt"),
    "会议纪要：参会人员确认会议议程和行动项。",
    "utf8",
  );
  const scanned = JSON.parse((await runCli(["scan", "--root", root, "--json"])).stdout);
  assert.equal(scanned.length, 1);
  assert.equal(scanned[0].status, "processed");

  const listed = JSON.parse((await runCli(["list", "--root", root, "--json"])).stdout);
  assert.equal(listed[0].id, scanned[0].id);
  const shown = JSON.parse((await runCli(["show", scanned[0].id, "--root", root])).stdout);
  assert.equal(shown.sha256, scanned[0].sha256);

  const verified = JSON.parse((await runCli(["verify", "--root", root, "--json"])).stdout);
  assert.equal(verified[0].status, "ok");
  const doctor = JSON.parse((await runCli(["doctor", "--root", root])).stdout);
  assert.equal(doctor.healthy, true);
  assert.equal(doctor.processing_jobs, 0);
});
