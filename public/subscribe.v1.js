/*!
 * NotivIQ Subscribe SDK – v1.2.0 (iframe + persist + cancel-on-change)
 */

(function () {
  "use strict";

  var VERSION = "1.2.0";
  var SELECTOR = "[data-notiviq-subscribe]";
  var BANNER = "[NotivIQ]";
  var DEFAULT_TIMEOUT_MS = 12000;

  /* ---------------- Utils ---------------- */
  function u8(base64url) {
    var padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    var b64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(b64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
  function canUsePush() {
    return ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
  }
  function requestPermission() {
    if (Notification.permission === "granted") return Promise.resolve(true);
    if (Notification.permission === "denied") return Promise.resolve(false);
    var res = Notification.requestPermission();
    if (res && typeof res.then === "function") return res.then(function (r) { return r === "granted"; });
    return Promise.resolve(res === "granted");
  }
  function withTimeout(promise, ms, label) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms);
    return Promise.race([
      promise,
      new Promise(function (_resolve, reject) {
        ctl.signal.addEventListener("abort", function () {
          reject(new Error((label || "timeout") + " (" + ms + "ms)"));
        });
      }),
    ]).finally(function () { clearTimeout(t); });
  }
  function postJSON(url, body, headers, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || DEFAULT_TIMEOUT_MS);
    return fetch(url, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
      credentials: "omit",
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error("HTTP " + res.status + ": " + (t || res.statusText)); });
      return res.json().catch(function () { return {}; });
    }).finally(function () { clearTimeout(timer); });
  }
  function patchJSON(url, body, headers, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || DEFAULT_TIMEOUT_MS);
    return fetch(url, {
      method: "PATCH",
      headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
      credentials: "omit",
    }).then(function (res) {
      if (!res.ok) {
        // trata 404/410 como "ok" para cancelamentos idempotentes
        if (res.status === 404 || res.status === 410) return {};
        return res.text().then(function (t) { throw new Error("HTTP " + res.status + ": " + (t || res.statusText)); });
      }
      return res.json().catch(function () { return {}; });
    }).finally(function () { clearTimeout(timer); });
  }
  function csvToArray(csv) {
    return String(csv || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function normalizeApiBase(api) { return String(api || "").replace(/\/$/, ""); }
  function eventDispatch(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (_) { }
  }
  function storageKey(accountId, campaignId) {
    return "notiviq:sub:" + String(accountId || "") + ":" + String(campaignId || "");
  }

  /* ---------------- Config ---------------- */
  function readButtonConfig(btn) {
    var ds = btn?.dataset || {};
    return {
      api: normalizeApiBase(ds.api || "http://localhost:3000"),
      sw: ds.sw || "/sw.js", // modo direto
      accountId: ds.accountId || "",
      campaignId: ds.campaignId || "",
      tags: csvToArray(ds.tags),
      locale: ds.locale === "auto" || !ds.locale ? (navigator.language || undefined) : ds.locale,
      vapid: ds.vapid || "",
      publishableKey: ds.publishableKey || "",
      iframeOrigin: ds.iframeOrigin || ds.iframeorigin || "", // modo iframe
    };
  }
  function validateConfigBase(cfg) {
    if (!cfg.accountId) throw new Error("Parâmetro obrigatório ausente: accountId");
    if (!cfg.vapid) throw new Error("Parâmetro obrigatório ausente: vapid (VAPID public key)");
    if (!cfg.api) throw new Error("Parâmetro obrigatório ausente: api");
  }
  function validateConfigDirect(cfg) {
    if (!cfg.sw) throw new Error("Parâmetro obrigatório ausente: sw (caminho no mesmo domínio)");
  }
  function validateConfigIframe(cfg) {
    if (!cfg.iframeOrigin) throw new Error("Parâmetro obrigatório ausente: iframeOrigin (ex.: https://cliente.notiviq.com.br)");
  }

  /* ---------------- Modo DIRETO ---------------- */
  function registerSW(swPath, apiBase) {
    var url = swPath;
    if (apiBase) {
      var sep = swPath.indexOf("?") === -1 ? "?" : "&";
      url = swPath + sep + "api=" + encodeURIComponent(apiBase);
    }
    return navigator.serviceWorker.register(url)
      .then(function (reg) { return navigator.serviceWorker.ready.then(function () { return reg; }); });
  }
  function getOrCreateSubscription(reg, vapidPublicKey) {
    return reg.pushManager.getSubscription().then(function (sub) {
      if (sub) return sub;
      return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(vapidPublicKey) });
    });
  }

  /* ---------------- Modo IFRAME ---------------- */
  var _iframeCache = {};
  function ensureIframe(origin) {
    if (_iframeCache[origin]) return _iframeCache[origin].promise;
    var ifr = document.createElement("iframe");
    ifr.style.position = "absolute"; ifr.style.width = "0"; ifr.style.height = "0"; ifr.style.border = "0"; ifr.style.opacity = "0";
    ifr.src = origin.replace(/\/$/, "") + "/iframe.html";
    var deferred = {};
    deferred.promise = new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error("iframe_timeout (10s)")); }, 10000);
      ifr.onload = function () { clearTimeout(t); resolve(ifr.contentWindow); };
      ifr.onerror = function () { clearTimeout(t); reject(new Error("iframe_error")); };
    });
    document.body.appendChild(ifr);
    _iframeCache[origin] = { el: ifr, promise: deferred.promise };
    return deferred.promise;
  }
  function iframeRPC(origin, payload, timeoutMs) {
    return ensureIframe(origin).then(function (win) {
      return new Promise(function (resolve, reject) {
        var reqId = "rq_" + Math.random().toString(36).slice(2);
        var timer = setTimeout(function () { window.removeEventListener("message", onMsg); reject(new Error("iframe_rpc_timeout (" + (timeoutMs || DEFAULT_TIMEOUT_MS) + "ms)")); }, timeoutMs || DEFAULT_TIMEOUT_MS);
        function onMsg(ev) {
          try {
            if (ev.origin !== origin) return;
            var data = ev.data || {};
            if (data && data.type === "NOTIVIQ_REGISTER_RESULT" && data.reqId === reqId) {
              clearTimeout(timer); window.removeEventListener("message", onMsg);
              if (data.ok) resolve(data.payload); else reject(new Error(data.error || "iframe_register_error"));
            }
          } catch (_) { }
        }
        window.addEventListener("message", onMsg, false);
        win.postMessage({
          type: "NOTIVIQ_REGISTER",
          reqId, version: VERSION,
          api: payload.api,
          accountId: payload.accountId,
          campaignId: payload.campaignId,
          tags: payload.tags || [],
          locale: payload.locale,
          vapid: payload.vapid,
          publishableKey: payload.publishableKey || ""
        }, origin);
      });
    });
  }

  /* ---------------- Persistência local ---------------- */
  function persistSuccess(cfg, result, endpoint) {
    try {
      var key = storageKey(cfg.accountId, cfg.campaignId || "");
      var payload = { id: result?.id, endpoint: endpoint || null, accountId: cfg.accountId, campaignId: cfg.campaignId || null, createdAt: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) { console.warn(BANNER, "persist error:", e); }
  }
  function readAllSavedSubs() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || !k.startsWith("notiviq:sub:")) continue;
        try { out.push({ key: k, value: JSON.parse(localStorage.getItem(k) || "{}") }); } catch { _ }
      }
    } catch { }
    return out;
  }

  /* ---------------- Fluxos de inscrição ---------------- */
  function subscribeFlowDirect(cfg) {
    validateConfigBase(cfg); validateConfigDirect(cfg);
    return requestPermission()
      .then(function (granted) { if (!granted) return { ok: false, reason: "permission_denied" }; return withTimeout(registerSW(cfg.sw, cfg.api), 10000, "sw_register"); })
      .then(function (reg) { if (!reg || !reg.pushManager) throw new Error("Falha ao registrar Service Worker"); return withTimeout(getOrCreateSubscription(reg, cfg.vapid), 12000, "push_subscribe"); })
      .then(function (subscription) {
        var body = { accountId: cfg.accountId, campaignId: cfg.campaignId || undefined, subscription, tags: cfg.tags, locale: cfg.locale };
        var headers = {}; if (cfg.publishableKey) headers["X-NotivIQ-Key"] = cfg.publishableKey;
        return postJSON(cfg.api + "/subscriptions", body, headers, 12000).then(function (result) { persistSuccess(cfg, result, subscription?.endpoint); return { ok: true, result }; });
      });
  }
  function subscribeFlowIframe(cfg) {
    validateConfigBase(cfg); validateConfigIframe(cfg);
    return requestPermission().then(function (granted) {
      if (!granted) return { ok: false, reason: "permission_denied" };
      return iframeRPC(cfg.iframeOrigin.replace(/\/$/, ""), {
        api: cfg.api, accountId: cfg.accountId, campaignId: cfg.campaignId || undefined, tags: cfg.tags, locale: cfg.locale, vapid: cfg.vapid, publishableKey: cfg.publishableKey || ""
      }, 15000).then(function (payload) { persistSuccess(cfg, payload, payload?.endpoint); return { ok: true, result: payload }; });
    });
  }

  function subscribeFlowFromConfig(cfg, btn) {
    if (!canUsePush()) { if (btn) btn.disabled = true; return Promise.resolve({ ok: false, reason: "unsupported" }); }
    try { validateConfigBase(cfg); var useIframe = !!cfg.iframeOrigin; if (!useIframe) validateConfigDirect(cfg); } catch (e) { return Promise.reject(e); }
    var flow = cfg.iframeOrigin ? subscribeFlowIframe(cfg) : subscribeFlowDirect(cfg);
    return flow.then(function (res) {
      if (res && res.ok) {
        eventDispatch("notiviq:subscribed", { config: cfg, result: res.result });
        if (typeof window.NotivIQ?.onSubscribed === "function") { try { window.NotivIQ.onSubscribed(res.result); } catch (e) { console.warn(BANNER, "onSubscribed error:", e); } }
      }
      return res;
    }).catch(function (err) {
      console.error(BANNER, err && err.message ? err.message : err);
      if (cfg.iframeOrigin) { console.warn(BANNER, "Tentando fallback (direto)..."); try { validateConfigDirect(cfg); } catch (e) { return Promise.reject(err); } return subscribeFlowDirect(cfg); }
      return Promise.reject(err);
    });
  }

  /* ---------------- Tratamento de pushsubscriptionchange (via SW → page) ---------------- */
  function handleSWMessages() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.addEventListener) return;
    navigator.serviceWorker.addEventListener("message", function (ev) {
      var data = ev.data || {};
      if (data.type !== "NOTIVIQ_SUBSCRIPTION_CHANGED") return;
      var oldEndpoint = data.endpoint;
      if (!oldEndpoint) return;

      // descobre qual registro local corresponde a esse endpoint e cancela no backend
      var saved = readAllSavedSubs();
      saved.forEach(function (row) {
        var v = row.value || {};
        if (!v.endpoint || v.endpoint !== oldEndpoint) return;

        var btn = document.querySelector(SELECTOR);
        var cfg = btn ? readButtonConfig(btn) : { api: "" };
        if (!cfg.api) return;

        var headers = {};
        try {
          if (btn) {
            var ds = btn.dataset || {};
            if (ds.publishableKey) headers["X-NotivIQ-Key"] = ds.publishableKey;
          }
        } catch (_) { }

        if (v.id) {
          patchJSON(cfg.api + "/subscriptions/" + v.id, { status: "CANCELLED", endpoint: oldEndpoint }, headers, 8000)
            .catch(function (e) { console.warn(BANNER, "cancel PATCH ignored:", e?.message || e); });
        }
      });
    });
  }

  /* ---------------- UI bind ---------------- */
  function bindButtons() {
    var nodes = document.querySelectorAll(SELECTOR);
    if (!nodes || !nodes.length) return;
    Array.prototype.forEach.call(nodes, function (btn) {
      if (btn.__notiviqBound) return;
      btn.__notiviqBound = true;
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (btn.disabled) return;
        btn.disabled = true;
        var originalText = btn.textContent;
        subscribeFlowFromConfig(readButtonConfig(btn), btn)
          .then(function (res) {
            if (res && res.ok) {
              btn.textContent = "Inscrito! ✅";
              btn.classList.add("notiviq-subscribed");
            } else {
              btn.textContent = originalText || "Permitir notificações";
              btn.disabled = false;
            }
          })
          .catch(function () {
            btn.textContent = originalText || "Permitir notificações";
            btn.disabled = false;
          });
      });
    });
  }

  // API pública
  window.NotivIQ = window.NotivIQ || {};
  window.NotivIQ.version = VERSION;
  window.NotivIQ.subscribeNow = function (options) {
    var btn = document.querySelector(SELECTOR);
    var baseCfg = btn ? readButtonConfig(btn) : {};
    var cfg = Object.assign({}, baseCfg, options || {});
    return subscribeFlowFromConfig(cfg, btn || null);
  };

  // Auto-bind
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindButtons);
  else bindButtons();

  // Listener de mensagens do SW
  handleSWMessages();
})();
