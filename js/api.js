import { API_URL } from "./config.js";

const LS_KEY = "k75";

/** The private key lives in the link (?k=...). Keep it in the URL so
 *  "Add to Home Screen" captures it, and in storage as a fallback. */
export function getKey() {
  const url = new URL(location.href);
  let k = url.searchParams.get("k");
  try {
    if (k) localStorage.setItem(LS_KEY, k);
    else k = localStorage.getItem(LS_KEY);
  } catch (_) { /* private mode */ }
  if (k && !url.searchParams.get("k")) {
    url.searchParams.set("k", k);
    history.replaceState(null, "", url.toString());
  }
  return k;
}

export function privateLink(k) {
  const u = new URL(location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("k", k);
  return u.toString();
}

export class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function makeApi(k) {
  return async function call(a, params = {}) {
    let res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        // text/plain keeps this a "simple" request: no CORS preflight round trip.
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ k, a, ...params }),
        cache: "no-store",
      });
    } catch (_) {
      throw new ApiError("offline", 0);
    }
    let data = null;
    try { data = await res.json(); } catch (_) { /* ignore */ }
    if (!res.ok) throw new ApiError(data?.error ?? "server_error", res.status);
    return data;
  };
}

export const errorText = (e) => {
  switch (e?.code) {
    case "offline": return "You're offline. Try again in a sec.";
    case "future_day": return "That day hasn't happened yet.";
    case "before_start": return "That's before the start date.";
    case "too_big": return "That photo is too large.";
    case "bad_key": return "This link isn't valid anymore.";
    default: return "Something went wrong. Try again.";
  }
};
