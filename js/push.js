import { store } from "./store.js";
import { isIOS, isStandalone, toast } from "./util.js";
import { errorText } from "./api.js";

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** on | off | denied | install (iOS: needs Home Screen) | unsupported */
export function pushState() {
  if (!supported()) return { state: isIOS() && !isStandalone() ? "install" : "unsupported" };
  if (Notification.permission === "denied") return { state: "denied" };
  if (Notification.permission === "granted" && store.data?.me.push_devices > 0 && localStorage.getItem("push75") === "1") {
    return { state: "on" };
  }
  return { state: "off" };
}

function b64uToBytes(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

/** Must be called straight from a tap (iOS requires the gesture). */
export async function enablePush() {
  if (!supported()) {
    toast(isIOS() ? "Add it to your Home Screen first, then open it from there." : "This browser can't do notifications.", { error: true, ms: 3600 });
    return { ok: false };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    toast(perm === "denied" ? "Notifications are blocked in Settings." : "No problem. You can turn them on later.", { error: perm === "denied" });
    return { ok: false };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64uToBytes(store.data.vapid_public),
      });
    }
    await store.api("push_subscribe", { sub: sub.toJSON() });
    try { localStorage.setItem("push75", "1"); } catch (_) {}
    store.data.me.push_devices = Math.max(1, store.data.me.push_devices);
    toast("Notifications on", { ico: "bell" });
    return { ok: true };
  } catch (err) {
    toast(err?.code ? errorText(err) : "Couldn't turn on notifications.", { error: true });
    return { ok: false };
  }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await store.api("push_unsubscribe", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch (_) { /* ignore */ }
  try { localStorage.removeItem("push75"); } catch (_) {}
  store.data.me.push_devices = Math.max(0, store.data.me.push_devices - 1);
  toast("Notifications off");
}

/** Keep the server in sync if the browser rotated the subscription. */
export async function syncPush() {
  if (!supported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub && localStorage.getItem("push75") === "1") await store.api("push_subscribe", { sub: sub.toJSON() });
  } catch (_) { /* ignore */ }
}
