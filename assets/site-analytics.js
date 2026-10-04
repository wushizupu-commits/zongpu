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
  const isDashboard = location.pathname.endsWith("/analytics.html");
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

  function mountLink() {
    const entry = document.createElement("div");
    entry.className = "site-analytics-entry";
    const link = document.createElement("a");
    link.href = new URL("../analytics.html", assetUrl).href;
    link.textContent = "访问统计 ↗";
    entry.append(link);
    (document.querySelector("#sidebarPane > .side-inner") || document.body).append(entry);
  }

  function mountDashboard() {
    const status = document.getElementById("analytics-status");
    const refresh = document.getElementById("analytics-refresh");
    const rows = document.getElementById("analytics-pages");
    const sitePv = document.getElementById("analytics-site-pv");
    const siteUv = document.getElementById("analytics-site-uv");
    if (!isProduction) {
      refresh.disabled = true;
      status.textContent = "本地预览不连接统计服务；请在正式网站查看数据。";
      return;
    }
    async function update() {
      if (refresh.disabled) return;
      refresh.disabled = true;
      status.textContent = "正在查询累计数据…";
      sitePv.textContent = siteUv.textContent = "—";
      rows.replaceChildren();
      const cells = pages.map(([page, title]) => {
        const row = document.createElement("tr");
        const name = document.createElement("th");
        name.scope = "row";
        const link = document.createElement("a");
        link.href = page === "index.html" ? "./index.html?view=tree" : "./" + page;
        link.textContent = title;
        name.append(link);
        const pv = document.createElement("td"), uv = document.createElement("td");
        pv.textContent = uv.textContent = "—";
        row.append(name, pv, uv);
        rows.append(row);
        return { pv, uv };
      });
      // GET only reads counters. Opening/refreshing this dashboard must never count a visit.
      const results = await Promise.allSettled(pages.map(([page]) => requestCounts("GET", page)));
      const successful = [];
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          const data = result.value;
          cells[i].pv.textContent = data.page_pv.toLocaleString("zh-CN");
          cells[i].uv.textContent = data.page_uv.toLocaleString("zh-CN");
          successful.push(data);
        } else {
          cells[i].pv.textContent = cells[i].uv.textContent = "暂不可用";
        }
      });
      if (successful.length) {
        sitePv.textContent = Math.max(...successful.map(data => data.site_pv)).toLocaleString("zh-CN");
        siteUv.textContent = Math.max(...successful.map(data => data.site_uv)).toLocaleString("zh-CN");
      }
      status.textContent = successful.length === pages.length
        ? "更新于 " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) + "（北京时间）"
        : successful.length ? "部分栏目暂时无法查询；可稍后刷新。" : "统计服务暂时不可用；可稍后刷新。族谱浏览不受影响。";
      refresh.disabled = false;
    }
    refresh.addEventListener("click", update);
    update();
  }

  function start() {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = new URL("site-analytics.css?v=20261004-analytics", assetUrl).href;
    document.head.append(style);
    if (isDashboard) { mountDashboard(); return; }
    if (isRedirecting()) return;
    mountLink();
    if (!isProduction || !pages.some(([page]) => page === canonicalFile)) return;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
    // Once per document load; no counting on searches, hash changes or automatic retries.
    requestCounts("POST", canonicalFile).catch(() => {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
