// App state + the write path (optimistic, then reconciled with the server).
import { blank, isComplete, isOneWorkout, personStats, dayNum, doneCount } from "./rules.js";
import { errorText } from "./api.js";
import { celebrate, toast } from "./util.js";

const CACHE = "s75";

export const store = {
  k: null,
  api: null,
  data: null,
  view: "today",
  selDay: null, // day being edited on Today (null = today)
  listeners: new Set(),
  pending: 0,
  lastFetch: 0,

  get me() { return this.data.people.find((p) => p.id === this.data.me.id); },
  get partner() { return this.data.people.find((p) => p.id !== this.data.me.id); },
  get start() { return this.data.start_date; },
  stats(p) { return personStats(p, this.start); },
  person(id) { return this.data.people.find((p) => p.id === id); },

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(kind) { for (const fn of this.listeners) fn(kind); },

  setData(d, { quiet = false } = {}) {
    this.data = d;
    this.lastFetch = Date.now();
    document.documentElement.dataset.me = d.me.id;
    try { localStorage.setItem(CACHE, JSON.stringify(d)); } catch (_) { /* full */ }
    if (!quiet) this.emit("data");
  },
  cached() {
    try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (_) { return null; }
  },

  async refresh() {
    if (this.pending) return;
    const d = await this.api("state");
    if (!this.pending) this.setData(d);
  },

  entry(day) {
    return this.me.entries.find((e) => e.day === day) ?? null;
  },

  /** Apply locally, paint, then persist. Water writes are coalesced. */
  write(day, fields, { debounce = 0 } = {}) {
    const me = this.me;
    let e = me.entries.find((x) => x.day === day);
    const before = e ? { ...e } : null;
    if (!e) {
      e = blank(day);
      me.entries.push(e);
      me.entries.sort((a, b) => (a.day < b.day ? -1 : 1));
    }
    Object.assign(e, fields);
    this.emit("entry");
    this.maybeCelebrate(before, e);

    const key = day;
    this._queued ??= new Map();
    const q = this._queued.get(key) ?? { fields: {}, timer: null, prev: before };
    Object.assign(q.fields, fields);
    clearTimeout(q.timer);
    this._queued.set(key, q);
    const send = async () => {
      this._queued.delete(key);
      this.pending++;
      try {
        const d = await this.api("set", { day, fields: q.fields });
        this.pending--;
        if (!this.pending && !this._queued.size) this.setData(d, { quiet: false });
      } catch (err) {
        this.pending--;
        // Roll back this day to what it was before the queued edits.
        const cur = this.me.entries.find((x) => x.day === day);
        if (cur) Object.assign(cur, q.prev ?? blank(day));
        this.emit("entry");
        toast(errorText(err), { error: true });
      }
    };
    if (debounce) q.timer = setTimeout(send, debounce);
    else send();
  },

  maybeCelebrate(before, after) {
    if (isComplete(before) || !isComplete(after)) return;
    const p = this.partner;
    const pe = p.entries.find((x) => x.day === p.today);
    let partnerLine = "";
    if (after.day === this.me.today) {
      partnerLine = isComplete(pe)
        ? `${p.name} already closed out today.`
        : `${p.name}: ${doneCount(pe)} of 6 today.`;
    }
    celebrate({ day: dayNum(this.start, after.day), oneWorkout: isOneWorkout(after), partnerLine });
  },
};
