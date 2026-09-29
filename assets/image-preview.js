(() => {
  const dialog = document.querySelector("dialog.image-preview");
  if (!dialog) return;
  const image = dialog.querySelector("img");
  const title = dialog.querySelector("strong");
  const closeButton = dialog.querySelector("button");
  let returnFocus = null;
  let scrollPosition = { left: 0, top: 0 };
  let previousTop = "";

  function openPreview(trigger) {
    if (dialog.open) return;
    returnFocus = trigger;
    scrollPosition = { left: window.scrollX, top: window.scrollY };
    previousTop = document.body.style.top;
    image.src = trigger.dataset.full || trigger.dataset.src;
    image.alt = trigger.dataset.alt || trigger.dataset.title || "原图";
    title.textContent = trigger.dataset.title || "原图预览";
    // Fixed-body locking also prevents background scrolling in iOS webviews.
    document.body.style.top = `-${scrollPosition.top}px`;
    document.body.classList.add("image-preview-open");
    document.documentElement.classList.add("image-preview-open");
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
  }

  document.querySelectorAll(".image-open, .revision-image-trigger").forEach(trigger => {
    trigger.addEventListener("click", () => openPreview(trigger));
  });
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("image-preview-open");
    document.body.style.top = previousTop;
    window.scrollTo({ ...scrollPosition, behavior: "instant" });
    document.documentElement.classList.remove("image-preview-open");
    image.removeAttribute("src");
    image.alt = "";
    returnFocus?.focus({ preventScroll: true });
  });
})();
