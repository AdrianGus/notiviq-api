/*!
 * NotivIQ Subscribe SDK – v1.0.0
 * Uso:
 *  1) Garanta que o Service Worker (/sw.js) esteja acessível NO MESMO DOMÍNIO da landing.
 *  2) Coloque um botão com data-attrs:
 *     <button
 *       data-notiviq-subscribe
 *       data-account-id="acc_123"
 *       data-publishable-key="pk_live_xxx"
 *       data-vapid="BFEvVkOhokMgP2OVVnlSyN24KCVAF..."
 *       data-api="https://api.seuservico.com"
 *       data-sw="/sw.js"
 *       data-campaign-id="cmp_456"
 *       data-tags="vip,black-friday"
 *       data-locale="auto"
 *     >Permitir notificações</button>
 *
 *  3) Opcional: window.NotivIQ.onSubscribed = (payload) => { ... }
 *  4) Opcional: chamar via código -> window.NotivIQ.subscribeNow()
 */
(function () {
  "use strict";

  var VERSION = "1.0.0";
  var SELECTOR = "[data-notiviq-subscribe]";
  var BANNER = "[NotivIQ]";
  var DEFAULT_TIMEOUT_MS = 12000;

  // base64url -> Uint8Array
  function u8(base64url) {
    var padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    var b64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(b64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function canUsePush() {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  function requestPermission() {
    if (Notification.permission === "granted") return Promise.resolve(true);
    if (Notification.permission === "denied") return Promise.resolve(false);
    var res = Notification.requestPermission();
    // Alguns browsers retornam Promise, outros podem retornar string
    if (res && typeof res.then === "function") {
      return res.then(function (r) {
        return r === "granted";
      });
    }
    return Promise.resolve(res === "granted");
  }

  function withTimeout(promise, ms, label) {
    var ctl = new AbortController();
    var t = setTimeout(function () {
      ctl.abort();
    }, ms);
    return Promise.race([
      promise,
      new Promise(function (_resolve, reject) {
        ctl.signal.addEventListener("abort", function () {
          reject(new Error((label || "timeout") + " (" + ms + "ms)"));
        });
      }),
    ]).finally(function () {
      clearTimeout(t);
    });
  }

  function registerSW(swPath, apiBase) {
    var url = swPath;
    if (apiBase) {
      var sep = swPath.indexOf("?") === -1 ? "?" : "&";
      url = swPath + sep + "api=" + encodeURIComponent(apiBase);
    }
    return navigator.serviceWorker
      .register(url)
      .then(function (reg) {
        return navigator.serviceWorker.ready.then(function () {
          return reg;
        });
      });
  }

  function getOrCreateSubscription(reg, vapidPublicKey) {
    return reg.pushManager.getSubscription().then(function (sub) {
      if (sub) return sub;
      return reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: u8(vapidPublicKey),
      });
    });
  }

  function postJSON(url, body, headers, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, timeoutMs || DEFAULT_TIMEOUT_MS);

    return fetch(url, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("HTTP " + res.status + ": " + (t || res.statusText));
          });
        }
        return res.json().catch(function () {
          return {};
        });
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  function csvToArray(csv) {
    return String(csv || "")
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function normalizeApiBase(api) {
    return String(api || "").replace(/\/$/, "");
  }

  function eventDispatch(name, detail) {
    try {
      var ev = new CustomEvent(name, { detail: detail });
      document.dispatchEvent(ev);
    } catch (_) { }
  }

  function readButtonConfig(btn) {
    var ds = btn.dataset || {};
    var cfg = {
      api: normalizeApiBase(ds.api || "http://localhost:3000"),
      sw: ds.sw || "/sw.js",
      accountId: ds.accountId || "",
      campaignId: ds.campaignId || "",
      tags: csvToArray(ds.tags),
      locale: ds.locale === "auto" || !ds.locale ? (navigator.language || undefined) : ds.locale,
      vapid: ds.vapid || "",
      publishableKey: ds.publishableKey || "",
    };
    return cfg;
  }

  function validateConfig(cfg) {
    if (!cfg.accountId) throw new Error("Parâmetro obrigatório ausente: accountId");
    if (!cfg.vapid) throw new Error("Parâmetro obrigatório ausente: vapid (VAPID public key)");
    if (!cfg.api) throw new Error("Parâmetro obrigatório ausente: api");
    if (!cfg.sw) throw new Error("Parâmetro obrigatório ausente: sw (caminho no mesmo domínio)");
  }

  function subscribeFlowFromConfig(cfg, btn) {
    if (!canUsePush()) {
      if (btn) btn.disabled = true;
      return Promise.resolve({ ok: false, reason: "unsupported" });
    }

    try {
      validateConfig(cfg);
    } catch (e) {
      return Promise.reject(e);
    }

    return requestPermission()
      .then(function (granted) {
        if (!granted) return { ok: false, reason: "permission_denied" };
        return withTimeout(registerSW(cfg.sw, cfg.api), 10000, "sw_register");
      })
      .then(function (reg) {
        if (!reg || !reg.pushManager) throw new Error("Falha ao registrar Service Worker");
        return withTimeout(getOrCreateSubscription(reg, cfg.vapid), 12000, "push_subscribe");
      })
      .then(function (subscription) {
        var body = {
          accountId: cfg.accountId,
          campaignId: cfg.campaignId || undefined,
          subscription: subscription,
          tags: cfg.tags,
          locale: cfg.locale,
        };
        var headers = {};
        if (cfg.publishableKey) headers["X-NotivIQ-Key"] = cfg.publishableKey;
        return postJSON(cfg.api + "/subscriptions", body, headers, 12000);
      })
      .then(function (result) {
        eventDispatch("notiviq:subscribed", { config: cfg, result: result });
        if (typeof window.NotivIQ?.onSubscribed === "function") {
          try {
            window.NotivIQ.onSubscribed(result);
          } catch (e) {
            console.warn(BANNER, "onSubscribed error:", e);
          }
        }
        return { ok: true, result: result };
      })
      .catch(function (err) {
        console.error(BANNER, err && err.message ? err.message : err);
        return Promise.reject(err);
      });
  }

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
    // options pode sobrescrever data-attrs do primeiro botão encontrado
    var btn = document.querySelector(SELECTOR);
    var baseCfg = btn ? readButtonConfig(btn) : {};
    var cfg = Object.assign({}, baseCfg, options || {});
    return subscribeFlowFromConfig(cfg, btn || null);
  };

  // Auto-bind
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindButtons);
  } else {
    bindButtons();
  }
})();
