/* Service Worker (sw.js) — NotivIQ (verbose + resubscribe) */

const DEFAULT_API_BASE = "http://localhost:3000"; // ajuste para prod

function dbgOn() {
  try {
    const url = new URL(self.location.href);
    return url.searchParams.get("debug") === "1";
  } catch { return false; }
}
const LOG = dbgOn();
function log() { if (LOG) try { console.log.apply(console, ["[SW]"].concat([].slice.call(arguments))); } catch (_) { } }
function warn() { if (LOG) try { console.warn.apply(console, ["[SW]"].concat([].slice.call(arguments))); } catch (_) { } }
function err() { if (LOG) try { console.error.apply(console, ["[SW]"].concat([].slice.call(arguments))); } catch (_) { } }

self.addEventListener("install", () => {
  log("install");
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  log("activate");
  self.clients.claim();
});

/* ---------------- Utils ---------------- */
function getApiBase() {
  try {
    const url = new URL(self.location.href);
    const qp = url.searchParams.get("api");
    if (qp) {
      log("API via query", qp);
      return qp.replace(/\/+$/, "");
    }
  } catch { }
  if (DEFAULT_API_BASE) return DEFAULT_API_BASE.replace(/\/+$/, "");
  return self.location.origin.replace(/\/+$/, "");
}
function joinUrl(base, path) {
  return `${String(base).replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;
}
function slugify(s) {
  return String(s || "abrir").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// helpers extra
function u8(b64url) {
  try {
    var padding = "=".repeat((4 - (b64url.length % 4)) % 4);
    var b64 = (b64url + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(b64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  } catch { return null; }
}
function getQParam(name) {
  try { return new URL(self.location.href).searchParams.get(name); } catch { return null; }
}
function getVapidKeyU8() { var v = getQParam("vapid"); return v ? u8(v) : null; }
function getAccount() { return getQParam("account"); }
function getCampaign() { return getQParam("campaign"); }
function getPK() { return getQParam("pk"); }

async function postEvent(nid, type, extra) {
  if (!nid) return;
  const API_BASE = getApiBase();
  if (!API_BASE) return;
  let path = "";
  if (type === "shown") path = `/notifications/${nid}/shown`;
  else if (type === "click") path = `/notifications/${nid}/click`;
  else if (type === "close") path = `/notifications/${nid}/close`;

  const url = joinUrl(API_BASE, path);
  const body = JSON.stringify({ ...(extra || {}), ts: new Date().toISOString() });

  log("POST", type, url, body);
  try {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body,
    });
    log("RES", type, res.status);
  } catch (e) {
    err("postEvent", type, e);
  }
}

/* ---------------- PUSH ---------------- */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json() || {}; }
  catch { try { payload = JSON.parse(event.data.text() || "{}"); } catch { } }

  log("push payload", payload);

  const base = payload || {};
  const nested = base.data || {};

  const nid = base.nid ?? nested.nid ?? base.notificationId ?? nested.notificationId;
  const title = base.title ?? nested.title ?? "Notificação";
  const body = base.body ?? nested.body ?? "";
  const icon = base.icon ?? nested.icon ?? "/icon.png";
  const image = base.image ?? nested.image;
  const url = base.url ?? nested.url;

  const rawActions = base.actions || nested.actions || [];
  const uiActions = rawActions.slice(0, 2).map((a) => ({
    action: a.action || slugify(a.title),
    title: a.title || "Abrir",
  }));

  const options = {
    body,
    icon,
    image,
    actions: uiActions,
    data: {
      nid,
      url,
      actions: rawActions.map((a) => ({
        action: a.action || slugify(a.title),
        title: a.title || "Abrir",
        url: a.url,
      })),
    },
  };

  event.waitUntil((async () => {
    log("showNotification", { nid, title, options });
    await self.registration.showNotification(title, options);
    await postEvent(nid, "shown");
  })());
});

/* ---------------- CLICK / CLOSE ---------------- */
self.addEventListener("notificationclick", (event) => {
  log("notificationclick", event.action);
  event.notification.close();
  const nid = event.notification?.data?.nid;
  const dataActions = event.notification?.data?.actions || [];
  const clickedKey = event.action;
  const chosen = dataActions.find((a) => a.action === clickedKey) || dataActions[0];
  const target = chosen?.url || event.notification?.data?.url;

  event.waitUntil((async () => {
    await postEvent(nid, "click", { action: chosen?.action });
    if (target) await clients.openWindow(target);
  })());
});

self.addEventListener("notificationclose", (event) => {
  log("notificationclose");
  const nid = event.notification?.data?.nid;
  event.waitUntil(postEvent(nid, "close"));
});

/* ---------------- SUBSCRIPTION CHANGE ---------------- */
self.addEventListener("pushsubscriptionchange", (event) => {
  log("pushsubscriptionchange");
  event.waitUntil((async () => {
    try {
      const oldSub = event.oldSubscription || event.subscription || (await self.registration.pushManager.getSubscription());
      const oldEndpoint = oldSub && oldSub.endpoint;
      log("oldEndpoint", oldEndpoint);

      // 1) Avise páginas para cancelarem no backend (usando os IDs salvos)
      const clis = await clients.matchAll({ includeUncontrolled: true, type: "window" });
      for (const c of clis) {
        try { c.postMessage({ type: "NOTIVIQ_SUBSCRIPTION_CHANGED", endpoint: oldEndpoint || null }); } catch (_) { }
      }

      // 2) Se temos VAPID na query, tentar re-subscrever e criar nova inscrição direto do SW
      const vapidU8 = getVapidKeyU8();
      if (vapidU8) {
        try { await oldSub?.unsubscribe(); } catch (_) { }
        let newSub = await self.registration.pushManager.getSubscription();
        if (!newSub) {
          newSub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidU8 });
        }
        log("new endpoint", newSub?.endpoint);

        const API_BASE = getApiBase();
        const account = getAccount();
        const campaign = getCampaign();
        const pk = getPK();

        if (API_BASE && account && newSub) {
          const url = joinUrl(API_BASE, "/subscriptions");
          const body = { accountId: account, campaignId: campaign || undefined, subscription: newSub, tags: [], locale: undefined };
          const headers = { "Content-Type": "application/json" };
          if (pk) headers["X-NotivIQ-Key"] = pk;

          log("POST (resubscribe)", url, body);
          const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", credentials: "omit" });
          const txt = await res.text().catch(() => "");
          log("RES (resubscribe)", res.status, txt);
        }
      }
    } catch (e) {
      err("pushsubscriptionchange error", e);
    }
  })());
});
