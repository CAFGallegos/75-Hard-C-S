# Workout and daily-photo refinement

The existing workout logger is preserved. A small progress meter, exercise position, subtle completed-set background and consistent navigation improve orientation. Numeric inputs, timer, plan editing, muscle icons, references and history retain their behavior. A scroll-snap experiment was removed after the browser regression caught a partly hidden selected tile.

Optional body-weight logging is now a compact row with input, units, Save/Update and History. It remains off until enabled in Settings, scoped to the private link on this device, and unrelated to challenge credit. Cloud mode places the row alongside the daily-photo action beneath the comparison, preserving the row when the photo area repaints. Phone/album modes show the photo action before instructions, with weight alongside. Photo-load errors retain the weight form.

Synthetic mobile screenshots (320px, no real profiles/data):

- [Workout, light](workout-carlos-light.png)
- [Workout, dark](workout-sue-dark.png)
- [Compact weight, light](photos-carlos-light.png)
- [Compact weight, dark](photos-sue-dark.png)

Verification commands: all `tests/*.test.mjs` plus `tests/note-slots.test.ts`; `tests/release/lift-browser.test.mjs`; `tests/release/weight-browser.test.mjs`; `LIFT_VISUAL_WIDTHS=320,390 node tests/release/lift-visuals-browser.test.mjs`. The weight browser suite adds a <170px compactness assertion and verifies placement inside the cloud photo area, in addition to existing opt-in, persistence, CSV and profile-isolation checks.

Physical iPhone keyboard/camera and installed-PWA update/offline checks remain outstanding. Mock browser checks do not validate live backend permissions. No backend, dependency, migration, deployment or data changes are part of this refinement.

Final result: PASS 19 local suites, six workout/timer/reload/offline-save browser scenarios, twelve compact photo-weight browser scenarios, and eight visual scenarios. Both themes and both synthetic profiles were exercised; widths 320/375/390px for workout and weight, 320/390px for the visual matrix. Syntax and diff whitespace checks pass. Release preparation: service worker v13 refreshes the frontend shell. No backend changes.
