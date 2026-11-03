// The edge functions run copies of the app's rules and daily-line code. They must match js/.
// If this fails: run tools/sync-shared.sh, then redeploy api and notify.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
for (const f of ["rules.js", "daily.js", "daily-lines.js"]) {
  const app = readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8");
  const fn = readFileSync(new URL(`../supabase/functions/_shared/app/${f}`, import.meta.url), "utf8");
  assert.equal(fn, app, `supabase/functions/_shared/app/${f} is out of date: run tools/sync-shared.sh`);
}
console.log("ok  edge functions use the same rules and daily lines as the app");
