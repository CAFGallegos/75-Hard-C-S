// Settings › Add home screen widget: copy the Scriptable script and my key, 4 steps.
import { store } from "./store.js";
import { icon } from "./icons.js";
import { sheet, toast, haptic } from "./util.js";

const SCRIPT_URL = "widget/75hard-widget.js";

export function openWidgetSetup() {
  // Fetch the script up front so the copy happens inside the tap (iOS clipboard rule).
  let scriptText = null;
  const scriptPromise = fetch(SCRIPT_URL, { cache: "no-cache" })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error("fetch"))))
    .then((t) => (scriptText = t));
  scriptPromise.catch(() => {});

  const s = sheet(`<div class="eyebrow" style="margin-bottom:10px">Home screen widget</div>
    <h2 class="h2">Add the S v C widget</h2>
    <p class="body" style="margin-bottom:6px">Your day, today's progress and today's line, right on your home screen. Uses the free Scriptable app.</p>
    <div class="widget-copy">
      <button class="btn btn-me btn-block" data-copy-script>${icon("rules")}Copy widget script</button>
      <button class="btn btn-ghost btn-block" data-copy-key>${icon("link")}Copy my key</button>
    </div>
    <ol class="steps">
      <li>Install <b>Scriptable</b> from the App Store (free).</li>
      <li>Open Scriptable, tap <b>+</b> to make a new script, and name it <b>75 Hard</b>.</li>
      <li>Tap <b>Copy widget script</b> above, paste it into the new script, and tap <b>Done</b>.</li>
      <li>On your home screen, add a <b>Scriptable</b> widget (small or medium). Long-press it, tap <b>Edit Widget</b>, pick <b>75 Hard</b>, and paste your key into <b>Parameter</b> (tap <b>Copy my key</b> first).</li>
    </ol>
    <div class="tip">${icon("lock")}<span>Your key is private. It only lives in your widget and your link.</span></div>`);

  const copied = (what) => { haptic("success"); toast(`${what} copied`, { ico: "check" }); };
  const failed = () => toast("Couldn't copy on this device. Try again.", { error: true });

  s.el.querySelector("[data-copy-script]").addEventListener("click", async () => {
    try {
      if (scriptText != null) await navigator.clipboard.writeText(scriptText);
      else if (window.ClipboardItem && navigator.clipboard.write) {
        // Still loading: hand iOS a promise so the copy stays tied to this tap.
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain": scriptPromise.then((t) => new Blob([t], { type: "text/plain" })),
        })]);
      } else await navigator.clipboard.writeText(await scriptPromise);
      copied("Widget script");
    } catch (_) { failed(); }
  });
  s.el.querySelector("[data-copy-key]").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(store.k); copied("Key"); } catch (_) { failed(); }
  });
}
