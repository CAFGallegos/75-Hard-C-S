# Lift programming and data assumptions

This is a deterministic planning aid with editable prescriptions, not medical clearance, diagnosis, or a guarantee about a particular injury. No paid API is used.

Sources reviewed for the programming approach:

- Currier et al. (2023), systematic review and network meta-analysis: https://pubmed.ncbi.nlm.nih.gov/37414459/
- Robinson et al. (2024), proximity to failure meta-regressions: https://pubmed.ncbi.nlm.nih.gov/38970765/
- ACSM (2026), overview of reviews: https://doi.org/10.1249/MSS.0000000000003897

These sources support using resistance training, multiple sets, goal-dependent loading and attention to effort. The exact defaults below are conservative product heuristics; the papers do not validate this generator or an individual's exercise selection.

## Generator v1 rules

The full pinned Free Exercise DB text is considered. Strength exercises are filtered by explicitly selected equipment, exclusions, catalog experience level, muscle exclusions and restriction words across names/instructions/muscles. Beginner selection requires the beginner label; intermediate excludes expert. Null/other equipment is not silently remapped. A commercial gym label does not imply every item is available. Review the instructions and select all equipment you actually have; catalog equipment fields do not list every accessory such as benches/racks.

Ranking is deterministic: remaining direct-set deficit (high priorities have twice the score), a favorite bonus, a compound bonus, penalties for repetition across days and similar muscle/equipment choices within a day, then source ID to break ties. No random exercise choice. Strength defaults to 4–6 reps, endurance 15–20, other goals 8–12. Target RIR defaults to 4/3/2 for easy/moderate/hard, never automatic failure. Rest defaults to 180s for strength, 120s for compounds and 90s for other work.

Default direct weekly targets are 6/9/12 for beginner/intermediate/advanced, ×1.25 for a high priority, 3 for maintenance, 0 for excluded muscles. Direct targets and estimated indirect sets are bounded by the weekly limit. Default maximum is 14 combined set equivalents per muscle and seven exercises per session. These are editable limits, not proven individual optimal doses. Secondary muscles count as 0.5 estimated indirect sets; this is a rough bookkeeping assumption, not measured stimulus. Priority shortages and impossible constraints are reported rather than filled with unsuitable movements. Missing or broad muscle metadata cannot establish precise upper-chest or deltoid-head stimulus. Full-body, upper/lower (either order), PPL and five-day Push/Pull/Legs/Upper/Lower options distribute sessions in a rotation. Automatic five-day generation uses the hybrid. Direct-set budgets reserve work for later exposures; earlier sessions cannot consume the entire weekly target. Selected consecutive weekdays with repeated primary muscles produce recovery warnings, including Sunday/Monday. Flexible rotations require the user to place rest days. This does not measure recovery readiness. Editable previews are rechecked against eligibility, time and combined-volume limits before saving.

Duration conservatively includes five minutes of general warm-up (configurable), three seconds per rep at the midpoint of the range, the full specified rest after every set, and 60 seconds of transition per exercise. Optional paired supersets do not reduce this estimate. Warm-up set suggestions in the logger are optional and add time beyond this general allowance. Times are estimates, not a live workout deadline.

## Confirmed performance and adjustments

Starting references are not History, PRs or progression evidence. The five-session routine is offered through an explicit load preview on each profile. Carlos’s version retains his supplied references; Sue’s separate version starts without copied performance or assumed external loads. Both can use their own training questionnaire. Source dates are provenance labels. Unknown Legs loads remain blank. Each actual set requires explicit completion. Fractional RIR is preserved; a lower bound such as 5+ is stored with `rir_qualifier=at_least` and is not silently treated as exact progression/e1RM evidence.

Double progression remains optional. It uses confirmed comparable primary working sets; warm-ups and drop sets are excluded. Different load types and apparatus identities do not share progression. Repeated below-range sessions can suggest a 10% deload rounded down to the equipment increment. A plateau heuristic requires three comparable sessions with unchanged per-set loads, reps and RIR, and fatigue 4–5 can suggest reducing one working set. These are suggestions only; no automatic plan rewriting. A missed day alone is never strength-loss evidence. Training blocks record user-chosen names and dates; no automatic block periodization is inferred.

Bodyweight (0 external load), added load and assistance are distinct. Bodyweight is never invented. Total-load volume/e1RM excludes these and unknown loads. External-load volume is load × reps; unilateral/dumbbell conventions and machine stacks remain apparatus-specific. e1RM is an Epley estimate using reps plus exact RIR, shown only for catalog-mapped compound barbell/dumbbell sets of <=12 reps and <=4 RIR. It is not a measured 1RM. Machines, isolation movements, unknown mechanics, assisted/bodyweight loads, qualified RIR, drop sets and unsuitable rep ranges have no e1RM estimate.

## Logger and timer semantics

Workout-only additions/substitutions use nullable exercise identities and snapshot their names/equipment/muscles/load type. They do not mutate a permanent plan or inherit another movement's history. Changing apparatus/load semantics during a workout resets that exercise's unsaved completion flags and loads after confirmation.

Warm-ups never start rest. Drop efforts are separately logged rows, included in working volume, excluded from primary progression/records, and suppress rest until the final drop is completed. Superset groups use matching primary set rounds and wait for each member (and its attached drops) to complete. Unequal groups wait for all members that have the same round; extra rounds use normal rest. Zero rest expires visibly immediately. Adjustments clamp at the present time, overtime remains visible, dismissal clears the timer, and pause stores remaining rest plus a pause timestamp. Resume restores the deadline; elapsed workout time excludes pauses. Alerts have a persisted deadline marker to avoid duplicate notifications after reload. If browser storage is unavailable across a reload, exactly-once alerting cannot be guaranteed.

The PWA cannot promise native Live Activities or locked-screen audio. On-screen expiry works when visible; sound needs user interaction, vibration depends on the browser. Phone acceptance checks remain required.

## Backup v1

The `75hard-lift` JSON format exports only the authenticated owner's saved Lift plan/settings/programs and session snapshots. Browser draft edits, unsaved workouts, challenge state, photos, keys and push credentials are excluded. Backup owner must match the current authenticated profile. Merge retains sessions/days by UUID and rejects conflicting content; replace explicitly replaces saved Lift data. The unapplied SQL proposal checks version/ownership and restores in one transaction; this has not yet been executed against PostgreSQL. Unavailable archived exercise IDs remain snapshot provenance instead of recreating archived plans. The export/import cap is 5000 sessions, with a 10 MB browser file limit; larger accounts require a future paginated export. Import is blocked while a workout or dirty plan draft exists.

Named upper-chest/front/side/rear-delt preferences affect ranking through explicit exercise-name patterns, subject to the overall chest/shoulder cap. These are transparent movement-name preferences rather than new upstream muscle labels or anatomical measurements. Excluded named variants and unmatched restriction terms are reported; users must review compound overlap themselves. Preferred training time is saved as a preference and never modifies 75 Hard reminders.


Sue explicitly selected glute/leg emphasis. Her optional five-session template alternates Lower A / Upper A / Lower B / Upper B / Lower C, using pinned catalog movements with blank loads and no Carlos performance references. Editable defaults are mostly two working sets (some accessories one), 3 RIR, 90–120s rest and movement-specific rep ranges. The emphasis follows the requested goal, not an inference from sex; her actual equipment, experience, technique, restrictions and scheduling remain to be reviewed. Three lower sessions and two upper sessions form a rotation rather than five prescribed consecutive days. The generator’s lower-first upper/lower option provides the same distribution at five available days; other schedules remain configurable. Existing plans are changed only through the existing preview/confirmation flow.


## Audit refinements

Library detail sheets now include alternatives filtered with the same eligibility function as generation, clearly labeled name-derived movement hints, and the editable default rep prescription. These do not invent missing upstream metadata or replace a movement without the user selecting it. Manual library selection remains available; generated preview saves recheck selected restrictions.

Analytics date ranges use the profile timezone and count the requested number of days inclusively. Weekly consistency includes zero-session weeks within the selected/recorded span, without treating missing sessions as strength loss. Bodyweight records compare reps; added-load records compare the external addition only, never total bodyweight or an inferred 1RM. Frequency and reported-fatigue charts retain exact text values below them. These UI paths still require browser verification; pure calculations have regression tests.
