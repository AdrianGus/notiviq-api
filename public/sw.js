/* Service Worker (sw.js) — NotivIQ (nid ou notificationId) */

const DEFAULT_API_BASE = "http://localhost:3000"; // ajuste para prod

self.addEventListener("install", () => {
  console.log("[SW] instalado");
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  console.log("[SW] ativado");
  self.clients.claim();
});

/* Utilidades */
function getApiBase() {
  try {
    const url = new URL(self.location.href);
    const qp = url.searchParams.get("api");
    if (qp) {
      console.log("[SW] API base via query =", qp);
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
  return String(s || "abrir")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function reportEvent(nid, type, extra) {
  if (!nid) {
    console.warn("[SW] reportEvent ignorado (sem nid)", type);
    return;
  }
  const API_BASE = getApiBase();
  if (!API_BASE) return;

  let path = "";
  if (type === "shown") path = `/notifications/${nid}/shown`;
  else if (type === "click") path = `/notifications/${nid}/click`;
  else if (type === "close") path = `/notifications/${nid}/close`;

  const url = joinUrl(API_BASE, path);
  const body = JSON.stringify({ ...(extra || {}), ts: new Date().toISOString() });

  console.log(`[SW] reportEvent → ${url}`, body);

  try {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body,
    });
    console.log("[SW] reportEvent resposta", type, res.status);
  } catch (err) {
    console.error("[SW] reportEvent falhou", type, err);
  }
}

/* ====================== PUSH ====================== */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json() || {}; }
  catch { try { payload = JSON.parse(event.data.text() || "{}"); } catch { } }

  console.log("[SW] push payload recebido", payload);

  const base = payload || {};
  const nested = base.data || {};

  // aceitar nid OU notificationId
  const nid = base.nid ?? nested.nid ?? base.notificationId ?? nested.notificationId;
  if (nid) console.log("[SW] usando nid =", nid);
  else console.warn("[SW] nenhum nid/notificationId encontrado");

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
    console.log("[SW] exibindo notificação", { nid, title, options });
    await self.registration.showNotification(title, options);
    await reportEvent(nid, "shown");
  })());
});

/* ================== CLICK / CLOSE ================== */
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] notificationclick", event);

  event.notification.close();

  const nid = event.notification?.data?.nid;
  const dataActions = event.notification?.data?.actions || [];
  const clickedKey = event.action;
  const chosen = dataActions.find((a) => a.action === clickedKey) || dataActions[0];
  const target = chosen?.url || event.notification?.data?.url;

  event.waitUntil((async () => {
    console.log("[SW] clicado →", { nid, action: chosen?.action, target });
    await reportEvent(nid, "click", { action: chosen?.action });
    if (target) await clients.openWindow(target);
  })());
});

self.addEventListener("notificationclose", (event) => {
  console.log("[SW] notificationclose", event);
  const nid = event.notification?.data?.nid;
  event.waitUntil(reportEvent(nid, "close"));
});

/* ================== SUBSCRIPTION CHANGE ================== */
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] pushsubscriptionchange detectado", event);

  event.waitUntil((async () => {
    try {
      // pega subscription antiga
      const oldSub = event.subscription || (await self.registration.pushManager.getSubscription());
      if (oldSub) {
        const API_BASE = getApiBase();
        const url = joinUrl(API_BASE, `/subscriptions/${oldSub.nid}`);

        // PATCH status: CANCELLED
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: oldSub.endpoint,
            status: "CANCELLED",
            ts: new Date().toISOString(),
          }),
        });
        console.log("[SW] subscription cancel reportado", res.status);
      }
    } catch (err) {
      console.error("[SW] falha ao reportar cancelamento", err);
    }
  })());
});
