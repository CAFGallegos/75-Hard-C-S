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

## Validation completed

- Syntax checks on every changed/new browser JavaScript file.
- Existing finish-line, daily-lines and shared-sync Node tests; existing Deno note-slot test.
- New `lift-rules.test.mjs`: progression branches, deloads, rounding, kg conversion, plate leftovers, non-greedy plate combinations, warm-ups and e1RM.
- New `lift-api.test.mjs`: validation, local dates, duplicate sets and authenticated-owner forwarding (Node 24 used).
- Deno 2.9.8: `deno check --no-lock supabase/functions/api/index.ts`.
- Isolated mobile-width Chromium browser checks with mocked API data: plan creation, draft/reload recovery, timer persistence, offline Finish retry, manual credit, history chart, kg progression, both themes, separate private-link drafts, precaching and offline shell reload. No production data used.

## FLAGS

- No seed split was provided: the request still says `PASTE SPLIT HERE`. Both plans start empty. No IDs were invented or live person rows queried.
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
