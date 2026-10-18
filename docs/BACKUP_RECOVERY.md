# Backup integrity and safe recovery

Jotstead is a **single-server SQLite workspace**. A backup must protect two different stores: SQLite's pages/revisions/history and the upload directory. JSON workspace export does not include attachment bytes or history.

## Recovery commands

Use **Node 24+ / pnpm 11.19.0** in a trusted copy of this repository. Stop Jotstead and any MCP or other process writing into the data directory before running a backup. Put copies on another disk, preferably encrypted. Do not put backups in publicly served folders.

```bash
# With JOTSTEAD_DATA_DIR set if using a custom location:
pnpm backup ./backups/2026-10-19-safe-copy

# Re-check every file and the SQLite logical database:
pnpm backup --verify ./backups/2026-10-19-safe-copy

# Dry-run verification — does not create/overwrite a restore destination:
pnpm backup --restore ./backups/2026-10-19-safe-copy ./data-restored --dry-run

# Restore into a NEW, non-existing directory:
pnpm backup --restore ./backups/2026-10-19-safe-copy ./data-restored
```

The restored directory contains `workspace.sqlite`, `uploads/`, and `backup.json`. Set `JOTSTEAD_DATA_DIR` to the new directory, restart the service, sign in and check pages, history and several attachments. For a previously bound workspace, owner credentials and the vault key are **not** in the backup. Restore only a workspace with an owner binding you control; preserve your own protected `auth.sqlite` and `auth.key` separately where appropriate. Do not place a restored backup over an existing directory. The command intentionally refuses to overwrite anything.

## What's verified

- A `VACUUM INTO` copy gives a transactionally consistent snapshot of the SQLite database, without copying a live WAL file.
- Backup validation checks `PRAGMA integrity_check`, an existing workspace record/revision and the history table.
- A version 2 manifest records every uploaded file and metadata file and the SQLite snapshot, with SHA-256 and byte size. Verification catches corruption, missing/extra upload files, unexpected paths and revision mismatches.
- The command copies into a private temporary directory, validates the result, then renames it into place. On detected failure it deletes only its own temporary directory.
- Changes to the live workspace revision or any upload discovered while copying abort the backup. This narrows race conditions; **it does not guarantee a cross-store atomic snapshot while arbitrary writes continue**.
- Restore verifies the backup first, copies to a private temporary directory, verifies again and creates only a **fresh** target directory.

## Limits and threat model

**Back up only with writes paused.** SQLite snapshots are consistent on their own, but attachment files are managed outside SQLite; a concurrent upload can occur between the final checks and rename. No cross-process application lock is installed. Never use this as permission to back up an actively written instance.

The manifest is an **unkeyed checksum catalogue**: it detects accidental/incomplete/corrupt copies, not malicious modification by an attacker who can rewrite both files and the manifest. Store backups in protected offsite storage. The CLI does not encrypt, sign, upload, compress or automatically schedule archives. Version 1 backups do not have per-file checksums and cannot pass the version 2 verifier; preserve and manually restore old archives following the earlier instructions, after checking them separately.

No actual user data, native mobile device or production HTTPS server was used in these checks. Regression tests exercise an isolated workspace schema and binary upload fixture; they do not prove every real-world restore will succeed.

## Architecture and failure handling

```text
live workspace.sqlite (WAL-aware) -- VACUUM INTO --> staging/workspace.sqlite
live uploads/ -- regular-file check + copy ------> staging/uploads/
                                    SHA-256 checks + revision/inventory recheck
                                                  |
                                    staging/backup.json (version 2)
                                                  |
                                    verify -> rename into final backup
                                                  |
                     verify -> fresh staging restore -> verify -> rename
```

If validation fails, keep the original live database and all previous backups untouched. Investigate available disk space, interrupted uploads, symlinks/special files, and whether writes were truly paused. After a successful restore, compare representative large pages, revision history, database rows and downloaded attachment bytes against the pre-restore workspace before switching over.

Design basis: SQLite [VACUUM INTO](https://sqlite.org/lang_vacuum.html) and [online backup](https://sqlite.org/backup.html) documentation. For multi-replica or hosted storage, a separate transactional storage design is required.
