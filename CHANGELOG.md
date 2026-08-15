# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Planned

- Optional PDF and Office text extraction.
- Optional OCR adapters with explicit local/cloud boundaries.

## [0.2.0] - 2026-08-15

### Added

- Durable processing jobs that preserve source metadata before extraction.
- Automatic recovery after interruption during hashing, storage, or record commit.
- CLI end-to-end coverage and interruption tests at four transaction checkpoints.
- Built-in test coverage command.

### Changed

- Record and audit commits are idempotent across recovery attempts.
- Stored paths are rejected when they escape the workspace root.
- Workspace diagnostics report pending and unexpected processing entries.

## [0.1.0] - 2026-08-14

### Added

- Local workspace initialization and continuous inbox scanning.
- Content-first classification for six document categories.
- SHA256 de-duplication and original-record links.
- Manual-review routing for unsupported or ambiguous files.
- Structured evidence index and append-only audit events.
- Integrity verification and workspace doctor commands.
- Cross-platform automated test suite.
