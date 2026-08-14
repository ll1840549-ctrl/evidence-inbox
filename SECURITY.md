# Security Policy / 安全政策

## Supported versions

Security fixes are currently provided for the latest release on the default branch.

## Reporting a vulnerability

Please use GitHub's private security advisory feature for vulnerabilities. Do not open a public Issue containing exploit details, secrets, personal data, or sample documents from real users.

Include:

- affected version and operating system;
- minimal reproduction using synthetic data;
- expected impact;
- any suggested mitigation.

We aim to acknowledge a valid report within seven days. A remediation timeline depends on severity and reproducibility.

## Data boundary

Evidence Inbox is local-first and has no telemetry. Contributors must not add network uploads, analytics, or AI-provider calls without an explicit opt-in design, clear documentation, tests, and a security review.

The generated workspace may contain sensitive file names, hashes, extracted metadata, and audit history. It is ignored by the repository's default `.gitignore`, but users remain responsible for access controls and backups.
