(() => {
  if (window.__zongpuAnalyticsLoaded) return;
  window.__zongpuAnalyticsLoaded = true;

  const assetUrl = document.currentScript.src;
  const origin = "https://wushizupu-commits.github.io";
  const basePath = "/zongpu/";
  const endpoint = "https://busuanzi.9420.ltd/api";
  const identityKey = "zongpu-analytics-id";
  const pages = [
    ["home.html", "首页"], ["index.html", "世系族谱"],
    ["biographies.html", "族贤传略"], ["image_archive.html", "宗族图志"],
    ["family_customs.html", "家训礼俗"], ["revisions.html", "历代修谱"],
    ["source_migration.html", "源流迁徙"]
  ];
  const isProduction = location.origin === origin && location.pathname.startsWith(basePath);
  const isInk = location.pathname.includes("/ink-archive/");
  const file = location.pathname.split("/").pop() || "index.html";
  const canonicalFile = isInk ? ({ "index.html": "home.html", "tree.html": "index.html" }[file] || file) : file;
  const articles = {
    "biographies.html": new Set(["bio-1", "bio-2", "bio-3", "bio-4", "bio-5", "bio-6", "bio-7", "bio-8", "bio-9"]),
    "revisions.html": new Set(["guangxu-1895-1", "guangxu-1895-2", "guangxu-1895-3", "minguo-1946-1", "xinsi-2001-1", "xinsi-2001-2", "xinsi-2001-3", "bingwu-2026-1", "bingwu-2026-2", "appendix-1"]),
    "image_archive.html": new Set(["ancestors", "fuxi", "tombs"])
  };
  let eventEndpoint = "";
  let configState = "pending";
  const pendingEvents = [];

  function isRedirecting() {
    const mobile = matchMedia("(max-width: 820px), (max-width: 1024px) and (max-height: 500px)").matches;
    if (isInk) return mobile;
    if (file === "index.html" && !location.search && !location.hash) return true;
    return !mobile && new URLSearchParams(location.search).get("skin") !== "paper" && window.ZongpuSite?.readSkin() === "ink-archive";
  }

  function readIdentity() {
    try { return localStorage.getItem(identityKey); } catch { return null; }
  }

  function validIdentity(value) {
    return typeof value === "string" && value.length <= 4096 && /^[A-Za-z0-9._-]+$/.test(value);
  }

  async function requestCounts(method, page) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    // Send only a known public page path: no person IDs, query, hash or incoming referrer.
    const headers = { "x-bsz-referer": origin + basePath + page };
    const identity = method === "POST" ? readIdentity() : null;
    if (validIdentity(identity)) headers.Authorization = "Bearer " + identity;
    try {
      const response = await fetch(endpoint, {
        method, headers, signal: controller.signal,
        credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store"
      });
      if (!response.ok) throw new Error("Analytics unavailable");
      const result = await response.json();
      const fields = ["site_pv", "site_uv", "page_pv", "page_uv"];
      if (result.success !== true || !fields.every(key => Number.isSafeInteger(result.data?.[key]) && result.data[key] >= 0)) {
        throw new Error("Invalid analytics response");
      }
      const nextIdentity = method === "POST" ? response.headers.get("Set-Bsz-Identity") : null;
      if (validIdentity(nextIdentity)) {
        try { localStorage.setItem(identityKey, nextIdentity); } catch { /* Counting still works without storage. */ }
      }
      return result.data;
    } finally { clearTimeout(timeout); }
  }

  function workerOrigin(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+workers\.dev$/.test(url.hostname)) return "";
      if (url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) return "";
      return url.origin;
    } catch { return ""; }
  }

  async function sendEvent(event) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      // No visitor identity, free-form input, browser URL or incoming referrer.
      await fetch(eventEndpoint + "/collect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event), signal: controller.signal,
        credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store"
      });
      // Success is 204; rejected events and network failures are deliberately not retried.
    } catch { /* Optional statistics must never interrupt browsing. */ }
    finally { clearTimeout(timeout); }
  }

  function recordEvent(kind, itemId = "") {
    if (configState === "disabled" || (configState === "pending" && pendingEvents.length >= 30)) return;
    let eventId;
    try { eventId = window.crypto.randomUUID(); } catch { return; }
    const event = { eventId, kind, page: canonicalFile, itemId };
    if (configState === "ready") sendEvent(event);
    else pendingEvents.push(event);
  }

  async function loadEventConfig() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(new URL("analytics-config.json?v=20261004-events", assetUrl).href, {
        method: "GET", signal: controller.signal,
        credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store"
      });
      if (response.ok) eventEndpoint = workerOrigin((await response.json()).endpoint);
    } catch { /* An absent configuration simply keeps event collection disabled. */ }
    finally {
      clearTimeout(timeout);
      configState = eventEndpoint ? "ready" : "disabled";
      const queued = pendingEvents.splice(0);
      if (eventEndpoint) queued.forEach(sendEvent);
    }
  }

  function watchEvents() {
    recordEvent("page");
    const allowedArticles = articles[canonicalFile];
    if (allowedArticles) {
      const selector = canonicalFile === "biographies.html" ? ".bio-page[data-article]"
        : canonicalFile === "revisions.html" ? ".revision-page[data-article]" : ".archive-section[data-section]";
      const panels = Array.from(document.querySelectorAll(selector));
      let lastArticle = "";
      const recordActiveArticle = () => {
        const panel = panels.find(item => item.classList.contains("active"));
        const articleId = panel?.dataset.article || panel?.dataset.section;
        // Follow the actual visible panel, including browser history navigation; never infer it from a hash.
        if (!allowedArticles.has(articleId) || articleId === lastArticle) return;
        lastArticle = articleId;
        recordEvent("article", articleId);
      };
      if (panels.length && typeof MutationObserver === "function") {
        const observer = new MutationObserver(recordActiveArticle);
        panels.forEach(panel => observer.observe(panel, { attributes: true, attributeFilter: ["class"] }));
      }
      recordActiveArticle();
    }
    if (canonicalFile === "index.html") {
      const nodeIds = new Set((window.DATA?.nodes || []).map(node => node.id));
      document.addEventListener("zongpu:search-select", event => {
        const nodeId = event.detail?.nodeId;
        if (typeof nodeId === "string" && /^G\d{2}-\d{3}$/.test(nodeId) && nodeIds.has(nodeId)) recordEvent("search", nodeId);
      });
    }
    loadEventConfig();
  }

  function start() {
    if (isRedirecting()) return;
    if (!isProduction || !pages.some(([page]) => page === canonicalFile)) return;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
    // Once per document load; no counting on searches, hash changes or automatic retries.
    requestCounts("POST", canonicalFile).catch(() => {});
    watchEvents();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
