# Guided plan exercise editing

Open Lift → a workout under Your days → expand an exercise → **Edit muscles / replace exercise**. The Plan editor also has **Muscles / similar** beside each movement.

- Select primary/secondary target muscles. Confirmed catalog targets prefill; ambiguous movements do not receive guessed anatomy. Primary groups take precedence over duplicate secondary selections.
- Keep the movement and instructions in your custom library, including movements without pictures. Target edits preserve the exercise ID, starting references and logged history. Confirmed illustration identities stay linked. Repeated edits update the same custom entry.
- Alternatively, review up to five similar catalog exercises, their equipment, instructions and shared primary muscles. Included photos are the default filter; turning it off permits the broader catalog. Existing exclusions/preferences apply, with an explicit equipment filter. These are metadata matches, not equivalent technique or medical suitability.
- Replacement requires confirmation, assigns a fresh identity and editable catalog defaults, and transfers no starting weights/references. Old History and an already-running workout remain unchanged.
- Changes persist as an owner-specific draft. **Save plan** applies them through the existing version-checked API. No new endpoint, schema, dependency or asset license is required. Existing free photo attribution remains in icons/exercises/.

Verification: 19 local suites; eight guided-editor mobile browser scenarios (320/390px, two themes, both synthetic profiles); existing six workout/timer/offline-retry, twelve workout-preview and twelve optional bodyweight scenarios. Guided tests check target edits, custom-library entries, reference preservation, draft reload, replacement identity and mocked save/reload. Screenshots in review/guided-exercise-edit use synthetic data only.

Limitations: custom exercises still have no uploaded-photo feature; assigning muscles supplies context, not an invented demonstration. Broader catalog photos require network access and may fail gracefully. Physical iPhone keyboard/touch and installed-PWA update/offline acceptance remain outstanding. Browser preview disables service workers and does not establish live database permissions; no Supabase changes were made.
