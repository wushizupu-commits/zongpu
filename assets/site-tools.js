(() => {
  const key = "zongpu-ui-skin";
  const pages = new Set(["index.html", "tree.html", "biographies.html", "image_archive.html", "family_customs.html", "revisions.html", "source_migration.html"]);

  function paperUrl(href = location.href) {
    const source = new URL(href);
    const page = source.pathname.split("/").pop() || "index.html";
    const target = new URL(`../${({ "index.html": "home.html", "tree.html": "index.html" })[page] || page}`, source);
    target.search = source.search;
    target.hash = source.hash;
    if (page === "tree.html") target.searchParams.set("view", "tree");
    return target.href;
  }

  function inkUrl(href = location.href) {
    const source = new URL(href);
    const page = source.pathname.split("/").pop() || "home.html";
    const target = new URL(`ink-archive/${({ "home.html": "index.html", "index.html": "tree.html" })[page] || page}`, source);
    target.search = source.search;
    target.hash = source.hash;
    target.searchParams.delete("skin");
    return target.href;
  }

  // Resolve against the document URL, not the ink pages' parent-directory <base>.
  function inkLink(value, href = location.href) {
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(value)) return null;
    const source = new URL(href);
    const target = new URL(value, source);
    if (target.pathname.slice(0, target.pathname.lastIndexOf("/") + 1) !== source.pathname.slice(0, source.pathname.lastIndexOf("/") + 1)) return null;
    const page = target.pathname.split("/").pop();
    if (!pages.has(page)) return null;
    if (page === "index.html" && (target.searchParams.has("person") || target.searchParams.get("view") === "tree" || target.hash.startsWith("#person="))) {
      target.pathname = target.pathname.replace(/index\.html$/, "tree.html");
    }
    return target.href;
  }

  function readSkin() {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writeSkin(skin) {
    try { localStorage.setItem(key, skin); return true; } catch { return false; }
  }

  function legacyCopy(text) {
    const focused = document.activeElement;
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
    document.body.append(field);
    try {
      field.focus({ preventScroll: true });
      field.select();
      if (!document.execCommand("copy")) throw new Error("copy failed");
    } finally {
      field.remove();
      focused?.focus({ preventScroll: true });
    }
  }

  let notice, timer;
  function feedback(message) {
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "share-status";
      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");
      document.body.append(notice);
    }
    clearTimeout(timer);
    notice.textContent = message;
    notice.classList.add("is-visible");
    timer = setTimeout(() => notice.classList.remove("is-visible"), 3000);
  }

  async function copyLink(button) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      try {
        if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
        await navigator.clipboard.writeText(location.href);
      } catch { legacyCopy(location.href); }
      feedback(location.protocol === "file:" ? "本地预览链接已复制（仅本机可用）" : "链接已复制，可以粘贴分享");
    } catch {
      feedback("未能复制，请复制浏览器地址栏中的链接");
    } finally { button.disabled = false; }
  }

  window.ZongpuSite = { paperUrl, inkUrl, inkLink, readSkin, writeSkin, copyLink };
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("site-tools.css?v=20260928", document.currentScript.src).href;
  document.head.append(style);
})();
