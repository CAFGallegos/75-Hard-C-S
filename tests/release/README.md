# Local release verification

Temporary tools live outside the app under `/tmp/lift-release-tools` (Deno 2.9.6, Playwright 1.65.1, embedded PostgreSQL 18.6, pg 8.23.1, Supabase CLI 3.1.0). The normal app has no added dependencies. npm's resolved lockfile is under that temporary directory.

`lift-postgres.test.mjs` requires a disposable PostgreSQL cluster at loopback port 55439 with data directory **exactly `/tmp/lift-release-pg`** and synthetic test roles/people only. It refuses to reset any other cluster. It resets that local schema, applies both required Lift migrations and tests owner isolation, stale plans, retry/concurrent idempotency, backup merge/replace/rollback/revision conflicts, archived offline drafts and table/RPC grants. It must never be pointed at production.

`lift-browser.test.mjs` starts the isolated mock preview on an ephemeral loopback port and uses actual Chromium at 320/375/390px in light/dark themes. It tests focus navigation, entered notes, reload recovery, timestamp timer, pause/resume, offline Finish/retry, saved summary, library search/details and analytics. Screenshots are written under `/tmp`. `LIFT_RELEASE_TOOLS` can override the temporary driver directory; `LIFT_CHROMIUM` can override the installed browser path. It never calls production.

Run after temporary tools and the disposable cluster are ready:

```sh
node tests/release/lift-postgres.test.mjs
node tests/release/lift-browser.test.mjs
DENO_DIR=/tmp/lift-release-tools/deno-cache /tmp/lift-release-tools/node_modules/.bin/deno check --no-lock supabase/functions/api/index.ts
DENO_DIR=/tmp/lift-release-tools/deno-cache /tmp/lift-release-tools/node_modules/.bin/deno run tests/note-slots.test.ts
```

These checks do not verify physical iPhone behavior, live database/API isolation, Supabase-specific infrastructure or production credentials. Existing 16 local suites also remain required.
