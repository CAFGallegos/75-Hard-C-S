# Next Lift implementation: focused workouts, suggested rest, useful progress

Prepared 2026-11-15 for the next implementing model. This is a plan **on top of the existing working tree**, not a replacement implementation. The focused workout interface and rest recommendation policy below are **not implemented yet**.

## Start here

Work only in `/home/flogal_dev/75-Hard-C-S`, on `codex/lift-tracker`. Read `CLAUDE.md`, `README.md`, `LIFT_HANDOFF.md`, `LIFT_AUDIT.md`, `LIFT_PROGRAMMING.md`, and this document. Confirm `99bdf03` is an ancestor of HEAD. Inspect status/diffs and preserve **all** uncommitted/untracked work; much of Lift currently lives in those files.

Keep vanilla JS ES modules, the static PWA and existing Supabase API. Reuse the app’s components, Archivo/Geist typography, person/theme tokens, outline icons, cards, sheets and buttons. Keep Today → Board → Photos → Lift → You. No new dependency/framework/design skill, production access, Flogal change, commit/push/merge, deployment or applied migration. Backend changes, if needed, remain local/unapplied. Existing 75 Hard behavior and explicit workout credit must remain intact.

The user likes the supplied Alpha Progression screenshots for their **interaction structure**: a compact workout overview; illustrated exercise list; one active exercise with its sets and previous performance; a nearby timer; and understandable progress totals. Create an original implementation using this app’s style and licensed catalog. Do not copy Alpha’s media, branding, reward graphics or screen design wholesale.

The screenshots are design references, **not additional imports**. Do not turn the shown 289 workouts, 220.6 lb bodyweight, October performance, proposed set targets or dates into this app’s data. Preserve Carlos’s earlier starting references and Sue’s own glute/leg rotation. Never infer loads, experience or rest needs from sex.

## Current implementation and actual gaps

Full evidence/status checklist: [LIFT_AUDIT.md](LIFT_AUDIT.md). Baseline tests: 14 Node `.test.mjs` suites plus note-slots `.test.ts`, JS syntax and diff checks pass. No browser runner, Deno, Supabase CLI or PostgreSQL is available in the current environment; those verification gaps remain explicit.

| Area | Reuse | Gap to implement |
|---|---|---|
| Workout logger | `js/views/lift.js` → `renderActive`, `renderHome`, `editActiveExercise`; complete-set handlers and all existing controls | Currently renders **every exercise vertically**. Add focused exercise/set navigation without creating a second logger or persistence path. |
| Draft recovery | `js/lift-store.js` → `initLift`, `saveDraft`, `finishLift`; `exerciseDraft` in `js/lift-domain.js` | Store a stable focus cursor and hydrate older drafts without losing work. |
| Timer | `js/lift-store.js` → `startRest`, `tick`; `js/lift-timer.js`; domain `restEligible`, `togglePause` | Existing timer already supports zero/±15/dismiss/overtime/deadline recovery/alerts. Add explained exercise/effort suggestions and timer context, not a new countdown engine. |
| Exercise-specific rest | Logger uses `e.rest_seconds ?? plan.default_rest_seconds`; generator uses strength 180s / compound 120s / other 90s; Sue template uses 90/120s | Static values exist. No shared recommendation policy or explicit automatic/manual choice. Preserve existing saved values. |
| Progress | `js/lift-analytics.js` and `js/lift-programs.js` → `renderAnalytics` | Existing history, records, volume, frequency/fatigue charts, adherence, date ranges and duration need clearer overview cards, a well-defined streak and post-save summary. Do not rebuild calculations. |
| Catalog | `js/lift-catalog.js`, `js/lift-library.js` | 876 entries, filters/favorites/custom/alternatives already exist. Add compact image rows and real usage sorting, preserving lazy loading and missing-image fallback. |
| References/privacy | `js/lift-routine.js`, shared validator, API owner forwarding, unapplied SQL | Retain every value and profile boundary. Carlos’s unmatched exercises remain custom until he explicitly confirms a catalog match. |

Recent audit fixes already in the tree: generator reserves volume for later sessions; auto five-day hybrid; eligibility reused for substitutions; edited-preview constraint checks; superset overlap uses primary **and secondary** muscles; unequal rounds rest normally; audio failure does not suppress visible completion; zero-workout weeks/local date ranges/BW-added records; equipment separation for progression. Preserve these fixes.

## Phase 1 — One exercise at a time

### Intended screen

1. **Before Start:** show workout name, optional program/block, exercise count, working sets and estimated duration. Show a compact ordered exercise list with a small licensed thumbnail or honest placeholder, equipment/load type, target sets/reps/RIR and superset grouping. Do not show suggested values as completed records.
2. **During a workout:** compact header with workout name, active minutes, `Exercise 2 of 7` and overall completed working efforts. A scrollable strip/list of large exercise selectors supports jumping without losing values. Selectors have text labels and completion state; thumbnails are optional decoration.
3. Render **one exercise card** with name, equipment/apparatus/load meaning, target, image/reference action, previous confirmed sets, editable current set fields and the recommendation explanation. Show all sets for that exercise, visually emphasizing the next unchecked set. Earlier sets remain editable; do not require a full-screen step for every input.
4. Primary action: **Complete set** (or the existing clearly labeled check control). Secondary actions: Previous/Next exercise and Workout overview. Keep editing, substitutions, warm-ups, drops, notes and permanent-plan update accessible in the existing action sheet/overflow menu.
5. Rest panel remains visible outside the keyboard, showing whose rest it is, remaining time/overtime, ±15s and dismissal. “Rest complete” is persistent visible state; it never checks a set or finishes the workout automatically.
6. At the last completed effort, show **Review and finish**. Keep the existing partial-finish confirmation and idempotent Finish/retry flow. Merely leaving the focused view never discards or finishes a workout.

Reuse `renderActive` logic by extracting small render/navigation helpers; do not duplicate `finishLift`, the draft object or set-completion logic between overview and focused modes. Offer an **All exercises** view using the same data for quick edits/accessibility. Default new workouts to focused mode; preserve a person’s explicit mode preference locally.

### Stable navigation state

Suggested new pure module: `js/lift-focus.js`.

- Exercises already have `runtime_id`; preserve it through navigation/reorder. Add a draft-only `runtime_set_id` to set rows because indexes/`set_no` change when warm-ups or rows are inserted/removed.
- Persist draft-only `focus: { mode, exercise_runtime_id, set_runtime_id }`. These fields must not leak into backend set records or backups.
- Hydrate missing IDs/cursors in old drafts on load. Keep workout/session UUID, start/finish timestamps, reference values, checked flags, units, notes, pause fields and timer deadline/alert marker exactly intact. Persist the normalized draft once; if storage fails, report it without silently clearing anything.
- Pure helpers should resolve cursor, find the next pending effort and handle deleted/reordered/substituted items. Use runtime identities, not array indexes as durable identity. Do not use exercise names as unique keys.
- Back/next/overview/library/reference navigation never marks a set complete or restarts a timer. Reload returns to the selected exercise; a removed selected exercise moves to the closest surviving pending exercise. A new substitution gets fresh identities and no old completion flags.

### Completion and grouping behavior

Keep `restEligible` as the authority for whether rest begins. The focus selector decides what to display next, not whether a set happened.

| Event | Focus behavior | Timer behavior |
|---|---|---|
| Ordinary completed working set | Highlight next unchecked effort in this exercise; after its final effort, select next unfinished exercise | Start resolved rest once; identify the completed exercise even if focus advances. |
| Warm-up completed | Next warm-up or first working set | Preserve current no-auto-rest behavior. |
| Primary set with attached drops | Move to its first unchecked drop | No rest until the final attached drop. |
| Superset round | Complete that member’s drops, then move to next member with an unfinished effort in this round | Start once every member with that round and its drops is complete. Unequal groups’ extra rounds rest normally. |
| Undo completion | Keep the user on the edited set | If it contributed to the currently running contextual timer, cancel that timer; never cancel another set’s timer. For legacy timers without context, leave the deadline unchanged. |
| Manual jump/Next exercise | Show selection without changing any completion | Existing timer continues. |
| All efforts checked | Review-and-finish state | No automatic Finish or 75 Hard credit. |

Do not auto-focus another number field or open the keyboard after completion. Preserve typed values, focused field/caret and scroll within the active card while editing. Respect reduced motion. Provide visible labels, `aria-current` for the active exercise, `aria-pressed` for checked sets and a polite status message for exercise changes; do not announce the countdown every half-second.

## Phase 2 — Explained rest suggestions

Suggested new pure module: `js/lift-rest.js`. It must return structured results such as `{seconds, source, reason, policyVersion}`. Reuse the existing timestamp timer and introduce no background service or notification dependency.

### Backward-compatible precedence

1. An explicitly entered exercise `rest_seconds` wins, **including zero**. Never use `||` for this fallback.
2. A null rest with new `details.rest_policy: 'auto'` opts into recommendations.
3. Missing policy or `'default'` retains today’s behavior: use `plan.default_rest_seconds`. Existing null-rest exercises must not silently change meaning.

Offer **Suggested / Plan default / Custom** in the exercise edit sheet, plus a workout-only override. Choosing Suggested clears the numeric override **only after that explicit user choice**. Existing Carlos/Sue plans retain their saved rest numbers; show a suggestion and an optional “Use suggested” action. Persist a permanent change only through the existing explicit plan-save action. New generated programs can opt into Suggested in their editable preview, but activation remains explicit.

Because the shared validator whitelists metadata, add and validate the optional exercise `rest_policy` field in `supabase/functions/_shared/lift-schema.js`. Test plan save/backup round-trips and old metadata. Existing proposed JSONB columns can hold it; do not add a database table just for a presentation preference. Any deployment still requires separate authorization.

### Version 1 policy to implement

These are transparent, editable **product defaults**, extending the existing 90/120/180-second rules. They are not claimed to be Alpha Progression’s algorithm, medical advice, or individually optimized recovery. Keep constants configurable and document them in `LIFT_PROGRAMMING.md`.

| Evidence | Suggested base |
|---|---:|
| Confirmed compound metadata, strength goal or prescribed upper rep target ≤6 | 180 seconds |
| Other confirmed compound | 120 seconds |
| Confirmed isolation | 90 seconds |
| Custom/unmapped/unknown mechanic | Existing plan default; explicitly say classification is unknown |

- Do not infer compound versus isolation from equipment alone: a machine press can be compound and a cable movement can be either. Do not infer a classification for Kettle SQ Extension or silently map Carlos’s custom movements.
- In Auto only, optionally add **30 seconds** after an exact, confirmed RIR ≤1 set. Label the reason, e.g. “2:30 suggested · compound movement, last set reported 1 RIR.” Do not repeatedly add time to a running timer, infer effort from unchecked values, or treat qualified `5+` as exact.
- Apply an explicit 60–300s bound to *classified automatic* recommendations. Keep custom/default values, including 0, within the existing validated 0–3600s range. Unknown movements use the plan default unchanged.
- For a completed superset round, resolve rest for each member in that round and use the maximum, once. Explain “Rest after superset.” A member’s zero remains valid, but does not erase another member’s positive rest. For drops, use the parent movement and the final confirmed effort’s exact RIR if available.
- The suggestion is always overrideable. Timer ±15s affects only that countdown; it does not rewrite the plan. No rest recommendation changes weight, reps, set counts, progression or challenge credit.
- Show the selected base before the set; show any effort adjustment when it completes. Do not require extra taps to accept a recommendation on every set after the user opted into Auto.

Extend `startRest(seconds, context?)` compatibly. Persist optional draft-only context with contributing exercise/set runtime IDs, original chosen seconds, source/reason and policy version. Keep `timer_end` as the clock’s source of truth. Pause/resume, ±15 and reload must retain the context and alert marker. Do not reset a running deadline because focus, settings, catalog or plan changed.

Update the generator/duration estimator to reuse policy base durations for new Auto programs. Include the possible effort extension in a clearly labeled duration range or conservative allowance; never claim an estimate is a measured workout time. Add new modules to `sw.js` precache and check module delivery in the sample preview.

## Phase 3 — Make existing analytics easier to use

Extend `trainingAnalytics`, `exerciseSeries`, `plannedDates`, `analyticsRange` and `renderAnalytics`. Preserve their cautious bodyweight/apparatus/RIR rules. No new analytics backend or paid chart library.

### Overview cards

Use the existing `.stats` / `.stat` card patterns. Show:

- Saved workouts in range and workouts this week.
- Active training days and average active duration.
- **Active-week streak**, defined below.
- Planned-session adherence only when an explicitly activated weekday schedule exists.

Then reuse the existing weekly frequency chart, direct/estimated indirect muscle work, exercise trend selector, range records and reported-fatigue trend. Add a concise “Since the previous comparable session” summary only when evidence exists. Keep the exact set values available and show sample labels in preview. No invented progress for starting references, and no invented percentage when baseline is zero or unavailable.

### Define the streak before coding

- Calendar weeks start Monday in the profile timezone; use the same local-day semantics as saved workouts.
- A week is active if it contains at least one confirmed saved workout. This is a training-consistency metric, **not** completion of 75 Hard or proof of hitting a weekly plan.
- If this week has a workout, count consecutive active weeks backward from this week. If not, count backward from the previous week so an unfinished current week does not immediately erase the streak. An empty completed week breaks it. Empty history gives zero.
- Calculate the current streak from all fetched confirmed history, not the selected chart range; label that difference. Deleting a workout must update it. Prefer no celebration before backend confirmation.

### After Finish succeeds

Present a compact saved-workout summary: exercise count, completed primary/drop/warm-up counts separately, active duration, cautious external-load volume and comparable records achieved. Then present the existing separate optional 75 Hard credit action. A failed save stays in Retry Finish and must not show a saved record/streak increase. Compute new records against pre-save confirmed history, excluding this session’s UUID on retries; do not call a first recorded performance an improvement over a nonexistent baseline.

Keep bodyweight rep records and added-load records distinct; no total bodyweight assumptions, no assisted/unknown-load e1RM, no cross-machine comparison. Qualified RIR remains qualified. Charts should have text/table equivalents, a useful empty state and no fabricated fatigue/recovery score.

## Phase 4 — Compact library and plan browsing

- Render catalog results as compact existing-app rows: thumbnail/placeholder, name, equipment, key muscle and favorite control. Keep details/instructions/alternatives in a sheet. Continue bounded pages, lazy photos and text-first offline operation.
- Add sorting by Name, Favorites and Most used. Most used means **distinct confirmed saved sessions containing that catalog ID**, not number of sets, seeded references or fabricated popularity. Count each ID once per session. Unmapped custom records remain separate; no name-based merging. If complete history is unavailable, clearly label the loaded-history scope or disable usage ranking.
- In workout overview show explicit superset grouping, planned sets and warm-ups separately. Keep missing images usable; do not bulk-download all 1,746 photos on app startup.
- Offer a separate **Review exercise matches** flow for unmapped routine movements. Candidate matching must keep apparatus/grip variants distinct and require explicit confirmation. Never replace Kettle SQ Extension, erase starting references or transfer progression evidence just to get a thumbnail.
- Preserve privacy: usage, records, favorites and screenshots of personal data belong only to the authenticated profile. No public leaderboard/share action is implied by the reference images.

Body measurement tracking, trophy systems, native Live Activities, external sharing and AI coaching are outside this implementation pass. Do not build them merely because a screenshot contains them.

## Phases and file ownership for implementation

Implement sequentially; each phase should leave the app usable. No need for parallel agents.

| Phase | Main files | Exit condition |
|---|---|---|
| 0: preserve baseline | docs, existing tests and git inspection | Existing tests pass; report missing tools; preserve dirty tree. |
| 1: focused logging | `js/views/lift.js`, `js/lift-focus.js` (new), `js/lift-domain.js`, `js/lift-store.js`, `css/app.css` | Legacy/new drafts retain data; focus navigation and grouped completion tests pass; overview and focused modes use one logger. |
| 2: suggested rest | `js/lift-rest.js` (new), existing timer/store/domain/generator, exercise editors, shared validator, `sw.js` | Precedence/zero/unknown/group/effort/recovery tests pass; no timer rewrite or automatic migration of saved rest choices. |
| 3: analytics experience | `js/lift-analytics.js`, `js/lift-programs.js`, existing Finish success flow, CSS | Accurate streak/record/retry/deletion/date tests; no duplicate metrics engine or automatic challenge credit. |
| 4: browsing refinement | existing catalog/library/home rendering and mock fixtures | Accurate usage ranking, images/fallbacks, explicit mappings and independent profiles. |
| 5: acceptance + handoff | tests, `tools/lift-preview.mjs`, audit/handoff docs | All available checks pass; real-browser/device/database checks explicitly distinguished; no deployment. |

Suggested new tests: `tests/lift-focus.test.mjs`, `tests/lift-rest.test.mjs`, plus extensions to the existing analytics/platform, store, timer-recovery, references, offline, API and preview suites. Test actual state transitions/calculations, not HTML snapshots that simply mirror the implementation.

## Required acceptance cases

**Focused logger:** legacy draft hydration; return to exact exercise/set after refresh; insert/remove warm-up; reorder/delete selected exercise; replace a movement; jump away and back with unfinished inputs; undo completion; drops; unequal supersets; pause/resume; finish partial; fail Finish offline and retry same UUID. No other person’s cursor/data appears.

**Rest:** explicit 0/90/240 overrides; legacy null keeps plan default; opted-in compound 120 / heavy compound 180 / isolation 90; unknown uses default; exact RIR ≤1 extension only in Auto; qualified RIR does not trigger it; max-of-round superset rest; warm-up/drop suppression; no double start; navigation does not reset; ±15/dismiss/expiry/overtime; pause and reload retain reason/context/alert marker; audio failure still gives visible feedback. No native locked-screen guarantee.

**Analytics:** no history; references only; one confirmed workout; several weeks including gaps; incomplete current week; Monday/timezone/year boundaries; deletion breaks/restores streak correctly; partial workout; units conversion; distinct apparatus/assistance/added/BW; qualified RIR; no unchecked/drop evidence for primary progression/e1RM; previous-range baseline missing/zero; save retry does not double-count records or usage.

**Browser:** 320, 375 and 390px, both themes, readable numeric inputs, 44px tap targets, keyboard open with timer active, bottom navigation/sheet overlap, large text/reduced motion, image failure, manual navigation, screen-reader labels/status, storage pressure and airplane-mode recovery. Inspect images and actual exercise selection. Do not replace these with DOM-stub tests in the completion report.

Run the existing checks:

```sh
for f in js/*.js js/views/*.js tools/lift-preview.mjs supabase/functions/_shared/lift-schema.js sw.js tests/lift-*.mjs; do
  node --check "$f" || exit 1
done
for f in tests/*.test.mjs; do node "$f" || exit 1; done
node tests/note-slots.test.ts
git diff --check
```

When available, also run `deno run tests/note-slots.test.ts` and `deno check --no-lock supabase/functions/api/index.ts`. Local browser/database testing is required before release; no installation of new project dependencies is authorized. If tools are unavailable, finish unaffected implementation and report the exact missing checks rather than claiming them passed.

## Preview and delivery to the user

Use **only** `node tools/lift-preview.mjs` for interactive sample work. Generic static servers retain the normal live API configuration.

- Carlos sample: `http://127.0.0.1:4175/?k=sample-a&tab=lift`
- Sue sample: `http://127.0.0.1:4175/?k=sample-b&tab=lift`

The preview must retain its sample banner, mock per-profile API, CSP/local media routing, blocked unsupported actions and disabled service worker. Add clearly labeled compound/isolation/unknown, uneven-superset and fatigue/streak sample scenarios; never add fixtures to production. Loopback opens on the development computer, not directly on a phone. Service-worker/installed-PWA behavior needs a separately isolated local test configuration, never a live private link.

Final implementation report: what changed, concrete files, checks actually passed, UI/database checks still unverified, how to try focused mode and suggested rest in the sample preview, and remaining unapplied backend/release steps. Update the audit statuses from evidence. Leave everything uncommitted and undeployed.

## Copyable instruction for the next model

> Implement `LIFT_NEXT_IMPLEMENTATION.md` on top of the current uncommitted Lift implementation in `/home/flogal_dev/75-Hard-C-S`. Read the listed audit/handoff files first, preserve all existing work, and complete phases 0–5 in order. Prioritize one-exercise-at-a-time logging, backward-compatible explained rest suggestions, and clearer analytics. Reuse the current timer, draft persistence, progression and authenticated APIs; do not rebuild them. Preserve Carlos’s exact starting references, Sue’s glute/leg template, both themes and all 75 Hard behavior. Use the isolated sample preview only. Add no dependencies and do not access production, touch Flogal, commit, push, merge, deploy or apply migrations. Report tested versus unverified behavior honestly.
