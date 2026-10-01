(() => {
  "use strict";
  const library = window.BiographyAudioTracks;
  if (!library) return;
  const assetBase = new URL("audio/biographies/", document.currentScript.src);
  const player = document.createElement("section");
  player.className = "bio-audio";
  player.setAttribute("aria-labelledby", "bio-audio-heading");
  player.innerHTML = `
    <div class="bio-audio-header">
      <div class="bio-audio-heading">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/></svg>
        <h3 id="bio-audio-heading">音频朗读</h3>
        <span class="bio-audio-current" aria-live="polite"></span>
      </div>
      <label class="bio-audio-speed">倍速<select aria-label="朗读速度">
        <option value="0.75">0.75×</option><option value="1" selected>1×</option>
        <option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option>
      </select></label>
    </div>
    <div class="bio-audio-choices" role="group" aria-label="选择朗读内容"></div>
    <div class="bio-audio-controls">
      <button class="bio-audio-toggle" type="button" aria-label="播放朗读" title="播放朗读">
        <svg class="bio-audio-play-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5a1 1 0 0 1 1.52-.85l10 6.5a1 1 0 0 1 0 1.7l-10 6.5A1 1 0 0 1 8 18.5z"/></svg>
        <svg class="bio-audio-pause-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
      </button>
      <span class="bio-audio-elapsed" aria-hidden="true">0:00</span>
      <input class="bio-audio-progress" type="range" min="0" max="100" value="0" step="0.1" aria-label="朗读进度" disabled />
      <span class="bio-audio-duration" aria-hidden="true">--:--</span>
      <button class="bio-audio-mute" type="button" aria-label="静音" title="静音" aria-pressed="false">
        <svg class="bio-audio-sound-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6.5 9H4v6h2.5L11 19z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>
        <svg class="bio-audio-muted-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6.5 9H4v6h2.5L11 19z"/><path d="m15.5 9 5 6m0-6-5 6"/></svg>
      </button>
      <audio preload="none">您的浏览器不支持音频播放。</audio>
    </div>
    <p class="bio-audio-error" role="status" hidden><span></span><button type="button">重试播放</button></p>`;

  const audio = player.querySelector("audio");
  const choices = player.querySelector(".bio-audio-choices");
  const currentLabel = player.querySelector(".bio-audio-current");
  const speed = player.querySelector("select");
  const error = player.querySelector(".bio-audio-error");
  const toggle = player.querySelector(".bio-audio-toggle");
  const progress = player.querySelector(".bio-audio-progress");
  const elapsed = player.querySelector(".bio-audio-elapsed");
  const duration = player.querySelector(".bio-audio-duration");
  const mute = player.querySelector(".bio-audio-mute");
  const positions = new Map();
  const selections = new Map();
  let articleId, articleTitle, track, pendingSeek = 0, rate = 1, request = 0;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    const whole = Math.floor(seconds);
    const minutes = Math.floor(whole / 60);
    const clock = `${String(Math.floor(whole % 60)).padStart(2, "0")}`;
    return minutes < 60 ? `${minutes}:${clock}`
      : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${clock}`;
  }

  function updatePlayback() {
    const playing = !audio.paused && !audio.ended;
    toggle.setAttribute("aria-label", playing ? "暂停朗读" : "播放朗读");
    toggle.title = playing ? "暂停朗读" : "播放朗读";
    toggle.setAttribute("aria-pressed", String(playing));
    elapsed.textContent = formatTime(audio.currentTime) === "--:--" ? "0:00" : formatTime(audio.currentTime);
    const length = audio.duration;
    const ready = Number.isFinite(length) && length > 0;
    duration.textContent = ready ? formatTime(length) : "--:--";
    progress.disabled = !ready;
    progress.max = ready ? String(length) : "100";
    progress.value = ready ? String(Math.min(audio.currentTime || 0, length)) : "0";
    progress.style.setProperty("--bio-audio-progress", ready ? `${Math.min(100, (audio.currentTime / length) * 100)}%` : "0%");
    progress.setAttribute("aria-valuetext", ready ? `${formatTime(audio.currentTime)} / ${formatTime(length)}` : "尚未载入音频时长");
  }

  function rememberAndPause() {
    // Do not overwrite a saved position while the new recording is still loading.
    if (track && audio.readyState > 0 && pendingSeek === null) {
      if (audio.ended) positions.delete(track.file);
      else positions.set(track.file, audio.currentTime);
    }
    audio.pause();
    updatePlayback();
  }

  function showError(message) {
    error.querySelector("span").textContent = message;
    error.hidden = false;
  }

  function play() {
    const ticket = request;
    const result = audio.play();
    if (result) result.catch(reason => {
      if (ticket === request && reason.name !== "AbortError") {
        showError("暂时无法播放，请重试。");
      }
    });
  }

  function selectTrack(index, continuePlaying = false) {
    rememberAndPause();
    request += 1;
    track = library[articleId][index];
    selections.set(articleId, index);
    pendingSeek = positions.get(track.file) || 0;
    error.hidden = true;
    currentLabel.textContent = track.label === "原文" || track.label === "白话文"
      ? `${track.label}朗读` : track.label;
    choices.querySelectorAll("button").forEach((button, i) => {
      button.setAttribute("aria-pressed", String(i === index));
    });
    audio.setAttribute("aria-label", `${articleTitle} · ${track.label}朗读`);
    audio.src = new URL(encodeURIComponent(track.file), assetBase).href;
    // No preload or autoplay: only the recording the visitor plays is downloaded.
    audio.load();
    audio.playbackRate = rate;
    updatePlayback();
    if (continuePlaying) play();
  }

  function mount(id) {
    if (id === articleId || !library[id]) return;
    const panel = document.getElementById(id);
    const head = panel && panel.querySelector(".bio-head");
    if (!head) return;
    articleId = id;
    articleTitle = head.querySelector("h2").textContent.trim();
    choices.replaceChildren();
    choices.hidden = library[id].length === 1;
    currentLabel.hidden = !choices.hidden;
    library[id].forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.label;
      button.addEventListener("click", () => {
        if (track === item) return;
        selectTrack(index, !audio.paused && !audio.ended);
      });
      choices.append(button);
    });
    head.after(player);
    // One shared audio element guarantees that hidden articles cannot keep playing.
    selectTrack(selections.get(id) || 0);
  }

  audio.addEventListener("loadedmetadata", () => {
    audio.playbackRate = rate;
    if (pendingSeek > 0 && Number.isFinite(audio.duration)) {
      audio.currentTime = pendingSeek < audio.duration ? pendingSeek : 0;
    }
    pendingSeek = null;
    updatePlayback();
  });
  audio.addEventListener("ended", () => {
    if (track) positions.delete(track.file);
    updatePlayback();
  });
  audio.addEventListener("playing", () => { error.hidden = true; updatePlayback(); });
  audio.addEventListener("play", updatePlayback);
  audio.addEventListener("pause", updatePlayback);
  audio.addEventListener("timeupdate", updatePlayback);
  audio.addEventListener("durationchange", updatePlayback);
  audio.addEventListener("error", () => {
    showError("音频暂时无法加载，请检查网络后重试。");
    updatePlayback();
  });
  toggle.addEventListener("click", () => {
    if (audio.paused || audio.ended) play();
    else audio.pause();
    updatePlayback();
  });
  progress.addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Number(progress.value);
      updatePlayback();
    }
  });
  mute.addEventListener("click", () => {
    audio.muted = !audio.muted;
    mute.setAttribute("aria-pressed", String(audio.muted));
    mute.setAttribute("aria-label", audio.muted ? "取消静音" : "静音");
    mute.title = audio.muted ? "取消静音" : "静音";
  });
  speed.addEventListener("change", () => {
    rate = Number(speed.value);
    audio.playbackRate = rate;
  });
  // Keep the selector in sync if a browser offers its own playback-speed menu.
  audio.addEventListener("ratechange", () => {
    const value = String(audio.playbackRate);
    rate = audio.playbackRate;
    if (!Array.from(speed.options).some(option => option.value === value)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = `${value}×`;
      speed.append(option);
    }
    speed.value = value;
  });
  error.querySelector("button").addEventListener("click", () => {
    selectTrack(selections.get(articleId) || 0, true);
  });
  document.addEventListener("biography:change", event => mount(event.detail.article));
  window.addEventListener("pagehide", rememberAndPause);
  const active = document.querySelector(".bio-page.active");
  if (active) mount(active.id);
})();
