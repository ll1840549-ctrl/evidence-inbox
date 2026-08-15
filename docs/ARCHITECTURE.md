# Architecture

Evidence Inbox deliberately starts with a small, dependency-free architecture.

```text
inbox files
    |
    v
stability check -> processing/<job-id>/{job.json,payload}
                                      |
                                      v
                              SHA256 -> duplicate lookup
                                      |          |
                                      |          +-> duplicate/
                                      v
                                text extraction
                                      |
                                      v
                              content classifier
                                |           |
                                v           v
                           processed/  needs_review/
                                \           /
                         idempotent index + audit commit
```

The index is replaced atomically after each record. Audit events are appended separately. Version 0.2 serializes scans in one process; multiple writers are not supported yet.

Each claimed file has a durable processing job. The initial metadata preserves the original inbox-relative path before the file is moved. After hashing and classification, the same job stores the complete evidence record and final destination before the payload leaves `processing`.

Recovery runs before every new inbox scan. It can resume a claimed payload, finish a prepared move, or commit a record whose destination already exists. Record IDs and audit lookups make the commit idempotent. Existing destinations are accepted only when their SHA256 matches the prepared record; conflicting content is left in place and reported as an error.

The classifier is deterministic and explainable. Each category exposes its score and matched keywords. File-name matches contribute only a small fraction of a content match.

Generated workspace paths are stored relative to the workspace root so the directory can be moved. Integrity verification resolves those paths and recomputes SHA256.
