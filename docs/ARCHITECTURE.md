# Architecture

Evidence Inbox deliberately starts with a small, dependency-free architecture.

```text
inbox files
    |
    v
stability check -> SHA256 -> duplicate lookup
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
                     index.json + audit.jsonl
```

The index is replaced atomically after each record. Audit events are appended separately. Version 0.1 serializes scans in one process; multiple writers are not supported yet.

The classifier is deterministic and explainable. Each category exposes its score and matched keywords. File-name matches contribute only a small fraction of a content match.

Generated workspace paths are stored relative to the workspace root so the directory can be moved. Integrity verification resolves those paths and recomputes SHA256.
