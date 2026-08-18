(() => {
  const key = "zongpu-ui-skin";
  const ink = "ink-archive";
  const isMobile = () => window.matchMedia("(max-width: 820px)").matches;
  const skinPage = () => ({ "home.html": "index.html", "index.html": "tree.html" }[location.pathname.split("/").pop()] || location.pathname.split("/").pop());
  const skinUrl = () => new URL(`ink-archive/${skinPage()}${location.search}${location.hash}`, location.href).href;

  async function copyCurrentLink(button) {
    const url = location.href;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const field = document.createElement("textarea");
        field.value = url;
        field.setAttribute("readonly", "");
        field.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.append(field);
        field.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
        field.remove();
      }
      button.classList.add("is-copied");
      button.querySelector("span").textContent = "已复制";
      window.setTimeout(() => {
        button.classList.remove("is-copied");
        button.querySelector("span").textContent = "分享";
      }, 1600);
    } catch {
      button.querySelector("span").textContent = "复制失败";
      window.setTimeout(() => { button.querySelector("span").textContent = "分享"; }, 1600);
    }
  }

  function mount() {
    const header = document.querySelector(".site-header-inner");
    if (!header) return null;
    if (document.querySelector(".skin-switcher")) return document.querySelector(".skin-switcher");
    const toggle = document.createElement("label");
    toggle.className = "skin-toggle";
    toggle.innerHTML = '<span>纸卷</span><input type="checkbox" aria-label="切换为墨砚档案皮肤"><i aria-hidden="true"></i><span>墨砚</span>';
    const input = toggle.querySelector("input");
    input.addEventListener("change", () => {
      localStorage.setItem(key, ink);
      location.assign(skinUrl());
    });
    header.append(toggle);
    return toggle;
  }

  function mountShare() {
    if (document.querySelector(".share-link")) return;
    const share = document.createElement("button");
    share.type = "button";
    share.className = "share-link";
    share.setAttribute("aria-label", "复制当前页面链接");
    share.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3-5.5 5.5h3.75V14h3.5V8.5h3.75L12 3ZM6 15v4.5c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5V15h-2v4H8v-4H6Z"/></svg><span>分享</span>';
    share.addEventListener("click", () => copyCurrentLink(share));
    document.querySelector(".site-header-inner")?.append(share);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/ink-archive-skin.css?v=20260818";
    document.head.append(link);
    const toggleStyle = document.createElement("link");
    toggleStyle.rel = "stylesheet";
    toggleStyle.href = "assets/skin-toggle.css?v=20260818-share-mobile";
    document.head.append(toggleStyle);
    const toggle = mount();
    if (toggle) {
      toggle.hidden = isMobile();
      toggle.querySelector("input").checked = false;
    }
    mountShare();
    if (!isMobile() && localStorage.getItem(key) === ink) location.replace(skinUrl());
  });
})();
