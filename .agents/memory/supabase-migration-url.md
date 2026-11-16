---
name: Supabase migration connection strings
description: Safe handling of this project's Supabase migration database URL when running SQL migrations.
---

The configured migration connection string can contain an unescaped `@` in its password, which causes `psql "$SUPABASE_MIGRATION_DB_URL"` to parse the host incorrectly.

**Why:** Direct URL parsing failed even though the configured credential was valid; a safer connection method was needed to apply the approved schema migration.

**How to apply:** Parse the URL without printing it, then supply the decoded password using `PGPASSWORD` and connect with explicit host, port, database, and user. Never include credentials in logs or command output.
