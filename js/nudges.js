// Nudges: a small push to the other person. 3 per day, max 60 characters. Not a chat.
import { store } from "./store.js";
import { icon } from "./icons.js";
import { esc, sheet, haptic, toast } from "./util.js";
import { errorText } from "./api.js";

export const NUDGE_MAX = 60;

// Presets, by sender.
export const PRESETS = {
  sue: ["Te toca, cabrón.", "Ya terminé. ¿Y tú?", "Agua, Eduardo.", "Te quiero. Ahora muévete.", "Hola hola, ¿qué haces?"],
  los: ["Te toca, señorita.", "Ya terminé. ¿Y tú?", "Agua, enana.", "Hola hola, ¿qué haces?"],
};

const leftLine = (n, per) => (n > 0 ? `${n} of ${per} left today` : "That's 3 for today. More tomorrow.");

export function openNudgeSheet({ onSent } = {}) {
  const nz = store.data.nudges ?? { left: 0, per_day: 3, partner_on: false };
  const partner = store.partner;
  const presets = PRESETS[store.data.me.id] ?? [];
  const out = nz.left <= 0;
  const s = sheet(`<div class="eyebrow" style="margin-bottom:10px">Nudge</div>
    <h2 class="h2">Nudge ${esc(partner.name)}</h2>
    <p class="body" data-left>${esc(leftLine(nz.left, nz.per_day))}</p>
    <div class="nudge-presets">${presets.map((t) =>
      `<button class="nudge-preset" data-text="${esc(t)}" ${out ? "disabled" : ""}><span>${esc(t)}</span>${icon("arrowR")}</button>`).join("")}</div>
    <div class="nudge-custom">
      <input class="nudge-input" type="text" maxlength="${NUDGE_MAX}" placeholder="Or write your own" enterkeyhint="send" ${out ? "disabled" : ""} data-custom>
      <button class="btn btn-sm btn-me" data-send disabled>Send</button>
    </div>
    <div class="field-foot"><span>Shows up on ${esc(partner.name)}'s phone and on Today. Gone after today.</span><span data-count>0/${NUDGE_MAX}</span></div>`);

  const input = s.el.querySelector("[data-custom]");
  const sendBtn = s.el.querySelector("[data-send]");
  const count = s.el.querySelector("[data-count]");
  input.addEventListener("input", () => {
    count.textContent = `${[...input.value].length}/${NUDGE_MAX}`;
    sendBtn.disabled = !input.value.trim() || out;
  });

  let busy = false;
  const send = async (text, btn) => {
    if (busy || !text.trim()) return;
    busy = true;
    haptic();
    btn?.classList.add("sending");
    try {
      const r = await store.api("nudge", { text });
      store.data.nudges = { ...nz, left: r.left };
      if (btn) btn.innerHTML = `<span>Sent</span>${icon("check", "", 2.4)}`;
      haptic("success");
      toast(`Sent to ${partner.name}`, { ico: "check" });
      onSent?.(r.left);
      setTimeout(() => s.close(), 650);
    } catch (err) {
      busy = false;
      btn?.classList.remove("sending");
      const msg = err.code === "nudge_limit" ? "That's 3 for today. More tomorrow."
        : err.code === "nudges_off" ? `${partner.name} has nudges turned off.` : errorText(err);
      toast(msg, { error: true });
    }
  };
  s.el.querySelectorAll("[data-text]").forEach((b) => b.addEventListener("click", () => send(b.dataset.text, b)));
  sendBtn.addEventListener("click", () => send(input.value, sendBtn));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); send(input.value, sendBtn); } });
}

/** "Sue · Agua, Eduardo. · 3:14pm" for Today, or null. Today only (the api enforces it). */
export function lastNudgeHtml() {
  const n = store.data.nudges?.last_received;
  if (!n) return null;
  const who = store.person(n.from)?.name ?? "";
  const at = new Date(n.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
  return `${icon("bell")}<span><b>${esc(who)}</b> · ${esc(n.body)}</span><span class="t">${esc(at)}</span>`;
}
