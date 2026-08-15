# Evidence Inbox

Evidence Inbox is a zero-runtime-dependency, local-first file inbox. Drop files into `inbox`; it classifies supported text files by content, de-duplicates them with SHA256, and records a reviewable audit trail.

Version 0.2 supports UTF-8 text, Markdown, CSV, JSON, HTML, logs, common source files, and automatic recovery after an interrupted ingestion. PDF, Office, and OCR support are on the roadmap; unsupported files are routed to manual review instead of being silently accepted.

## Quick start

Node.js 20 or newer is required.

```bash
npm install
node ./src/cli.js init --root ./my-inbox
# Copy files into ./my-inbox/inbox
node ./src/cli.js scan --root ./my-inbox
node ./src/cli.js list --root ./my-inbox
node ./src/cli.js verify --root ./my-inbox
```

Use `watch` for continuous ingestion:

```bash
node ./src/cli.js watch --root ./my-inbox
```

## Design goals

- local-first and offline by default;
- content signals outweigh file names;
- SHA256 de-duplication with links to the original record;
- recoverable processing jobs with idempotent index and audit commits;
- explicit processed, review, duplicate, and failed states;
- structured `index.json` plus append-only `audit.jsonl` events;
- no telemetry and no required API key.

## Interruption recovery

Before extraction, `scan` and `watch` claim each stable file into `processing/<job-id>/payload` and persist its source metadata in `job.json`. The prepared destination and evidence record are also persisted before the final move. A later scan can therefore resume safely after interruption during hashing, storage, or record commit without duplicating index or audit entries.

Recovery verifies SHA256 before accepting an existing destination. The `doctor` command reports how many processing jobs are waiting to be resumed.

Run `npm run verify` and `npm run test:coverage` before contributing. See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [Chinese roadmap](docs/ROADMAP.zh-CN.md).

Licensed under the [MIT License](LICENSE).
