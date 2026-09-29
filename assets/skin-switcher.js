(() => {
  const site = window.ZongpuSite;
  const media = window.matchMedia("(max-width: 820px), (max-width: 1024px) and (max-height: 500px)");
  const ink = "ink-archive";
  const isMobile = () => media.matches;
  const skinUrl = () => site.inkUrl();

  function mount() {
    const header = document.querySelector(".site-header-inner");
    if (!header) return null;
    if (document.querySelector(".skin-toggle")) return document.querySelector(".skin-toggle");
    const toggle = document.createElement("label");
    toggle.className = "skin-toggle";
    toggle.innerHTML = '<span>纸卷</span><input type="checkbox" aria-label="切换为墨砚档案皮肤"><i aria-hidden="true"></i><span>墨砚</span>';
    const input = toggle.querySelector("input");
    input.addEventListener("change", () => {
      site.writeSkin(ink);
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
    share.addEventListener("click", () => site.copyLink(share));
    (isMobile() ? document.body : document.querySelector(".site-header-inner"))?.append(share);
    media.addEventListener("change", () => {
      document.querySelector(".skin-toggle").hidden = isMobile();
      (isMobile() ? document.body : document.querySelector(".site-header-inner"))?.append(share);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/ink-archive-skin.css?v=20260818";
    document.head.append(link);
    const toggleStyle = document.createElement("link");
    toggleStyle.rel = "stylesheet";
    toggleStyle.href = "assets/skin-toggle.css?v=20260929-mobile-audit";
    document.head.append(toggleStyle);
    const toggle = mount();
    if (toggle) {
      toggle.hidden = isMobile();
      toggle.querySelector("input").checked = false;
    }
    mountShare();
    if (!isMobile() && new URLSearchParams(location.search).get("skin") !== "paper" && site.readSkin() === ink) location.replace(skinUrl());
  });
})();
