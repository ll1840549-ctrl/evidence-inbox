#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { APP_NAME, VERSION } from "./constants.js";
import { doctorWorkspace, listRecords, scanInbox, verifyRecords } from "./pipeline.js";
import { findRecord, initWorkspace } from "./store.js";

function readOption(args, name, fallback = undefined) {
  const prefix = `--${name}=`;
  const inline = args.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1];
  return fallback;
}

function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

function positionals(args) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith("--") && !value.includes("=") && args[index + 1] && !args[index + 1].startsWith("--")) {
      index += 1;
      continue;
    }
    if (!value.startsWith("--")) result.push(value);
  }
  return result;
}

function workspaceRoot(args) {
  return path.resolve(readOption(args, "root", process.env.EVIDENCE_INBOX_HOME ?? ".evidence-inbox"));
}

function printHelp() {
  console.log(`${APP_NAME} v${VERSION}

Usage:
  evidence-inbox init [--root PATH]
  evidence-inbox scan [--root PATH] [--json]
  evidence-inbox watch [--root PATH] [--interval MS]
  evidence-inbox list [--root PATH] [--status STATUS] [--json]
  evidence-inbox show RECORD_ID [--root PATH]
  evidence-inbox verify [--root PATH] [--json]
  evidence-inbox doctor [--root PATH]

Put files in ROOT/inbox, then run scan. The watch command continuously scans
for files that have been stable for at least 1.5 seconds.`);
}

function summary(records) {
  return records.reduce((counts, record) => {
    counts[record.status] = (counts[record.status] ?? 0) + 1;
    return counts;
  }, {});
}

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  const root = workspaceRoot(args);
  const json = hasFlag(args, "json");

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(VERSION);
    return;
  }
  if (command === "init") {
    const paths = await initWorkspace(root);
    console.log(`Initialized ${paths.root}`);
    console.log(`Drop files into ${paths.inbox}`);
    return;
  }
  if (command === "scan") {
    const records = await scanInbox(root);
    console.log(json ? JSON.stringify(records, null, 2) : `Scanned ${records.length} file(s): ${JSON.stringify(summary(records))}`);
    return;
  }
  if (command === "watch") {
    const interval = Number(readOption(args, "interval", 2000));
    if (!Number.isFinite(interval) || interval < 500) throw new Error("--interval must be at least 500ms");
    await initWorkspace(root);
    console.log(`Watching ${root} every ${interval}ms. Press Ctrl+C to stop.`);
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        const records = await scanInbox(root, { minAgeMs: 1500 });
        if (records.length) console.log(`${new Date().toISOString()} ${JSON.stringify(summary(records))}`);
      } finally {
        running = false;
      }
    };
    await run();
    setInterval(() => run().catch((error) => console.error(error.message)), interval);
    return;
  }
  if (command === "list") {
    const records = await listRecords(root, { status: readOption(args, "status") });
    if (json) console.log(JSON.stringify(records, null, 2));
    else if (!records.length) console.log("No records.");
    else for (const record of records) console.log(`${record.id}\t${record.status}\t${record.classification?.category ?? "-"}\t${record.original_name}`);
    return;
  }
  if (command === "show") {
    const query = positionals(args)[0];
    if (!query) throw new Error("show requires a record ID or full SHA256");
    const record = await findRecord(root, query);
    if (!record) throw new Error(`Record not found: ${query}`);
    console.log(JSON.stringify(record, null, 2));
    return;
  }
  if (command === "verify") {
    const results = await verifyRecords(root);
    const unhealthy = results.filter((item) => item.status !== "ok");
    console.log(json ? JSON.stringify(results, null, 2) : `Verified ${results.length} file(s); ${unhealthy.length} problem(s).`);
    if (unhealthy.length) process.exitCode = 2;
    return;
  }
  if (command === "doctor") {
    const result = await doctorWorkspace(root);
    console.log(JSON.stringify(result, null, 2));
    if (!result.healthy) process.exitCode = 1;
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
