(() => {
  if (window.__zongpuAnalyticsLoaded) return;
  window.__zongpuAnalyticsLoaded = true;

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

  function start() {
    if (isRedirecting()) return;
    if (!isProduction || !pages.some(([page]) => page === canonicalFile)) return;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
    // Once per document load; no counting on searches, hash changes or automatic retries.
    requestCounts("POST", canonicalFile).catch(() => {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
