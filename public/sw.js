/* Service Worker (sw.js) — NotivIQ */

const DEFAULT_API_BASE = "http://localhost:3000"; // ajuste para prod

self.addEventListener("install", () => {
  console.log("[SW] instalado");
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  console.log("[SW] ativado");
  self.clients.claim();
});

/* ---------------- Utils ---------------- */
function getApiBase() {
  try {
    const url = new URL(self.location.href);
    const qp = url.searchParams.get("api");
    if (qp) return qp.replace(/\/+$/, "");
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

  try {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.warn("[SW] postEvent HTTP", res.status);
    }
  } catch (err) {
    console.error("[SW] postEvent falhou", type, err);
  }
}

/* ---------------- PUSH ---------------- */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json() || {}; }
  catch { try { payload = JSON.parse(event.data.text() || "{}"); } catch { } }

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
    await self.registration.showNotification(title, options);
    await postEvent(nid, "shown");
  })());
});

/* ---------------- CLICK / CLOSE ---------------- */
self.addEventListener("notificationclick", (event) => {
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
  const nid = event.notification?.data?.nid;
  event.waitUntil(postEvent(nid, "close"));
});

/* ---------------- SUBSCRIPTION CHANGE ---------------- */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const oldSub = event.subscription || (await self.registration.pushManager.getSubscription());
      const oldEndpoint = oldSub && oldSub.endpoint;

      // Informa as janelas para cancelarem no backend usando o id salvo no localStorage
      const clis = await clients.matchAll({ includeUncontrolled: true, type: "window" });
      for (const c of clis) {
        try {
          c.postMessage({ type: "NOTIVIQ_SUBSCRIPTION_CHANGED", endpoint: oldEndpoint || null });
        } catch (_) { }
      }

      // Dica: aqui poderíamos tentar unsubscribe() do antigo, mas em geral o browser já faz a rotação.
      // await oldSub?.unsubscribe();
    } catch (err) {
      console.error("[SW] pushsubscriptionchange erro", err);
    }
  })());
});
