# Lift requirement audit

Audit dates: 2026-11-14–15. Scope: the detailed product brief, overridden by the continuation prompt (starting references **never** become historical sessions), plus Sue’s explicit glute/leg preference. Branch `codex/lift-tracker`; `99bdf03` is an ancestor of HEAD. Existing uncommitted changes remain uncommitted. No production data was read or written.

**The timer exists.** Start a workout, enter valid values, and check a working set. Rest appears above the bottom navigation. Warm-ups do not trigger rest; supersets/drop chains wait for their eligible final effort. Zero rest completes immediately.

Status meanings:

- **Implemented and tested**: the named scope ran successfully in local automated tests. This never means a physical phone or PostgreSQL was tested.
- **Implemented but unverified**: code exists, but the relevant browser, device or database execution has not been verified.
- **Partial**: a narrower behavior exists; the missing scope is stated.
- **Missing**: no implementation. Optional/excluded features are explicitly identified.

## Architecture, boundaries and integration

| Requirement | Status | Evidence and limits |
|---|---|---|
| Extend existing vanilla JS/static PWA; no rebuild/framework/dependencies | Implemented and tested | Browser JS syntax checks and all 31 imported module URLs pass. Existing `js/views/lift.js`, `js/lift-store.js`, CSS and API extended. No package/build system added. |
| Preserve branch, base commit and uncommitted work | Implemented and tested | `git branch --show-current`, `git cat-file -t 99bdf03`, ancestry check and working-tree inspection. No git mutations. |
| Navigation Today → Board → Photos → Lift → You | Implemented but unverified | [js/app.js](js/app.js); source inspected, real browser navigation pending. |
| Existing components, typography, cards, buttons, sheets, icons, both themes | Implemented but unverified | [css/app.css](css/app.css), [js/util.js](js/util.js), [js/views/lift.js](js/views/lift.js); reuses tokens/components. Visual verification at 320/375/390px remains. |
| iPhone inputs, tap targets, keyboard/timer/nav avoidance, accessibility | Implemented but unverified | 16px/48px inputs, 44px buttons, labels/status feedback, bottom spacing and visualViewport handling. [lift-store test](tests/lift-store.test.mjs) verifies viewport logic with stubs, not Safari/layout/focus/screen-reader behavior. |
| Preserve 75 Hard calculations/daily lines/shared rules | Implemented and tested | [finish-line](tests/finish-line.test.mjs), [daily-lines](tests/daily-lines.test.mjs), [shared-sync](tests/shared-sync.test.mjs), [note-slots](tests/note-slots.test.ts) pass. No challenge algorithm changes in this audit. |
| Photos/reminders/widget/private links remain operational | Implemented but unverified | Their behavior was not changed. Camera, signed photo access, real push and widget regression checks require devices/backend; not proven by Node suites. |
| Save workout independently, then offer explicit eligible-day challenge credit | Implemented and tested | [finishLift](js/lift-store.js), [offerCredit](js/views/lift.js), [preview test](tests/lift-preview.test.mjs). Save never marks a checkbox. Same-local-day credit asks user to confirm 45 minutes and outdoor eligibility for workout 2; duration/outdoor judgment is manual. Actual click flow still needs browser verification. |
| No production/Flogal/deployment effects during development | Implemented and tested | Local work and synthetic preview only. No migration, function deployment, commit, push, merge or publishing executed. |

## Both starter routines and reference semantics

| Requirement | Status | Evidence and limits |
|---|---|---|
| Carlos: Push A / Pull A / Legs / Push B / Pull B, source names/order/values | Implemented and tested | [lift-routine.js](js/lift-routine.js), [references test](tests/lift-references.test.mjs). Source blocks inspected against supplied brief. Mixed weights and fractional RIR retained. |
| References never become History; source dates are provenance only | Implemented and tested | Routine loader saves plan metadata only. Reference tests and [preview test](tests/lift-preview.test.mjs) verify no new sessions. |
| Editable suggestions, unchecked sets, no false “last session” label | Implemented and tested | [exerciseDraft/workoutSuggestion](js/lift-domain.js), references test. Draft source is `reference` or `target` until comparable confirmed history exists; `last` is empty. UI distinguishes suggestions/confirmed history, still needs rendering check. |
| Preserve “5+” versus exact/fractional RIR through save/import | Implemented and tested | `rir_qualifier`, [shared validation](supabase/functions/_shared/lift-schema.js), references/platform/API tests. Qualified values do not become exact progression/e1RM evidence. |
| Keep prescription targets separate; assumptions editable | Implemented and tested | Exercise reference metadata is separate from sets/rep range/target RIR; shared validator and references tests. Plan editor provides reference fields and target fields. |
| No invented leg loads/bodyweight; preserve Kettle SQ Extension | Implemented and tested | References test verifies null external leg loads and the custom label. BW uses zero *external* load. |
| October 1 conflicting totals; visible list once | Implemented and tested | Pull B retains eight exercises/23 sets; `ROUTINE_FLAGS` discloses six/17 source-header conflict; no duplicate completion. |
| Preview, confirm, append/activate, archive prior rotation, repeat prevention | Implemented but unverified | [openRoutine](js/lift-programs.js) and [startingRoutine](js/lift-routine.js); data logic/repeat prevention tested, actual sheet/cancellation/activation flow needs browser testing. |
| Preserve history, active draft and dirty plan during loading | Implemented and tested | Loader changes plan only; guards dirty edits; [storage](tests/lift-store.test.mjs) and preview tests verify separate draft/history/profile behavior. Database archive behavior remains unverified. |
| Sue has full Lift access and separate glute/leg template | Implemented and tested | `sue-glute-leg-v1`: Lower A / Upper A / Lower B / Upper B / Lower C; catalog IDs verified, blank loads, no Carlos references, no inferred sex-based loads. References/generator/preview isolation tests pass. |
| Upgrade Sue’s older neutral template only by explicit choice | Implemented and tested | Separate import marker; test preserves `sue-five-session-v1`. Existing routine not rewritten automatically. |

## Full library and visuals

| Requirement | Status | Evidence and limits |
|---|---|---|
| Full pinned catalog, original IDs/revision/license, no proprietary Alpha media | Implemented and tested | [catalog JSON](js/exercise-catalog.json), [source manifest](js/exercise-catalog.source.json), [license/source](icons/exercises/SOURCE.md). 876 unique IDs and snapshot SHA-256 checked in platform tests. |
| Search all entries by name/aliases/muscles; filter equipment/muscle/level/category | Implemented and tested | [filterCatalog](js/lift-catalog.js), library/platform tests. Library renders 30 matches at a time with Show more; catalog is not restricted to 28. |
| Instructions, primary/secondary muscles, equipment/difficulty and missing metadata | Implemented but unverified | [info/mountLibrary](js/lift-library.js); source values rendered honestly, no unsupported equipment mapping. DOM presentation unverified. |
| Favorites and custom exercises with persistent profile ownership | Implemented but unverified | `updateDetails/customEditor`, shared validation and owner-scoped plan API. Save code exists; no real database/browser confirmation. |
| Alternatives, movement patterns and rep guidance | Implemented and tested | Shared `eligibleExercise/replacementCandidates`, `exerciseGuidance`; generator/platform tests. Detail sheet integration unverified. Pattern hints are explicitly inferred; rep defaults are assumptions, not upstream data. Unclassified movements remain unclassified. |
| Preserve variants, apparatus identities, unmatched routine entries and catalog-update independence | Implemented and tested | Stable source IDs plus plan/session snapshots; custom Kettle label and incompatible-equipment progression tested. Carlos mappings require explicit selection. |
| Available photos, lazy loading and failure fallback | Implemented but unverified | `loadMedia` uses pinned URLs for 1,746 image paths, lazy images and explicit failure text. Preview serves 56 local images for 28 exercises; other images deliberately fall back. No full-catalog image/browser inspection was performed. |
| Offline catalog text, bounded viewed-photo cache, no full media startup download | Implemented and tested | [sw.js](sw.js), [offline VM test](tests/lift-offline.test.mjs): required text precache, at most 40 photos ≤1 MiB each, quota fallback. Installed-PWA/offline rendering remains unverified. |
| Open references during workout without clearing inputs/timer or rerendering workout | Implemented but unverified | `showReference` overlays existing sheet, reads catalog only, never resets draft/timer. Actual scroll/focus behavior needs browser testing. |
| Detailed equipment/anatomical taxonomy beyond upstream labels | Partial | Exact catalog variants retained; broad `machine`/`shoulders` categories cannot establish every accessory, Smith-only setup or precise deltoid stimulus. Named focus preferences rank patterns, and unknowns remain explicit. No fabricated metadata. |

## Generator, progression and adjustments

| Requirement | Status | Evidence and limits |
|---|---|---|
| Questionnaire: six goals, experience, 2–7 days, weekday/flexible schedule, time, 20–120 minutes | Implemented but unverified | [openGenerator](js/lift-programs.js); generated input validation and schedule constraints tested. Actual form flow unverified. Preferred time is stored; it does not change reminders. Unselected weekdays provide rest days. |
| Equipment, ranked muscle priorities, favorites/exclusions, restriction words, split/reps/intensity/superset preferences | Implemented and tested | [generateProgram/eligibleExercise](js/lift-generator.js), [generator tests](tests/lift-generator.test.mjs). Equipment individually selected; no gym preset silently assumes availability. Injury terms are text filters with unmatched-term warnings, not medical clearance. |
| Full-catalog deterministic candidate filtering/ranking and explanation | Implemented and tested | Deficit/favorite/compound/repetition rules with stable ID tie-break; eligibility shared by replacements. No random selection, fixed-template-only generation or paid AI dependency. |
| Split recommendation and weekly distribution | Implemented and tested | Auto 2–3 full body, 4 upper/lower, 5 PPL/upper/lower hybrid, 6–7 PPL; explicit lower-first also available. New tests verify later sessions retain work at 5/6/7 days. |
| Direct/estimated indirect work, priority targets, overlap caps, duplication control | Implemented and tested | `muscleWork`, capped projected work and daily shares of remaining direct targets; deterministic/cap/restriction tests. Exact stimulus/recovery cannot be inferred. |
| Sets/reps/RIR/rest, warm-up allowance, realistic duration, unmet-constraint warnings | Implemented and tested | Generator/duration tests; work/rest/transitions/warm-up included, no assumed superset time savings. Configured warm-up value now appears correctly in explanation. |
| Schedule recovery and restricted movements | Implemented and tested | Consecutive-day primary-muscle overlap warnings include week wrap; filters include secondary-muscle exclusions. These are reviewable heuristics, not a readiness or injury-safety assessment. |
| Editable preview, replacement, validation after edits, separate save/explicit activation | Implemented but unverified | `renderGenerated/openPrograms`. Pure `programReview` now rechecks time, eligibility and weekly caps after edits; tests pass. Actual save/activation sheets and backend writes need verification. |
| Existing double progression, rep/load increases, equipment increments, lb/kg rounding | Implemented and tested | [lift-rules.js](js/lift-rules.js), [rules tests](tests/lift-rules.test.mjs), references/platform tests. Mixed set weights remain separate. |
| Use confirmed comparable performance, never unchecked references or missed-day penalties | Implemented and tested | [workoutSuggestion/adjustment](js/lift-domain.js), platform/reference tests. Equipment, apparatus and load types compared; warm-ups/drop sets excluded. |
| Plateau, repeated below-range deload, fatigue, suggested volume reductions and replacements | Implemented and tested | Three unchanged comparable sessions; two below-range sessions; fatigue 4–5 optional fewer-set/lighter-session advice; filtered replacements. Rule tests exercise these branches; recommendations do not automatically rewrite plans. |
| Block planning and program revisions | Implemented but unverified | `openPrograms` saves named blocks with start/end dates and archives rotations before activation; sessions snapshot the block/program. These are manual planning and saved revision snapshots, not automatic periodization or a revision-diff timeline. Actual save/activation behavior needs browser/database verification. |
| Appropriate e1RM and range records | Implemented and tested | `safeMetrics` allows mapped compound barbell/dumbbell low/moderate-rep exact-RIR sets only; no drops/BW/added/assisted/unknown estimates. Records keep apparatus/load types separate. |
| Every suggestion editable and explained; no automatic program rewrite | Implemented but unverified | Logger inputs, plan editor, preview/save/activation confirmations and advice text present. Pure suggestion logic tested; full interaction review pending. |

## Logger and timer acceptance criteria

| Requirement | Status | Evidence and limits |
|---|---|---|
| Start, pause/resume, elapsed time and completion progress | Implemented and tested | `exerciseDraft/togglePause/elapsedSeconds`, platform tests, active logger. Pause freezes remaining rest and excludes paused duration. DOM controls unverified. |
| Add/edit/reorder/remove/substitute exercises; explicit permanent-plan update | Implemented but unverified | [renderActive/editActiveExercise](js/views/lift.js). Workout-only snapshots/temporary IDs and explicit plan confirmation exist. Browser interaction tests still required. |
| Weight/reps/fractional or qualified RIR; previous confirmed performance alongside suggestions | Implemented and tested | Domain/reference/schema tests and logger code. Blank loads cannot be checked as complete; saved data validates limits. Input ergonomics needs phone review. |
| Warm-ups, working sets, supersets/drop sets, notes | Implemented and tested | Rules/platform tests cover warm-ups and rest semantics; logger provides separate working/drop rows, notes and group labels. Actual buttons/group editing unverified. |
| Bodyweight, added load, assistance and unknown loads | Implemented and tested | Domain/schema/reference/platform tests; no invented bodyweight or misleading total-load volume/e1RM. Assistance changes stay manual. |
| Partial finish with confirmation; save actual completed sets only | Implemented but unverified | `renderActive` confirms unfinished sets; `finishLift` serializes checked sets only. Storage/API tests cover writes, but the confirmation click flow is unverified. |
| Persistent interrupted drafts, offline failure/retry, no premature deletion or duplicate save | Implemented and tested | [store tests](tests/lift-store.test.mjs): failed Finish retains UUID/timestamp, cleanup only after confirmation; preview duplicate retries tested. Real SQL idempotency remains unverified. |
| Plate calculator and editable units/plates/bar/rest defaults | Implemented and tested | Rules tests cover conversion, non-greedy plate combinations, fractional precision and leftovers; settings UI present but unverified on phone. |
| Timer starts on eligible completion, default/override/zero rest | Implemented and tested | [startRest/tick](js/lift-store.js), [restEligible](js/lift-domain.js), timer/recovery/platform tests. Logger passes exercise override or plan default. |
| ±15s, clamp at zero, dismissal, expiry and overtime | Implemented and tested | [timer tests](tests/lift-timer.test.mjs) and [actual-store recovery tests](tests/lift-timer-recovery.test.mjs), including click-handler adjustments/dismissal. |
| Persisted deadline; reload/navigation/background/interruption recovery; duplicate alerts | Implemented and tested | Actual store logic restores deadline and alert marker; hidden/visible recovery tested with DOM stubs. Interval paints only. No claim of real iPhone suspension testing. |
| Warm-up/superset/drop semantics, including unequal superset rounds | Implemented and tested | Platform tests: no warm-up rest, wait for paired round/final drop, extra unmatched rounds rest normally. |
| Visible expiry survives unavailable audio | Implemented and tested | Recovery test forces AudioContext oscillator failure and still gets visible completion. Timer text persists after toast. |
| Audible/vibration completion on supported physical devices | Implemented but unverified | User-gesture audio unlock and optional vibration implemented; actual phone audio/vibration and lock/unlock untested. |
| Timer does not obscure controls/keyboard/bottom navigation | Implemented but unverified | CSS spacing/stacking and visualViewport handling exist; viewport unit checks pass. Requires 320/375/390px light/dark visual checks. |
| Native Live Activities or guaranteed locked-screen alarms | Missing | Explicitly excluded by the continuation prompt; this PWA must not promise them. No OS timer push scheduling added. |

## Analytics, backup, privacy and delivery

| Requirement | Status | Evidence and limits |
|---|---|---|
| Saved exercise history/strength trends, including temporary movements | Implemented and tested | [exerciseSeries](js/lift-analytics.js), platform tests; actual History/Progress charts and pagination rendering unverified. |
| Frequency, duration, completed workouts, direct/estimated indirect muscle distribution, working volume | Implemented and tested | `trainingAnalytics`, platform tests; unknown/unmapped data remains explicit. Charts/text use confirmed records only. |
| Adherence and consistency | Implemented and tested | Activated program’s dated weekdays compared to matching saved sessions; no pre-activation history inferred. Zero-workout weeks and active/selected-week counts tested. Today/partial boundary weeks explicitly included. |
| Personal records including bodyweight and added load | Implemented and tested | Separate BW repetition records and added-load records added; warm-ups/drops/assistance/unknown excluded. No invented total bodyweight. Platform tests pass. |
| Fatigue trends and multiple/custom date ranges | Implemented and tested | At least three fatigue reports for trend; inclusive ranges in profile timezone; reversed dates rejected; date field changes select custom range. Calculation tests pass; frequency/fatigue SVG presentation unverified. |
| Backup format/version/validation/duplicate prevention/merge versus replace | Implemented and tested | [lift-backup.js](js/lift-backup.js), [shared validator](supabase/functions/_shared/lift-schema.js), platform/API/preview tests: incompatible owner/version, conflicting UUID content and malformed structures rejected. |
| Backup preview, confirmation, file download, recovery from invalid JSON | Implemented but unverified | [openBackup](js/lift-programs.js). UI stops invalid imports and guards drafts/dirty plans. Actual file-picker/download/confirmation behavior unverified. |
| Backup database atomicity/rollback/concurrent-write protection | Implemented but unverified | [unapplied proposal](supabase/proposals/lift_platform.sql): owner lock, plan version/session revision, transaction, foreign-ID checks. No PostgreSQL execution performed; mock success is not transaction evidence. |
| Existing authenticated API; no browser service-role access | Implemented and tested | [API handlers](supabase/functions/_shared/lift.ts), [API tests](tests/lift-api.test.mjs): authenticated `me.id` forwarded, client owner cannot override it; schema whitelists bounded metadata. |
| Plans/workouts/preferences/imports/drafts isolated between Carlos and Sue | Implemented and tested | Browser SHA-256 private-key namespace tested; API owner forwarding and sample isolation tests pass. Actual RLS/grants/foreign-owner SQL behavior remains unverified. |
| DB-level isolation, migrations and deployment-ready persistence | Implemented but unverified | Original additive migration plus extension SQL proposal; service-role-only RPCs and existing RLS model retained. Neither migration applied; Deno/database/real-backend smoke tests remain mandatory. |
| Offline shell/catalog plus device-local draft recovery | Implemented and tested | Storage and SW VM tests pass. Installed-PWA shell reload/airplane mode and quota behavior on iOS remain unverified. History/Finish need network; drafts do not sync between devices. |
| Isolated clearly labeled sample preview; no production API calls | Implemented and tested | [tools/lift-preview.mjs](tools/lift-preview.mjs), HTTP preview suite: sample-only keys, separate synthetic profiles, CSP `connect-src 'self'`, local media rewrite, no forwarding, SW disabled, protected file paths denied. |
| Real-browser/physical-phone acceptance, Deno checks and local SQL tests | Missing | No browser runner, Deno, Supabase CLI or PostgreSQL available. No dependency installed to bypass the constraint. Explicit outstanding verification, not a completed phase. |
| Optional AI coaching | Missing | Optional in the brief. No paid API or AI coaching integrated; deterministic generation/progression works independently. No new service was introduced. |

## New screenshot-driven request (2026-11-15)

The user subsequently requested an implementation plan for another model. See [LIFT_NEXT_IMPLEMENTATION.md](LIFT_NEXT_IMPLEMENTATION.md). The following are planned extensions, not completed features:

| Requirement | Status | Evidence and next step |
|---|---|---|
| One exercise at a time with persistent focused-set navigation | Missing | Current `renderActive` shows every exercise. Next plan phase 1 extends the existing logger/draft model. |
| Explained exercise/effort-based suggested rest with explicit automatic/manual choice | Partial | Generator and routine timers already have different fixed values; current logger supports overrides/defaults. Next plan phase 2 adds a shared opt-in policy while retaining the timer engine. |
| Weekly streak, post-save summary and compact analytics cards | Partial | Frequency, duration, records, muscle work, fatigue, adherence and trends already exist. Next plan phase 3 adds presentation and defined streak/summary behavior. |
| Thumbnail-focused browsing and most-used sorting | Partial | Catalog/photos/favorites exist. Compact rows and usage ranking are planned in phase 4. |

No extra workout records, bodyweight or targets were imported from the reference screenshots. The plan is an implementation handoff, not a claim that these new screens have been built.

## Work completed during this audit

1. Fixed front-loaded generator volume that could leave day seven empty; reserve weekly direct work for later exposures, plus automatic five-day hybrid.
2. Shared generation/replacement eligibility and revalidated edited previews against equipment, experience, exclusions, time and volume. Added adjacent-day overlap warnings and correct warm-up explanation.
3. Added library alternatives and honest movement/rep guidance without modifying upstream data.
4. Fixed rest for unequal superset extra rounds; kept visible expiry working when audio APIs throw; expanded timer recovery tests.
5. Added zero-workout weeks, local inclusive date ranges, bodyweight/added-load records and frequency/fatigue charts. Excluded drop sets from e1RM and differing equipment from progression.
6. Updated handoff/programming notes. All pre-existing working-tree changes retained. No schema/dependency/deployment changes in this audit.

## Checks actually run

Node **24.18.0**: all **14 `.test.mjs` suites** and `node tests/note-slots.test.ts` passed. Syntax checks passed for all browser modules, the preview server, service worker, shared JS validator and Lift tests. `git diff --check` passed. HTTP test verified all 31 imported browser modules are served. This is **not browser execution**.

The suites are daily-lines, finish-line, shared-sync, lift-api, lift-generator, lift-library, lift-offline, lift-platform, lift-preview, lift-references, lift-rules, lift-store, lift-timer-recovery, lift-timer, and note-slots. New regression cases cover later-session allocation, shared restrictions, edited-preview caps, week-boundary recovery warnings, unequal supersets, audio failure, persisted adjustments/dismissal, date ranges, zero weeks, BW/added records and equipment separation.

## Preview and remaining release gates

From the repository run `node tools/lift-preview.mjs` if the server is not already running. Open:

- Carlos sample: <http://127.0.0.1:4175/?k=sample-a&tab=lift>
- Sue sample: <http://127.0.0.1:4175/?k=sample-b&tab=lift>

Refresh to load changed JS. Choose **Load my starting routine**, review/confirm, then **Start workout**. Check a set to see the timer. Both links are sample keys; never paste a production private link into the preview. Data is synthetic/in-memory and resets when the server restarts. Browser drafts persist on the preview origin. This loopback URL opens on the development computer, not directly on an iPhone. Preview SW is disabled; it cannot validate installed-PWA offline behavior.

Before deployment, follow [LIFT_HANDOFF.md](LIFT_HANDOFF.md): run Deno checks, create/review the extension migration from its proposal, execute both SQL changes against a disposable local database and test isolation/idempotency/rollback/concurrency, complete 320/375/390px light/dark browser and physical-phone checks, and verify unchanged photos/reminders/widget behavior. Only after separate authorization should the personal database/API/frontend be deployed. No deployment was performed here.


## Implementation update: 2026-11-15

The earlier screenshot-request “Missing” rows are superseded for focused exercise navigation and explained rest: both now have local implementations and `lift-focused.test.mjs` coverage. See the latest section in `LIFT_HANDOFF.md` for exact scope and remaining refinements. Starting reference prefilling was verified as already working; no fake History created. Catalog usage sorting, basic streak and post-save count/duration/volume summary are now implemented. UI execution is **implemented but unverified**, because no browser runner is available; HTTP delivery and pure calculations pass. New-record summary, match-review wizard and richer overview remain partial. Original database and physical-device release gates remain open.
