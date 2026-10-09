(() => {
  'use strict';

  const dialog = document.getElementById('home-video-dialog');
  if (!dialog) return;

  const player = dialog.querySelector('video');
  const closeButton = dialog.querySelector('.home-video-close');
  const errorMessage = dialog.querySelector('.home-video-error');
  const retryButton = dialog.querySelector('.home-video-retry');
  const mobile = dialog.hasAttribute('data-desktop-only')
    ? matchMedia('(max-width: 820px), (max-width: 1024px) and (max-height: 500px), (hover: none) and (pointer: coarse)')
    : null;
  let opener = null;
  let savedScroll = null;

  function play() {
    errorMessage.hidden = true;
    const playback = player.play();
    if (playback) playback.catch((error) => {
      if (dialog.open && error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
        errorMessage.hidden = false;
      }
    });
  }

  function open(event) {
    if (dialog.open || (mobile && mobile.matches)) return;
    opener = event.currentTarget;
    savedScroll = { x: window.scrollX, y: window.scrollY, top: document.body.style.top };
    document.body.style.top = `-${savedScroll.y}px`;
    document.documentElement.classList.add('home-video-opened');
    document.body.classList.add('home-video-opened');
    dialog.showModal();
    closeButton.focus({ preventScroll: true });

    // Defer the video download until the visitor explicitly opens the player.
    if (!player.hasAttribute('src')) {
      player.src = new URL(player.dataset.src, document.baseURI).href;
    }
    play();
  }

  document.querySelectorAll('.home-video-open').forEach((button) => {
    button.addEventListener('click', open);
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    player.pause();
    document.documentElement.classList.remove('home-video-opened');
    document.body.classList.remove('home-video-opened');
    if (savedScroll) {
      document.body.style.top = savedScroll.top;
      window.scrollTo({ left: savedScroll.x, top: savedScroll.y, behavior: 'instant' });
      savedScroll = null;
    }
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });
  player.addEventListener('error', () => { errorMessage.hidden = false; });
  player.addEventListener('playing', () => { errorMessage.hidden = true; });
  retryButton.addEventListener('click', () => { player.load(); play(); });
  if (mobile) mobile.addEventListener('change', () => {
    if (mobile.matches && dialog.open) dialog.close();
  });
  window.addEventListener('pagehide', () => {
    if (dialog.open) dialog.close();
    player.pause();
  });
})();
