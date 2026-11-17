# Lift tracker handoff

Implementation branch: `codex/lift-tracker`. Base: `f7bc28d1c3c26772a75a387fcbc512f0e77cefee` (PR #6).

The feature adds private plans, set logging, progression suggestions, persistent workout drafts, a timestamp-based rest timer, plate calculations, history charts, lifting settings, and optional 75 Hard workout credit. No framework, build step, package.json, or app dependency was added. Nothing has been deployed or applied to the database.

## Migration and deployment — Carlos performs these steps

1. Review the feature branch and confirm that the target is the personal `75-hard` project, `axbjvkkcqardmkircknn`. Back up its database before applying the additive migration. Do not target Flogal.
2. Apply `supabase/migrations/20261114182809_lift_tracker.sql` once. It creates five tables and four service-role-only RPCs. It does not alter existing challenge tables or seed any workouts. Keep migration history consistent with however you apply it.
3. Deploy the `api` function with JWT verification disabled, as it is today. Include the new `_shared/lift.ts` and all existing sibling `_shared` files. Keep all existing secrets unchanged. `notify` does not need deployment for Lift.
4. Before publishing the frontend, test invalid-key rejection, each person's private Lift state, foreign-person day/exercise/session IDs, an atomic plan save, an atomic session save, duplicate session retries, and history pagination against the deployed API. Use disposable Lift data under existing people; do not create extra people. Remove only those disposable Lift records afterward.
5. Publish the reviewed frontend through the existing GitHub Pages process when ready. The entry URLs and service worker now use v7. Install/reopen on both phones and complete the checklist below.
6. If rollback is necessary, restore the previous frontend/API version. Leave the additive Lift tables intact to preserve workouts; no destructive down migration is needed.

## Phone checks

- Check Today, Board, reminders, widget, all photo modes, retake/delete confirmation and private photo visibility still behave as before.
- On each private link, create different plans. Confirm neither person sees the other's plan, history or active draft.
- Edit/reorder/delete days and exercises; rename and swap an exercise. Logged history should survive plan edits, while a swapped exercise starts a new progression history.
- Start a workout, enter sets/RIR/notes, add warm-ups, and use the plate calculator. Check large tap targets and both themes.
- Close/reopen and refresh during a workout. Test airplane mode after loading the plan; Finish should retain the draft until Retry Finish succeeds. Retrying a saved UUID must not create another workout.
- Leave the Lift screen, lock/unlock the phone, and check the remaining timer. Tap a set to enable sound. Confirm the on-screen alert even where audio is unavailable.
- Finish a workout and verify no challenge checkbox changes until you explicitly choose one credit button. Workout 2 still requires your outdoor-workout judgment.
- Check history, charts, deletion, units, plate sizes, bar weight and rest settings. Delete a workout without changing its 75 Hard checkbox.

## Validation completed (original implementation; current extension results below)

- Syntax checks on every changed/new browser JavaScript file.
- Existing finish-line, daily-lines and shared-sync Node tests; existing Deno note-slot test.
- New `lift-rules.test.mjs`: progression branches, deloads, rounding, kg conversion, plate leftovers, non-greedy plate combinations, warm-ups and e1RM.
- New `lift-api.test.mjs`: validation, local dates, duplicate sets and authenticated-owner forwarding (Node 24 used).
- Deno 2.9.8: `deno check --no-lock supabase/functions/api/index.ts`.
- Isolated mobile-width Chromium browser checks with mocked API data: plan creation, draft/reload recovery, timer persistence, offline Finish retry, manual credit, history chart, kg progression, both themes, separate private-link drafts, precaching and offline shell reload. No production data used.

## FLAGS

- Original flag, superseded by the current-routine extension below: No seed split was provided: the request still says `PASTE SPLIT HERE`. Both plans start empty. No IDs were invented or live person rows queried.
- Plan deletion archives items so history and older offline drafts remain valid. Renaming retains identity; swapping creates a new identity.
- Sessions snapshot units and exercise names/notes. Unit changes convert equipment settings and increments; adjust them for your actual metric plates. Suggested input weights display two decimals.
- Deloads round down to the configured increment. Warm-ups are excluded from progression, e1RM and working volume. Plate sizes assume unlimited matching pairs; unrepresentable weight is shown explicitly.
- History loads 20 sessions at a time. The progression engine receives the last two sessions per active exercise. Plan saves use a version check to reject stale edits.
- Challenge credit is offered only for a workout started on the current local day. Credit is a separate, explicit existing `set` request; failed credit can still be checked manually on Today.
- Four type annotations in `_shared/webpush.ts` were narrowed to ArrayBuffer-backed bytes to pass the newer Deno compiler. No notification algorithm changed.

## Known gaps

- The migration was written and reviewed, not executed. Database ownership/transaction behavior still needs the deployment smoke tests above. Browser tests used a mock API, not Supabase.
- Physical iPhone installation, camera regressions, real push delivery and sound while locked require phone testing. A browser can suspend background audio; the timer remains accurate from its stored deadline and alerts when visible again.
- Drafts live on the originating browser/device until Finish succeeds. They do not sync across devices, and clearing browser storage removes unsaved drafts. History requires a connection.

## Local review refinements (2026-11-14)

Verified branch `codex/lift-tracker` and that `99bdf03` is an ancestor of HEAD. The working tree was clean before this review. No production data was read, no migration was applied, and no functions were deployed, pushed or merged.

- Clean plan editors now refresh with saved settings/server versions; dirty plan drafts remain intact. Previously a clean, stale editor could conflict after a settings change.
- A failed Finish now restores the button even if the failure happens before the draft is frozen (for example, full browser storage).
- Lift fields use the visual viewport to keep sheet controls above the iOS keyboard and scroll covered workout inputs into view. The timer and tab bar hide while the keyboard covers the screen; the timer deadline continues running. Number inputs retain 16px text and 48px height, use tabular digits, and omit spinner chrome to leave more room for weights. Lift sheet buttons have a 44px minimum height. Existing design tokens, themes and components are reused.

Review checks passed: all browser JavaScript syntax checks; finish-line, daily-lines, shared-sync, lift-rules and lift-api tests; new lift-store and lift-preview tests; and `git diff --check`. The note-slot test passed with `node tests/note-slots.test.ts` on Node 24.18.0. Deno is unavailable here, so the exact Deno note-slot command and API type check could not be repeated. No browser runner is installed: mobile browser, keyboard, theme and PWA behavior still need visual verification, and physical iPhone checks above remain required. The viewport regression test simulates viewport changes; it does not emulate Safari.

### Open the isolated sample preview

From this repository, run:

```sh
node tools/lift-preview.mjs
```

Open **http://127.0.0.1:4175/?k=sample-a&tab=lift**. Use the sample-profile links in the banner to switch between Sample Alex and Sample Sam. Use browser responsive mode at 320, 375 and 390px wide; change themes in You → Appearance. Start the sample workout to review inputs, warm-ups, plates and the rest timer. History has 23 synthetic sessions to exercise pagination and charts. Finish offers explicit challenge credit; the mock changes only sample checkboxes. For offline retry, load a workout, complete a working set, set the browser Network panel to Offline, Finish, then reconnect and Retry Finish.

This dedicated server binds only to loopback, replaces the served API configuration with `/__preview_api`, handles all API calls in memory, rejects unsupported actions and non-sample keys, blocks external requests through CSP, and disables service workers. It never forwards requests to Supabase. Do not use a generic static server for the sample preview: that would serve the normal live API configuration. Preview API changes reset when the server restarts; browser drafts remain on this preview origin. To reset those too, clear site data for `127.0.0.1:4175`. Push, camera/Shortcut integration, widget setup, service-worker caching and database security are outside this mock preview.

Run the added regression checks with:

```sh
node tests/lift-store.test.mjs
node tests/lift-preview.test.mjs
```

Before deployment, repeat `deno run tests/note-slots.test.ts` and `deno check --no-lock supabase/functions/api/index.ts`, complete visual/physical phone checks, and follow Carlos's migration/API smoke-test/publishing sequence above. The sample preview does not replace database ownership, atomicity or real-device verification.

## Illustrated library and timer follow-up

Added a 28-exercise starter library with 56 locally hosted photos (~3.95 MB), instructions, muscle/equipment search and plan-editor selection. Source revision/license: icons/exercises/SOURCE.md and LICENSE.txt. This is a starter selection, not all 876 upstream exercises. Custom exercise entry is unchanged. Library references use catalog names; renaming a plan exercise does not persist a catalog link. No historical records or generated programs imported.

Rest timer now shows overtime, clamps shortening at zero, supports vibration where available, and persists its completion-alert marker to avoid repeating alerts after reload. Native iOS Live Activities and guaranteed locked-screen sound are not provided by this PWA. Service worker v8 precaches the library and attempts all local photos; missing optional photos do not block shell installation.

Run node tests/lift-library.test.mjs and node tests/lift-timer.test.mjs plus existing checks. Restart the sample preview process to pick up JPEG MIME handling. No deployment or database change was made. Physical phone audio/vibration, keyboard, and offline installation still require testing.

## Current-routine and platform continuation (2026-11-14)

The following supersedes the earlier starter-library, v7/v8 and missing-split notes. Work remains on `codex/lift-tracker`, with `99bdf03` in its ancestry. The uncommitted library/timer/navigation/preview work present at the start was retained and extended. No production data, Flogal resources, credentials or private links were accessed. Nothing was committed, pushed, merged, published, deployed or applied to a database. No dependency or build system was added.

### Implemented locally

- The navigation is Today → Board → Photos → Lift → You. Lift reuses the existing vanilla modules, theme tokens, cards, sheets, buttons, fonts and icons.
- Carlos's **Load my starting routine** sheet previews Push A, Pull A, Legs, Push B and Pull B. Explicit confirmation either activates that five-session rotation (saving the previous rotation in My programs) or appends it. Dirty plan edits block loading; active workouts and saved sessions remain intact. A source import marker prevents repeat loading. Sue's profile receives no routine automatically.
- Starting references are separate exercise metadata, never History. Original names/order, mixed set weights, fractional RIR and the lower-bound qualifier in `5+` are retained. Plan editing includes reference fields separately from prescription targets. Legs loads are blank; Kettle SQ Extension is custom/unverified. All suggestions start unchecked. Confirmed comparable performance becomes progression evidence after real saves.
- Full Free Exercise DB snapshot: **876 entries, 1746 available image paths**, source revision `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`. Original source IDs and catalog fields are unchanged. Text search includes names, muscle aliases and muscle/equipment filters; difficulty/category/favorites filters, instructions, source information, custom movements and explicit plan mappings are available. Unknown metadata stays unspecified. The original 28-exercise data and 56 local photos are retained.
- Full catalog text is precached by service worker v9. Photos load only when exercise details open. Pinned upstream media and viewed local photos use a separate cache capped at 40 images, each at most 1 MiB. Missing images show a text fallback; quota errors do not block logging. The isolated preview serves only the existing local-photo subset and returns a missing-image fallback for other photos; it never contacts GitHub or Supabase at runtime.
- The questionnaire covers goals, experience, weekly days, weekdays, preferred time, session length, equipment, muscle priorities, named upper-chest/deltoid focus preferences, favorites/exclusions, restriction terms, split, rep range, intensity and supersets. The pure generator filters/ranks the full catalog deterministically, caps direct plus estimated indirect work, includes work/rest/warm-up/transitions in time estimates, and reports shortages/ineligible preferences/unmatched restrictions. Generated previews support prescription edits, reorder, removal and replacement. Saving creates a separate program; activation requires confirmation and retains the previous rotation.
- Workout drafts support pause/resume, live completion/elapsed-time status, workout-only additions/substitutions/order/removal, set additions/removal, warm-ups, drops, superset groups, exercise/workout notes, explicit RIR qualifiers and fatigue. An explicit **Update permanent plan** action is separate from temporary edits. Equipment or load-semantic changes require confirmation before resetting that exercise's unsaved values. Existing legacy drafts with positive loads under “bodyweight” remain unverified instead of losing their numbers.
- Timer deadlines, pause state and expiry markers persist. Zero rest expires immediately; ±15s clamps at now, overtime remains visible, dismissal clears rest, and pause/resume preserves remaining rest/overtime and already-alerted status. Warm-ups do not start rest; drops defer it to the last effort; superset groups wait for a completed primary round and its attached drops. Sound needs user interaction; vibration is attempted where supported. No native Live Activities or locked-screen alarm guarantee.
- Existing double progression remains optional. It excludes warm-ups, drops, incomplete/qualified suggestions and incomparable apparatus/load types. Confirmed repeated below-range work, three unchanged comparable full sessions and reported fatigue can produce optional deload/plateau/volume/replacement suggestions. No missed day rewrites strength or volume. Training blocks are explicit names/date ranges snapshotted into sessions, not automatic periodization.
- Progress adds date ranges, weekly frequency, active duration, direct/estimated indirect muscle sets, equipment-specific range records, set-value/strength or rep trend charts (including temporary movements), observed training days, schedule adherence since explicit program activation, and fatigue trends after at least three reports. No earlier history is inferred. Bodyweight/added/assisted/unknown total loads are excluded from total-load volume/e1RM. e1RM is limited to mapped compound free-weight sets with suitable exact RIR/rep counts, with assumptions visible.
- Backup v1 exports only the authenticated owner's saved Lift plan/settings/programs/custom exercises and real session snapshots. Import validates version/owner/structure, previews merge/replace, rejects UUID content conflicts, and requires confirmation. Active workouts and dirty plan edits block import. A plan version plus session-revision token detects changes since preview. The proposed RPC restores in one transaction; its merge path checks retention/content of existing rows. Session deletion shares the owner lock. No challenge data, photos, keys or unsaved browser drafts are exported or modified.

### Checks and their limits

Passed on Node 24.18.0:

- Syntax checks for every browser module, the shared JavaScript schema, service worker, preview and Lift test scripts.
- All existing Node regression suites: finish-line, daily-lines, shared-sync, lift-rules, lift-api.
- Existing library/timer/store/preview suites, extended where applicable.
- New `lift-references`, `lift-generator`, `lift-platform`, `lift-timer-recovery`, and `lift-offline` suites.
- The note-slot suite under Node (`node tests/note-slots.test.ts`).
- `git diff --check`.

The reference tests cover five-day values/qualifiers, repeat prevention, unset loads and confirmed progression. Generator tests cover deterministic ranking, constraints, experience, exclusions, conservative volume limits and timing. Platform tests cover catalog hash/identity, load metrics, superset/drop/pause semantics, backup conflicts/owner isolation, schedule arithmetic and analytics. Store/timer tests exercise private namespaces, editor preservation, offline retry identity, actual timer expiry markers and recovery. Preview tests exercise HTTP configuration/CSP isolation, private sample profiles, routine loading without History creation, backups and optimistic concurrency. The offline suite is a service-worker **unit test**, not an installed-PWA browser test.

**Not verified here:** real browser rendering at 320/375/390px, both themes, numeric keyboard/timer/navigation overlap, photo/reference selection in a browser, installed-PWA offline reload, actual media fetching through the service worker, physical iPhone sound/vibration/background behavior, Deno compilation, and database SQL/transaction/ownership execution. No browser runner, Deno, Supabase CLI or local Postgres is available. These gaps keep this work from being deployment-ready; passing Node tests is not a substitute.

### Open and use the local preview

```sh
node tools/lift-preview.mjs
```

Open **http://127.0.0.1:4175/?k=sample-a&tab=lift**. The banner identifies the mock environment. On either sample profile, choose **Load my starting routine**, review all source values, choose the five-session rotation or append, then confirm. Choose **Start workout** or a day under Your days. Every set begins unchecked. Sample Sam starts with an independent plan. She can explicitly load her own version, which contains no copied Carlos performance and leaves external/added loads blank.

Use **Exercise library**, **Generate program**, **My programs**, **History**, **Progress**, and **Backup** to inspect the connected flows. Change themes in **You → Appearance**. For offline Finish recovery, complete a working set, switch the browser Network panel to Offline, finish, reconnect, and Retry Finish. The sample API lives in server memory and resets on process restart; browser drafts remain scoped to this preview origin. Do not rely on the sample server for permanent training records. Clear `127.0.0.1:4175` site data if a complete sample reset is needed. Do not serve this app with a generic static server for development interactions: its ordinary API configuration targets the live backend.

Run tests:

```sh
for f in tests/*.test.mjs; do node "$f" || break; done
node tests/note-slots.test.ts
```

The preview test binds a loopback port. No API request is forwarded to production. Service workers remain disabled in this preview; media is rewritten to local files with explicit fallbacks.

### FLAGS / limitations

- **Source conflict:** Pull B uses the eight visible October 1 exercises and 23 sets exactly once; the source header's six exercises / 17 sets is not used to invent or remove data. No CSV is required to set up the routine.
- **Assumptions:** source blocks without targets use editable 8–12 reps, 2 RIR and 120s rest. Legs retains prescribed sets/reps. Equipment increments are editable defaults. Dumbbell loads are preserved as supplied and are not doubled. Familiar equipment labels in the source are used; ambiguous Reverse Flys/Lean Away variants and Kettle SQ Extension stay unverified. Lat pulldown equipment defaults to cable and should be confirmed for the actual apparatus.
- **Matching:** routine movements stay custom until an explicit catalog choice. Source renames/catalog updates do not rewrite references or confirmed sessions. Distinct apparatus names/load types isolate comparisons. Catalog labels are broad; upper-chest/deltoid-head controls rank explicit movement-name patterns, not precise anatomical stimulus. Restriction text is not medical clearance; unmatched terms produce warnings.
- **Planning:** volume caps and indirect multipliers are product heuristics, not individually validated prescriptions. Duration is an estimate. Supersets save no assumed time in that estimate. Named blocks do not automatically periodize workouts. See `LIFT_PROGRAMMING.md` for rules, sources and limitations.
- **Timer:** manual supersets with unequal primary-set counts now rest after every member with that round finishes; extra rounds rest normally. New generated pairs use equal set counts. If storage is full, exactly-once alert persistence across reload cannot be guaranteed. Browser draft data is device-local.
- **Backup:** 5000 saved sessions / 10 MB file limit. Imported archived/unavailable exercise identities retain snapshot provenance instead of recreating old archived plans. Backup is limited to saved Lift data; protect an unsaved draft by finishing it before moving devices. No cross-person transfers are accepted. Merge and replace SQL still require local database execution tests.

### Unapplied backend changes and deployment sequence

`supabase/proposals/lift_platform.sql` is a concrete **unapplied SQL proposal**, not a CLI-created migration. The Supabase CLI is unavailable; no migration filename was invented. Carlos should use `supabase migration new lift_platform` and copy the reviewed proposal into the generated file. It depends on the original unapplied `20261114182809_lift_tracker.sql`.

The proposal adds validated JSON metadata columns to four existing Lift tables, expands the equipment constraint, updates the existing plan/session/state/history RPCs, and adds owner-scoped backup export/restore and serialized deletion RPCs. Existing owner locks, RLS and service-role-only access remain. No challenge tables, photo storage, notify function or widget code changes.

Before deployment:

1. Review both SQL files and the API/schema changes. Test them against a disposable local database with the original schema: references/qualifiers, nullable temporary exercises, foreign-owner IDs, stale versions, archive preservation, plan/session atomicity, duplicate retries, pagination, exports, merge/replace rollback, metadata validation, and concurrent save/delete versus import. Run database advisors locally. Production was not queried during this work.
2. Run `deno run tests/note-slots.test.ts` and `deno check --no-lock supabase/functions/api/index.ts` when Deno is available. Bundle `lift-schema.js` alongside `lift.ts` and all existing API shared files.
3. Complete real mobile-browser and phone checks above: 320/375/390px in both themes, photos and missing-image selection, keyboard open with rest timer, sheets/navigation, source routine confirmation/cancellation, unmarked references, load semantics, pause/reload, warm-ups/drops/supersets, partial finish, offline retry, explicit challenge credit, generator constraints/activation, backup confirmation/conflicts/isolation, and unchanged Today/Board/photos/reminders/widget behavior.
4. Only after separate deployment authorization, back up the intended personal 75-hard database, apply the original and reviewed extension migrations, deploy the API, perform the original authenticated ownership/atomicity smoke tests with disposable Lift rows under existing users, then publish frontend v9. Do not target Flogal. `notify` needs no deployment. Reopen/install on both phones and repeat acceptance checks.

### File inventory for this continuation

Extended existing/uncommitted files: `js/views/lift.js`, `js/lift-store.js`, `js/lift-rules.js`, `js/lift-library.js`, `js/app.js` (existing navigation order retained), `css/app.css`, `index.html`, `sw.js`, `tools/lift-preview.mjs`, `supabase/functions/_shared/lift.ts`, `supabase/functions/api/index.ts`, `tests/lift-api.test.mjs`, `tests/lift-store.test.mjs`, `tests/lift-preview.test.mjs`, and exercise source notes.

Added: `js/lift-domain.js`, `js/lift-routine.js`, `js/lift-catalog.js`, `js/exercise-catalog.json`, `js/exercise-catalog.source.json`, `js/lift-generator.js`, `js/lift-programs.js`, `js/lift-analytics.js`, `js/lift-backup.js`, `supabase/functions/_shared/lift-schema.js`, `supabase/proposals/lift_platform.sql`, `LIFT_PROGRAMMING.md`, and the reference/generator/platform/timer-recovery/offline tests. Original uncommitted starter assets, timer module/tests and library tests remain in the working tree.


## Sue access clarification

Sue has the same Lift library, generator, logging, programs, analytics and backup access, plus her own **Load my starting routine** preview. The Carlos-only button/loader restriction was removed. Her current template uses an explicitly requested glute/leg-focused rotation, with a separate `sue-glute-leg-v1` import marker, newly generated identities, no Carlos reference sets or dated performance notes, blank external/added loads, and unchecked sets. Bodyweight movements use zero external load without assuming her bodyweight. No history, draft or other person's plan is copied or changed automatically.

The exercise order/set counts are an editable template, not a sex-specific prescription. Glute/leg emphasis was explicitly requested; no load or experience level is inferred from sex. Sue can choose **Build a program for my goals instead** to use her own questionnaire, equipment and muscle priorities. The requested focus is implemented as described below; other preferences remain editable.

Validated with the reference, generator, storage and mocked-preview isolation suites: Sue's template is repeat-safe; her explicit loading preserves Carlos's plan and both saved histories. Syntax checks and `git diff --check` passed. Browser/phone verification remains outstanding. No backend schema change, deployment, production access or commit was needed for this access clarification. Preview: **http://127.0.0.1:4175/?k=sample-b&tab=lift**.


## Sue’s requested glute/leg emphasis

Sue’s explicit preference is now **glute/leg emphasis**. Her optional starting rotation is:

1. **Lower A · Glutes + quads:** barbell hip thrust, leg press, seated leg curl, calf press.
2. **Upper A · Push + pull:** dumbbell bench press, wide-grip lat pulldown, lateral raise, cable curl.
3. **Lower B · Glutes + hamstrings:** Romanian deadlift, dumbbell step ups, cable kickback.
4. **Upper B · Back + shoulders:** cable row, dumbbell shoulder press, triceps pushdown, crunches.
5. **Lower C · Glutes + legs:** bodyweight bridge, leg press, lying leg curl, calf press.

All movements use verified IDs/metadata from the pinned exercise catalog. External loads remain blank, references remain empty, bodyweight is never assumed, and sets start unchecked. Main exercise defaults use two working sets, some accessories one set, 3 RIR and 90–120s rest, with editable movement-specific rep ranges. These are template assumptions; equipment, technique, schedule, experience, restrictions and recovery still need her review. This is a rotation, not a requirement to train five consecutive days. The three lower-body sessions total 20 working sets and the two upper-body sessions total 14; rough direct + indirect muscle accounting stays within the existing 14-set planning cap per muscle across the rotation. These set equivalents are bookkeeping estimates, not validated individual stimulus measurements.

The questionnaire now supports a **Lower / Upper · lower first** split. Sue’s unsaved questionnaire defaults prioritize glutes, quadriceps and hamstrings and start lower-first; existing saved questionnaire choices remain intact until she explicitly changes them or confirms the new template. Generated five-session lower-first programs contain three lower and two upper days while preserving constraint, duration and volume limits. Carlos’s routine/defaults and performance references are unchanged.

The new template uses `sue-glute-leg-v1`. If Sue loaded the previous neutral `sue-five-session-v1` template, it is **not** rewritten automatically. **Load my starting routine** previews the new version; confirmation can archive her current rotation in My programs and activate the new one, or append it. Existing sessions, active drafts, dirty edits and repeat prevention retain their previous protections. No production data was modified.

Checks passed: routine/source/load semantics and explicit-upgrade tests, lower-first generator tests, storage isolation tests, JavaScript syntax, mocked HTTP preview/profile isolation, and `git diff --check`. Real browser/phone verification remains outstanding. Open **http://127.0.0.1:4175/?k=sample-b&tab=lift**, then **Load my starting routine** to review Sue’s focus. Files changed for this follow-up: `js/lift-routine.js`, `js/lift-programs.js`, `js/lift-generator.js`, the routine/generator/preview tests, `LIFT_PROGRAMMING.md` and this handoff. No migration, deployment, commit or dependency was added.


## Full-requirement audit follow-up

See **[LIFT_AUDIT.md](LIFT_AUDIT.md)** for the requirement-by-requirement checklist, status definitions, code/test evidence and remaining limitations. This supersedes blanket completion claims: passing mocked HTTP or pure-function tests does not verify browser interactions or database transactions.

The timer is present: finish an eligible working set to see it. Audit fixes add visible expiry even when audio creation fails, tests for adjustments/dismissal/reload, and ordinary rest for extra rounds in unequal supersets. Generator fixes reserve direct work for later sessions, use a five-day hybrid for automatic five-day generation, share eligibility filtering with replacements, validate edited previews again, report adjacent-day muscle overlap, and show the actual configured warm-up allowance. Library details add optional alternatives and explicitly assumed movement/rep guidance. Analytics adds zero-workout weeks, timezone-based inclusive ranges, frequency/fatigue charts, and separate bodyweight-rep/added-load records. Drop sets cannot generate e1RM; different equipment types cannot share progression evidence.

Changed in this follow-up: `js/lift-generator.js`, `js/lift-programs.js`, `js/lift-catalog.js`, `js/lift-library.js`, `js/lift-analytics.js`, `js/lift-domain.js`, `js/lift-store.js`, `js/views/lift.js`, `tests/lift-generator.test.mjs`, `tests/lift-platform.test.mjs`, `tests/lift-timer-recovery.test.mjs`, this handoff, `LIFT_PROGRAMMING.md`, and `LIFT_AUDIT.md`. Existing uncommitted work was preserved. No new dependency, SQL change, commit, push, deployment, production read/write or Flogal change was made.

Validation: all 14 `.test.mjs` suites and the note-slot `.test.ts` suite passed under Node 24.18.0; browser/shared-JS syntax checks and `git diff --check` passed. Preview HTTP checks serve all 31 imported browser modules and use only synthetic per-profile API data. The timer recovery tests execute real store logic with DOM stubs; the offline tests execute service-worker logic in a VM. Neither is a real browser/phone test. Deno, Supabase CLI, PostgreSQL and a browser runner remain unavailable. The running isolated preview at `http://127.0.0.1:4175/` serves changed frontend files without restarting; refresh the page. Use sample-a for Carlos’s routine and sample-b for Sue’s glute/leg template. The migration and deployment gates above remain outstanding.


## Next model: focused workout experience (2026-11-15)

The user requested a plan for another model, using supplied screenshots as interaction references. **[LIFT_NEXT_IMPLEMENTATION.md](LIFT_NEXT_IMPLEMENTATION.md)** is the concrete phased implementation handoff. It extends the existing logger with one-exercise-at-a-time navigation, the existing timer with explained opt-in rest recommendations, and existing analytics with overview/streak/post-save summaries. It also covers compact catalog browsing and real usage sorting, file-level work, legacy draft/metadata compatibility, tests, preview isolation and a copyable next-model instruction.

These next-pass features are **planned, not implemented**. The latest planning step only wrote documentation; earlier audit fixes remain intact. Screenshot numbers/records/bodyweight were not imported. Read the new-request status table in `LIFT_AUDIT.md` before claiming completion. Existing runtime, iPhone and database verification gaps remain unchanged.


## Focused logger implementation (2026-11-15)

Starting-weight verification passed: `exerciseDraft` already prefills Carlos’s individual reference weights/reps/fractional and qualified RIR, unchecked. No History import was needed. Sue’s separate glute/leg routine still has blank loads. Reference tests remain green.

Implemented `js/lift-focus.js` and `js/lift-rest.js`, extending `js/views/lift.js`, store, catalog browsing, analytics, generator base rest calculation, shared metadata validation and service-worker precache. Focused mode shows one exercise, Previous/Next, jump overview and optional All exercises. Draft runtime identities and cursor persist; duplicate IDs from cloned extra sets are repaired. Group navigation follows the matching primary round and attached drops. Existing draft entries/notes and timestamp timer remain the single data source. Starting references, previous confirmed performance, recommendation explanation and today’s editable fields are labeled separately.

Rest options offer Suggested, Plan default and Custom (including zero), scoped to this workout unless explicitly copied to the permanent plan. Permanent exercise editor also supports the policy for blank numeric overrides. Legacy/default rest remains unchanged. Automatic classified rest is 90s isolation, 120s compound, 180s heavy compound; confirmed exact RIR ≤1 can add 30s. Unknown movements use the plan default. Supersets use the maximum of members with that round, with contributor context for undo and timer labeling. Existing ±15/dismiss/expiry/recovery engine retained.

Saved-workout summary appears only after confirmed save, with primary/drop/warm-up counts, active minutes and cautious volume. Progress adds active-week streak; library has compact lazy thumbnails and Name/Favorites/Most used sorting. Usage counts distinct confirmed sessions per catalog ID; full-history failure disables usage sorting. No imported reference popularity.

Evidence: all existing suites and new `tests/lift-focused.test.mjs` passed (15 `.test.mjs` plus note-slots `.test.ts`), syntax and diff checks pass. Preview HTTP suite serves 33 browser modules and verifies mock isolation; this is not visual execution. No browser automation tool or installed browser runner was found, so actual mobile widths/light-dark rendering remain unverified, separately from physical iPhone and PostgreSQL/Deno checks.

Remaining refinements: focused set identity is hydrated but there is no separately persisted caret/field selection; no per-profile mode preference beyond the active draft; post-save summary does not yet identify newly achieved records relative to pre-save history; analytics cards remain basic; explicit match-review wizard and fuller overview illustrations remain pending. These are not claimed complete. Current streak uses the profile’s current local day independently of the chart range. No SQL was executed or changed, no dependency installed, no production/Flogal access, no commit/push/deploy.

## Feature-branch review preparation (2026-11-15)

The user authorized a review commit, push of `codex/lift-tracker`, and a draft PR against `main`, conditional on no deployment from this branch. GitHub repository settings were inspected before pushing: Pages uses legacy branch publishing from `main` at `/`; its `github-pages` environment has a single custom deployment branch policy for `main`; the only workflow is GitHub's dynamic Pages build; no custom workflow directory exists on main or this branch; repository webhooks are empty. Thus the reviewed repository deployment configuration does not deploy a push to `codex/lift-tracker`. Main is not being updated. No database/deployment command is authorized by this review operation.

Reviewed 99 changed/new files before adding this note: Lift code/tests/docs, pinned catalog and 56 licensed JPEGs, additive SQL proposal, shared Lift API, app navigation/CSS and service-worker shell only. Credential-pattern scan found no private keys, GitHub/AWS tokens, JWTs, long private-link keys or assigned secret values; included JPEGs contain no EXIF blocks. No dedicated secret-scanner binary is installed, so this is a pattern/content review rather than a claim of exhaustive secret detection. All 15 `.test.mjs` suites plus note-slots `.test.ts` pass under Node 24, syntax and diff checks pass. HTTP preview checks deliver 33 browser modules; actual browser/mobile rendering remains unverified. Physical iPhone, Deno and PostgreSQL checks remain outstanding. PR scope includes base commit 99bdf03 and its original unapplied migration, plus the current reviewed extension. Earlier no-commit notes describe the historical development boundary; this explicit review authorization supersedes them for this branch only.

## Temporary phone preview hardening (2026-11-15)

Preview server now optionally gates all routes with `LIFT_PREVIEW_PASSWORD` (username `preview`); no auth secrets are stored in the repository. Shared sample serving replaces Carlos’s source routine/flags with explicitly synthetic five-session examples before returning JavaScript, keeping the actual app routine unchanged. Added decoded-path checks, realpath/symlink containment, narrower static filename patterns, no-referrer/noindex/nosniff headers and regression checks for auth/traversal/synthetic source. Existing mock-only API, sample-key validation, same-origin CSP, local media rewriting and disabled service worker remain. Tests pass for all 33 module URLs and these new restrictions. Phone preview uses a separate loopback process on 4176 because the old local preview occupies 4175. Free SSH HTTPS connection is temporary, password-protected, and involves no production deployment. Access/password, disposable SSH keys, QR PNGs and stop helper are under /tmp only, never commit them. QR generation uses the system’s preinstalled libqrencode via Python ctypes; no dependencies installed, no QR rendering service contacted. Physical-phone behavior still needs the user's test; this mock cannot verify installed service-worker/offline shell, real push, backend security/atomicity, signed photos, widget or production data behavior.

## Release verification started (2026-11-16) — not deployed

The user authorized temporary verification tools and a gated release. Existing uncommitted phone-preview changes were retained. Temporary packages were installed under `/tmp/lift-release-tools`; existing cached Chromium was reused. No app dependencies were added.

Passed: Deno 2.9.6 API typecheck and note-slots; existing 16 local suites; both Lift SQL files executed against disposable PostgreSQL 18.6; synthetic tests for owner isolation, stale plan versions, transactional backup merge/replace/rollback, concurrent UUID retries, revision conflicts, archived drafts and grants/RLS. Actual Chromium tests at 320/375/390px in light/dark passed logging/reload/timer, pause and offline Finish retry; expanded navigation/library/analytics tests are retained in `tests/release/`. See its README for requirements and exact scope.

Generated `supabase/migrations/20261116080009_lift_platform.sql` using Supabase CLI `migration new`; its SQL is identical to the reviewed proposal and was tested locally after `20261114182809_lift_tracker.sql`. **Both remain unapplied**. Live migration metadata still contains six original non-Lift migrations, `api` remains v5 and `notify` v4. Local test harness corrections were needed: backup RPC inputs must pass the API validator, and browser reload normally opens Today before the user returns to Lift. These were not product failures.

Release gate: a usable recent database backup has not been confirmed. Supabase MCP exposes no backup listing tool; the temporary CLI has no existing Supabase login/token. User was asked to confirm backup date/Restore availability from the personal project dashboard or an existing downloadable backup. Do not apply migrations, deploy API, mark PR ready or merge until this gate is satisfied and any remaining tests pass. Current API v5 source/config was retrieved into a mode-0600 file under `/tmp/lift-release-previous-api-v5.json` for rollback; no secrets/records were exported into the repository. This is an API source snapshot, **not a database backup**.

Rollback approach: keep additive Lift tables and saved data; restore the prior API source with `verify_jwt:false` and existing secrets intact, and revert frontend release changes using a reviewed revert PR. Do not run destructive down migrations. Any actual database restore requires the separately confirmed backup and explicit selection of the correct personal project; a full restore can affect challenge entries saved after the snapshot and must not be used casually. No backup restore has been tested or executed live.

Physical-iPhone checks remain: keyboard, actual lock/background audio/vibration, installed service-worker/offline behavior, camera/photos, push/reminders/widget. Once release is authorized past the backup gate and deployed, open the existing private app link directly, refresh/reopen, select Lift → Load my starting routine → confirm → Start. Never paste the private-link secret into chat, screenshots or logs. Authenticated live smoke testing also needs the existing private key through a secure local mechanism or the user's own device; hashes stored in the database cannot be used as the private link. Do not replace existing users' key hashes to test.

## Backend release applied (2026-11-16)

The user explicitly authorized continuing without a paid Supabase backup and required preserving all existing 75 Hard data. An attempted broad snapshot/checksum was rejected by automatic approval review for touching live personal/secret-bearing contents; no snapshot was obtained. The safer check used **row counts only**. Do not claim a full database backup exists.

Applied only `lift_tracker` and `lift_platform` to personal project `axbjvkkcqardmkircknn`; Supabase recorded versions **20261116081556** and **20261116081605**. Local migration filenames were aligned to those applied versions. Deployed `api` **v6**, preserving `verify_jwt:false`, the existing function identity, secrets and unrelated configuration. `notify` remains v4. No Flogal resource was accessed.

Live verification passed: malformed and well-formed unknown keys return HTTP 401 `bad_key`; private-link authentication source is identical to API v5. Synthetic plan/session/backup-export tests under existing owner identities ran in a single rolled-back transaction, checking cross-owner rejection, state/history isolation and duplicate UUID retries. All five Lift tables were verified empty afterward. Existing nine challenge-table counts were identical before/after migration (including people, entries, photos, settings, subscriptions and secrets); this count check does not prove byte-for-byte content equality. No existing challenge record or secret was modified by release SQL. The new tables have RLS enabled and no anon/authenticated SELECT privileges. Security advisors show the intentional no-policy model and the pre-existing pg_net-in-public warning; no policy changes were made.

The full 16 pre-existing local suites pass, plus Deno API checking/note-slots, disposable PostgreSQL migration/RPC tests, and actual Chromium at 320/375/390px light/dark for navigation, entry/note recovery, timer/pause, offline Finish retry, summary, library and analytics. Local PostgreSQL restart required explicitly setting its test port; the regression passed after correcting that harness startup. Tests remain under `tests/release/`, outside normal app dependencies.

Remaining limits: no valid production private key was read or printed; authenticated end-to-end tests using the user's real private link still need the user's device/local session. Server-side owner/RPC and invalid-key authentication checks above passed. Physical iPhone, installed-PWA/background/keyboard/camera/photos/push/widget checks remain. Do not interpret mock Chromium as those physical or credentialed tests.

Rollback: frontend can be reverted through a reviewed revert of the release merge; redeploy API v5 from the protected source snapshot `/tmp/lift-release-previous-api-v5.json` or the pre-Lift main commit `f7bc28d1c3c26772a75a387fcbc512f0e77cefee`, retaining `verify_jwt:false` and existing secrets. Keep additive Lift tables and any saved workouts; do not drop tables or delete existing user data. `/tmp` is temporary, so retain the git rollback reference independently. No database restore is implied or available from this release.

## Active workout visual polish — local only (2026-11-16)

Continued the existing uncommitted draft on `codex/lift-visual-polish`. The four original draft files were preserved in `/tmp/lift-polish-before` before refinement. This work is uncommitted and undeployed. No Supabase access, production data access, backend/schema edits, package installs, pushes or merges occurred. The original routine data, progression functions, timer engine, draft/session serializers and Today → Board → Photos → Lift → You navigation are unchanged.

Changes:

- Compact workout title/progress and an expandable Workout menu; one exercise remains the default. The horizontal photo strip shows ordered, named tiles, an outlined current tile, numbered upcoming exercises and checkmarks for completed exercises. It exposes progress in accessible names and scrolls only the strip to reveal the selected tile. Explicit and completion-driven navigation bring the current exercise back into view.
- Current exercise title, compact start/end photos (`object-fit: contain`), targets/rest, then readable 48px set inputs with 44px completion buttons. Unchecked sets have an empty circle; completed sets have a check. Fractional RIR remains numeric and `5+` is displayed alongside the editable value with an accessible “at least” label.
- Previous confirmed performance follows the set controls. Starting references, assumptions, recommendations, notes, exercise editing/substitution/reordering/removal and set tools remain available in labeled expandable sections. Open panels survive same-exercise edits. Rest rationale is visible in the existing rest-options sheet. Pause, permanent-plan update, library/program/backup and workout administration remain reachable.
- `js/lift-visuals.js` resolves confirmed catalog IDs first, then matching names/equipment and a reviewed explicit alias list. Unconfirmed grips, machines, attachments and dip techniques are visibly labeled “Illustrative approximation.” Unsupported machine lateral raises, wide-grip reverse butterfly, neutral-grip pull-ups, reverse-grip rows and other ambiguous variants retain helpful placeholders. No alias assigns a catalog ID or rewrites an exercise.
- A compact, read-only illustration picker lets the user search licensed catalog photos without substituting the exercise. The selection is stored on the owner-scoped workout draft by runtime exercise ID, survives reload/reorder and can be reset. It is intentionally local to that draft, never sent as plan or performance metadata and never affects progression. It does not save favorites or custom exercises.
- Bundled licensed photos are preferred where available. Loading indicators, unavailable/offline placeholders and retry on repaint avoid broken-image controls. The existing service-worker draft change to v10 caches the new module; timer/offline rules are unchanged.

Review preview (left running): `http://127.0.0.1:4182/?k=sample-a&tab=lift` (Carlos-style **Sample Alex**) and `http://127.0.0.1:4182/?k=sample-b&tab=lift` (Sue-style **Sample Sam**). Start any day. Only invented reference weights are served; Sue's loads are blank. Restart with `node tools/lift-polish-preview.mjs`; stop with Ctrl+C in that terminal. This is loopback access, not a new phone HTTPS tunnel. The existing restricted static-file allowlist, mocked APIs, synthetic profiles, production-blocking CSP and disabled service worker remain intact.

Screenshots: initial local draft in `/tmp/lift-polish-before/light.png` and `dark.png`; final mobile captures in `/tmp/lift-polish-after/{carlos,sue}-{320,375,390}-{light,dark}.png`, with `-interaction.png` captures after navigation/logging. All contain synthetic data. The screenshots supplied in the request were inspected as design references, not copied into app assets.

Limitations: only 56 existing local photos are served by the isolated preview; other available pinned catalog images show a fallback there. Ambiguous movements deliberately retain placeholders until an illustration is chosen. Illustration choices currently last for the workout draft only. Physical iPhone keyboard/safe-area behavior, lock/background audio/vibration and installed-PWA/service-worker/offline-shell behavior require device testing. Browser reduced-viewport/focus checks are not a physical keyboard test. Live backend/database checks were not rerun because this is presentation-only work and production access was prohibited.

Verification completed for this polish:

- **PASS:** all 17 local suites (16 `tests/*.test.mjs` plus `tests/note-slots.test.ts`), including exact starting references, Sue blank loads, owner isolation, focus/rest rules, supersets/drops, timer recovery, offline retries, shared 75 Hard behavior and the new illustration resolver test.
- **PASS:** existing `tests/release/lift-browser.test.mjs`, all six 320/375/390 × light/dark Chromium scenarios. Updated selectors open the new details panels; test loads are now synthetic. Log/reload/timer/pause, offline Finish/retry, saved summary, library and analytics passed. Evidence: `/tmp/lift-polish-regression-results.txt`.
- **PASS:** new `tests/release/lift-visuals-browser.test.mjs`, all 12 width × theme × profile Chromium scenarios. Tests verify real decoded photos and contain sizing, image error/offline placeholders, unchanged exercise snapshots after illustration selection, persisted choices/reset, empty/complete tile states, visible selected tile, notes/loads/fractional RIR/qualifiers/reload, overview and automatic advancement, unchanged timer deadlines, pause/resume, editing-control reachability, keyboard focus order/reduced viewport, no horizontal overflow, Finish above the timer and timer above bottom navigation. No unexpected page errors or external requests. Evidence: `/tmp/lift-polish-browser-results.txt`.
- **PASS:** JavaScript syntax and `git diff --check`. Running port 4182 independently checked: both five-day synthetic rotations, same-origin-only CSP, handoff-file access rejected, service-worker URL rejected. No production credentials or links were used.
- **NOT VERIFIED:** physical iPhone Safari/installed PWA, actual on-screen keyboard, locked/background timers, full offline app reload with a service worker, remote catalog image availability or live backend/database behavior. These remain distinct from the local browser evidence above.

The final review changes are limited to `js/views/lift.js`, `js/lift-visuals.js`, `css/app.css`, the existing draft `sw.js` update, focused tests, `tools/lift-polish-preview.mjs` and handoff/test documentation. No dependencies or licensed image files were added or changed. The existing uncommitted feature work remains uncommitted.

## Optional weight with Photos — local only (2026-11-17)

User clarification: bodyweight belongs with daily **Photos**, not exercise logging. Added **You → Weight with daily photos**, off by default for each private link on this device. Enabling shows an optional date-labeled bodyweight field in Photos for all four existing photo modes. Empty input is a skip; weights never affect photo checkmarks, challenge completion, workout loads, recommendations or saved exercise history. Turning the setting off hides the input and retains existing weigh-ins. No new person/profile was inferred from a name in chat.

`js/weight-tracker.js` handles date/unit/value validation, one weigh-in per day, mixed-unit comparison, per-private-link SHA-256 storage namespaces, CSV export and non-destructive handling of corrupt/full storage. `js/weight-view.js` provides the Settings switch, Photos field and an optional History sheet for dated entries, edits/deletion, latest/change, a small trend and CSV export. There is no bodyweight entry point in Lift. These records and the opt-in setting are device-local, not synced and not included in Lift backups; the interface states this. Backend/schema changes were not made.

The mock profile's existing invalid `photo_mode: 'manual'` was corrected to the supported `checkbox` value, allowing the actual Photos screen to render in the isolated preview. Real photo-mode code, upload/deletion APIs, challenge rules and notification code were not modified. The new frontend modules are included in the existing uncommitted v10 service-worker shell.

Preview remains at port 4182, using only synthetic profiles. Open the sample app, choose **You**, turn on **Weight with daily photos**, then open **Photos**. No real weight values were seeded. Screenshots of entered synthetic test values are in `/tmp/photo-weight-preview/`.

Image-source follow-up: researched, not integrated. `https://github.com/HichamELBSI/react-native-body-highlighter` provides MIT-licensed male/female front/back SVG artwork that could be adapted to vanilla SVG with attribution and no React dependency. `https://wger.readthedocs.io/en/latest/api/api.html` documents public exercise API access; individual media licenses and exact variants must be checked before importing. The body-map feature and extra media connections have not been added by this weight-tracker change.

Weight verification: **PASS** all 18 local suites (17 `.test.mjs` plus note-slots), JavaScript syntax and `git diff --check`; **PASS** all 12 actual Chromium weight scenarios (three widths × two themes × two sample private links). Browser evidence: `/tmp/photo-weight-browser-results.txt`; screenshots were inspected at 320px. No page errors, external requests or backend writes occurred in the weight scenarios. Existing polish changes remain intact and uncommitted. Physical-iPhone keyboard, installed-PWA offline reload and cross-device syncing remain unverified/not implemented as described above. Nothing was deployed.

## Muscle diagrams and expanded local media (2026-11-17)

Implemented locally on top of all existing uncommitted polish/Photos work. `js/lift-muscles.js` renders front/back muscle maps on the next-workout overview and in expandable Target muscles details during an active exercise. Per the latest clarification, appearance is automatic from the authenticated profile: Sue uses female artwork, Carlos uses male artwork. There is no appearance selector or added preference UI. Primary groups use the profile accent; secondary groups use a stripe pattern, with textual labels in expandable details. Catalog IDs and reviewed exact illustration aliases supply broad muscle groups; ambiguous variants without confirmed metadata are omitted and counted. No muscle activation, injury suitability or precise stimulus is inferred.

Four plain-SVG path datasets are stored in `js/muscle-paths.json` from pinned `HichamELBSI/react-native-body-highlighter` revision `8ed39ac2ae9cb46fb79d77eedec7e5b029a75174`. MIT copyright/license and provenance are retained in `icons/muscles/`. No React/framework/package dependency was added. The inactive anatomy contrast was reviewed and improved in both themes.

Expanded licensed Free Exercise DB media using the existing pinned source: `js/lift-media.json` maps 25 exact catalog photo pairs, reusing 32 existing photo files and adding **18 JPEGs** (nine pairs). These cover Sue's confirmed starter IDs and the reviewed Carlos illustration aliases. Existing approximate-match labels remain visible; exercise IDs, routine numbers, blank loads, progression, timer and saved History were not rewritten. No wger/API subscription or new external connection is required. Unmatched grip/apparatus variants still retain explicit placeholders and the illustration picker. Photos remain cached on demand through existing service-worker rules; the new JSON/module files are in the shell manifest. Restricted mocked preview serving explicitly permits only the added JSON names.

The image-alias regression check found and fixed an optional-property equality edge case when both alias and equipment were missing. Resolver now requires an alias before dereferencing it.

Tests: all **19 local suites** passed (18 `.test.mjs` plus note-slots), including new muscle-path/target and local-media validation. New actual Chromium matrix checks both profile-derived appearances at 320/375/390px in light/dark themes, decoded added local photos, primary highlights, zero external requests/page errors and no horizontal overflow. Evidence and screenshots: `/tmp/lift-muscle-browser-results.txt` and `/tmp/lift-muscle-preview/{320,375,390}-{light,dark}-{male,female}.png`. Existing timer/navigation/offline Finish browser regression evidence: `/tmp/lift-final-browser.txt`; full visual matrix: `/tmp/lift-final-visuals.txt`. Weight scenario evidence remains `/tmp/photo-weight-browser-results.txt`.

Preview remains running at `http://127.0.0.1:4182/?k=sample-a&tab=lift` and `?k=sample-b&tab=lift`. Use Sue's sample to review confirmed lower-body muscle maps and new photos; Carlos's unconfirmed movements deliberately omit muscle targets. Photos weight logging stays off until enabled under You. All preview values/profiles are synthetic, production calls are blocked and service workers are disabled. Physical iPhone keyboard/background alerts/installed-PWA behavior remain outstanding; body maps are broad catalog illustrations. No Supabase access, backend edits, migrations, commit, push, merge or deployment occurred.

## PR review scope and compact-icon refinement (2026-11-17)

Supersedes the earlier large-map presentation: muscle maps are compact front/back icons beside workout/exercise headings. Tapping opens a larger sheet with muscle context; profile-derived Sue/female and Carlos/male selection remains automatic. No appearance selector is shown.

The visual-polish review commit excludes the independent optional Photos bodyweight work, which remains uncommitted. The earlier 19-suite report covered that combined workspace. The exact selected visual-polish snapshot passes 18 local suites (17 `.test.mjs` plus note-slots). Review screenshots and scope/test details are in `docs/review/lift-visual-polish/README.md`. Reusable synthetic test/preview source is included; temporary servers, tunnels, credentials, tool installs and `/tmp` artifacts are excluded. Supabase and production remain untouched.

## Browse workouts before starting (2026-11-17, local only)

Your days rows now say **Preview** and open a workout preview sheet rather than creating a draft. The sheet shows the workout name, exercise/set count, units, compact profile muscle icon, ordered illustrated exercise list and targets. Expand an exercise to review equipment/load semantics, rest, supplied starting references (including fractional/5+ RIR), notes and the reference viewer. Close preview leaves draft/history/timers unchanged. Only the explicit **Start workout** button creates the workout snapshot and start timestamp. The home card's explicitly labeled Start workout shortcut remains available. Existing active-workout protection rejects a second workout instead of replacing a draft.

All 19 current workspace local suites passed (includes the still-uncommitted Photos weight suite). New actual Chromium test `tests/release/lift-workout-preview.test.mjs` passes 12 scenarios: both profiles × 320/375/390px × light/dark, preview/expand/close without draft or timer, explicit start of the selected day with unchecked sets, no backend writes, no page errors or horizontal overflow. Synthetic screenshots: `/tmp/lift-workout-preview/`. Test log: `/tmp/lift-workout-preview-results.txt`. Existing six workout browser scenarios rerun for start/log/reload/timer/pause/offline Finish/retry; log `/tmp/lift-preview-regression-results.txt`.

Changes remain local/uncommitted and undeployed. Existing Photos weight-tracker work is preserved. No Supabase, push, merge or deployment actions occurred for this follow-up. Physical-iPhone and installed-PWA checks remain outstanding.

## Follow-up branch prepared for push (2026-11-17)

User authorized pushing the checked local follow-up. Branch `codex/workout-preview-photo-weight` includes the workout preview flow and the previously preserved optional **body weight** feature beside daily Photos. Body-weight opt-in starts off independently for each private link/device; no weight field appears in Photos until enabled in You. Empty values can be skipped, challenge credit is unaffected, and no exercise loads or progression use these measurements. Weigh-ins, history/edit/delete, trend and CSV are device-local; they are not cloud-synced or included in Lift backups. The setting is labeled Body weight with daily photos. Service-worker shell advances to v11 and includes both frontend modules.

Reviewed image gaps are listed in `docs/exercise-image-gaps.md`. Additional paid/provider assets were not purchased, copied or connected. Recommended sources were checked from official Gym Visual and wger pages; media must match the exact grip/equipment and retain applicable rights/attribution. Current missing variants keep placeholders.

Final checks for this follow-up: 19 local suites; 12 workout-preview mobile scenarios; six existing workout/timer/offline-save scenarios; and 12 body-weight opt-in/history/CSV/isolation/photo-mode scenarios. Browser checks use synthetic data, both themes and 320/375/390px. Physical iPhone, camera, background audio/vibration and installed-PWA update/offline acceptance remain outstanding. This feature push is not authorization to merge or deploy. No Supabase changes.

Free-only source clarification: user selected free media and authorized merging the tested follow-up. wger public API was inspected without credentials or personal data; exact image coverage remains incomplete and some image attribution/variants were unsuitable. No questionable or paid assets were imported. `docs/exercise-image-gaps.md` records the audit and own-photo option. Merge authorization applies to the verified preview/optional-body-weight changes; no Supabase change is needed.
