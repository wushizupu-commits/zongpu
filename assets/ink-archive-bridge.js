(() => {
  const pages = new Set(["index.html", "tree.html", "biographies.html", "image_archive.html", "family_customs.html", "revisions.html", "source_migration.html"]);
  const paper = { "index.html": "home.html", "tree.html": "index.html?view=tree" };
  const current = location.pathname.split("/").pop();
  const mobileQuery = matchMedia("(max-width: 820px)");
  const paperUrl = () => new URL(`../${paper[current] || current}`, location.href).href;
  const returnToPaper = () => location.replace(paperUrl());
  if (mobileQuery.matches) {
    returnToPaper();
    return;
  }
  mobileQuery.addEventListener("change", ({ matches }) => {
    if (matches) returnToPaper();
  });
  function mapLinks() {
    document.querySelectorAll("a[href]").forEach((link) => {
      const value = link.getAttribute("href");
      const [path, suffix = ""] = value.split(/(?=[?#])/);
      if (pages.has(path)) link.href = new URL(`${path}${suffix}`, location.href).href;
    });
  }
  async function copyCurrentLink(button) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(location.href);
      else {
        const field = document.createElement("textarea");
        field.value = location.href;
        field.setAttribute("readonly", "");
        field.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.append(field);
        field.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
        field.remove();
      }
      button.classList.add("is-copied");
      button.querySelector("span").textContent = "已复制";
      window.setTimeout(() => { button.classList.remove("is-copied"); button.querySelector("span").textContent = "分享"; }, 1600);
    } catch {
      button.querySelector("span").textContent = "复制失败";
      window.setTimeout(() => { button.querySelector("span").textContent = "分享"; }, 1600);
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    mapLinks();
    const style = document.createElement("style");
    style.textContent = ".skin-toggle{display:inline-flex;align-items:center;gap:8px;margin-left:auto;color:#e9dcc2;font:700 12px/1 'Noto Sans SC','Microsoft YaHei',sans-serif;white-space:nowrap;cursor:pointer}.skin-toggle input{position:absolute;opacity:0;pointer-events:none}.skin-toggle i{position:relative;width:38px;height:22px;border:1px solid rgba(214,192,143,.72);border-radius:999px;background:rgba(255,255,255,.08);transition:.18s}.skin-toggle i::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#e9dcc2;transition:.18s}.skin-toggle input:checked+i{background:#b23a26;border-color:#dc785c}.skin-toggle input:checked+i::after{transform:translateX(16px);background:#fff8e8}.share-link{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;padding:7px 10px;border:1px solid rgba(214,192,143,.72);border-radius:999px;background:rgba(255,255,255,.06);color:#e9dcc2;font:700 13px/1 'Noto Sans SC','Microsoft YaHei',sans-serif;cursor:pointer}.share-link:hover{border-color:#e58461;background:rgba(190,59,35,.22)}.share-link.is-copied{border-color:#83c6b5;background:rgba(38,106,102,.35);color:#d7f1e7}.share-link svg{width:14px;height:14px;fill:currentColor}@media(max-width:820px){.skin-toggle{display:none}.share-link{display:none}}";
    document.head.append(style);
    const header = document.querySelector(".masthead-inner, .site-header-inner");
    if (!header) return;
    const toggle = document.createElement("label");
    toggle.className = "skin-toggle";
    toggle.innerHTML = '<span>纸卷</span><input type="checkbox" checked aria-label="切换为当前纸卷皮肤"><i aria-hidden="true"></i><span>墨砚</span>';
    toggle.querySelector("input").addEventListener("change", () => {
      localStorage.setItem("zongpu-ui-skin", "paper");
      location.assign(paperUrl());
    });
    header.append(toggle);
    const share = document.createElement("button");
    share.type = "button";
    share.className = "share-link";
    share.setAttribute("aria-label", "复制当前页面链接");
    share.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3-5.5 5.5h3.75V14h3.5V8.5h3.75L12 3ZM6 15v4.5c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V15h-2v4H8v-4H6Z"/></svg><span>分享</span>';
    share.addEventListener("click", () => copyCurrentLink(share));
    header.append(share);
  });
})();
