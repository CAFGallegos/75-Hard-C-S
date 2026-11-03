const KEY = "theme75";

export function getTheme() {
  try { return localStorage.getItem(KEY) || "dark"; } catch (_) { return "dark"; }
}

function resolve(t) {
  return t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
}

export function applyTheme(t) {
  try { localStorage.setItem(KEY, t); } catch (_) {}
  paintTheme(t);
}

export function paintTheme(t = getTheme()) {
  const r = resolve(t);
  document.documentElement.dataset.theme = r;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", r === "light" ? "#F4F2EF" : "#0A0A0A"));
}

matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
  if (getTheme() === "system") paintTheme("system");
});
