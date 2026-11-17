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

## Active-workout visual polish

Run `node tests/release/lift-visuals-browser.test.mjs` with the same external Playwright/Chromium tools. This opens actual mobile-emulated Chromium at 320, 375 and 390px, in both themes and for both synthetic profiles. It verifies illustration labels, rendered local photos, missing/error/offline fallbacks, strip selection/reveal/completion, fractional and qualified RIR, entered values/notes, reload, timer continuity, overview navigation, pause/resume, reachable editing controls, keyboard focus order, reduced viewport and timer/navigation/Finish geometry. Illustration selection and reset are exercised without changing exercise snapshots. All external requests are rejected. Screenshots go to `/tmp/lift-polish-after`; these are sample data only. `LIFT_VISUAL_WIDTHS=390` can narrow an investigative rerun; full verification uses all three widths.

The image-failure test reloads after intercepting photos: removing/reinserting an already decoded image can reuse the browser's image cache, so that alone does not simulate a failed network request. Mobile screenshots used during interaction are viewport captures; full-page mobile capture changes the emulated viewport in Chromium and is reserved for the end of each context.

`node tools/lift-polish-preview.mjs` starts the same restricted mock server on **127.0.0.1:4182**, with full sample rotations preloaded. Open `/?k=sample-a&tab=lift` for Carlos-style sample references or `/?k=sample-b&tab=lift` for Sue's blank-load sample template. It uses synthetic profiles, invented loads, the existing API mock/CSP/path restrictions and disabled service workers. The two keys are public sample selectors, not production credentials. Use a clean browser context or clear this local origin's storage to reset an older sample draft. Stop a terminal-launched preview with Ctrl+C.

The 74 bundled photos (56 existing plus 18 added) are available in this strictly local preview. Other pinned catalog images intentionally show their failure placeholder rather than accessing external media. No dependencies or backend changes were added. These tests do not establish physical-iPhone keyboard/lock-screen behavior, installed-PWA/offline shell behavior, or live database/API behavior.


`node tests/release/lift-muscles-browser.test.mjs` verifies automatically selected male/Carlos and female/Sue front/back SVGs at 320/375/390px in both themes. It confirms primary targets, decoded additional local photos, no appearance selector, no external requests/page errors and no overflow. Screenshots: `/tmp/lift-muscle-preview/`. Run `node tests/lift-muscles.test.mjs` for data/path/media-ID validation. Source/license: `icons/muscles/SOURCE.md` and `LICENSE.txt`; no React dependency is installed.
