const $ = (id) => document.getElementById(id);

const state = {
  mode: "countdown",
  status: "idle", // idle, running, paused, finished
  duration: 3600,
  remaining: 3600,
  elapsed: 0,
  startedAt: null,
  interval: null,
  warningSeconds: 300,
  warningPlayed: false,
  // Peringatan hampir habis tetap menggunakan suara default.
  warningAudioUrl: null,

  // Sirine hanya digunakan ketika countdown mencapai 00:00.
  endAudioUrl: "sirine.mp3",

  // Logo bawaan HIMA.
  logoUrl: "logihima.png",
  audioContext: null,
};

const timerEl = $("timer");
const stateEl = $("timerState");
const progressFill = $("progressFill");
const startBtn = $("startBtn");
const pauseBtn = $("pauseBtn");
const resumeBtn = $("resumeBtn");
const resetBtn = $("resetBtn");
const minutesInput = $("minutesInput");
const secondsInput = $("secondsInput");

function formatTime(total) {
  total = Math.max(0, Math.floor(total));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function getConfiguredDuration() {
  const mins = Math.max(0, Math.min(999, Number(minutesInput.value) || 0));
  const secs = Math.max(0, Math.min(59, Number(secondsInput.value) || 0));
  minutesInput.value = mins;
  secondsInput.value = secs;
  return mins * 60 + secs;
}
function currentValue() {
  return state.mode === "countdown" ? state.remaining : state.elapsed;
}
function updateDisplay() {
  const value = currentValue();
  timerEl.textContent = formatTime(value);
  timerEl.classList.toggle(
    "warning",
    state.mode === "countdown" &&
      value <= state.warningSeconds &&
      value > 0 &&
      state.status === "running",
  );
  timerEl.classList.toggle("finished", state.status === "finished");
  const total =
    state.mode === "countdown" ? state.duration : Math.max(state.elapsed, 1);
  const progress =
    state.mode === "countdown"
      ? state.duration
        ? ((state.duration - state.remaining) / state.duration) * 100
        : 0
      : ((state.elapsed % 3600) / 3600) * 100;
  progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  $("progressStart").textContent =
    state.mode === "countdown" ? "MULAI" : "00:00";
  $("progressEnd").textContent =
    state.mode === "countdown" ? formatTime(state.duration) : "BERJALAN";
  $("timerCaption").textContent =
    state.mode === "countdown" ? "WAKTU TERSISA" : "WAKTU BERJALAN";
  $("durationControl").style.opacity = state.mode === "countdown" ? "1" : ".35";
  minutesInput.disabled = secondsInput.disabled =
    state.mode !== "countdown" ||
    state.status === "running" ||
    state.status === "paused";
}
function setStatus(status) {
  state.status = status;
  const labels = {
    idle: "SIAP DIMULAI",
    running: "TES SEDANG BERLANGSUNG",
    paused: "TIMER DIJEDA",
    finished: "WAKTU TELAH HABIS",
  };
  stateEl.textContent = labels[status];
  $("footerStatus").textContent =
    status === "running"
      ? "SESSION IN PROGRESS"
      : status === "finished"
        ? "SESSION FINISHED"
        : status === "paused"
          ? "SESSION PAUSED"
          : "SYSTEM READY";
  startBtn.disabled = status === "running" || status === "paused";
  pauseBtn.disabled = status !== "running";
  resumeBtn.disabled = status !== "paused";
  resetBtn.disabled = false;
  updateDisplay();
}
function stopInterval() {
  if (state.interval) clearInterval(state.interval);
  state.interval = null;
}
function startTimer() {
  if (state.status === "finished") resetTimer();
  if (state.status === "idle") {
    if (state.mode === "countdown") {
      state.duration = getConfiguredDuration();
      if (state.duration <= 0) {
        showAnnouncement(
          "DURASI BELUM DIATUR",
          "Masukkan durasi lebih dari 0 detik.",
        );
        return;
      }
      state.remaining = state.duration;
    } else {
      state.elapsed = 0;
    }
  }
  state.startedAt = Date.now();
  setStatus("running");
  stopInterval();
  state.interval = setInterval(tick, 200);
}
function tick() {
  const delta = Math.floor((Date.now() - state.startedAt) / 1000);
  if (state.mode === "countdown") {
    const next = Math.max(0, state.remainingAtStart - delta);
    state.remaining = next;
    if (
      !state.warningPlayed &&
      state.warningSeconds > 0 &&
      next <= state.warningSeconds &&
      next > 0
    ) {
      state.warningPlayed = true;
      playAlert("warning");
      showAnnouncement(
        "WAKTU HAMPIR HABIS",
        `Waktu tersisa ${formatTime(next)}. Harap segera menyelesaikan jawaban.`,
      );
    }
    if (next <= 0) {
      state.remaining = 0;
      finishTimer();
      return;
    }
  } else {
    state.elapsed = state.elapsedAtStart + delta;
  }
  updateDisplay();
}
function pauseTimer() {
  if (state.status !== "running") return;
  const delta = Math.floor((Date.now() - state.startedAt) / 1000);
  if (state.mode === "countdown")
    state.remaining = Math.max(0, state.remainingAtStart - delta);
  else state.elapsed = state.elapsedAtStart + delta;
  stopInterval();
  setStatus("paused");
}
function resumeTimer() {
  if (state.status !== "paused") return;
  state.startedAt = Date.now();
  setStatus("running");
  state.interval = setInterval(tick, 200);
}
function finishTimer() {
  stopInterval();
  setStatus("finished");
  playAlert("end");
  showAnnouncement(
    "WAKTU HABIS",
    "Waktu tes tulis telah berakhir. Silakan berhenti mengerjakan.",
  );
  document.body.classList.add("urgent");
}
function resetTimer() {
  stopInterval();
  document.body.classList.remove("urgent");
  state.duration =
    state.mode === "countdown" ? getConfiguredDuration() : state.duration;
  state.remaining = state.duration;
  state.elapsed = 0;
  state.warningPlayed = false;
  $("announcement").classList.add("hidden");
  setStatus("idle");
}
function switchMode(mode) {
  if (state.status === "running" || state.status === "paused") {
    showAnnouncement(
      "TIMER MASIH AKTIF",
      "Pause lalu reset timer sebelum mengganti mode.",
    );
    return;
  }
  state.mode = mode;
  document
    .querySelectorAll(".mode-btn")
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.mode === mode),
    );
  document.body.classList.remove("urgent");
  state.remaining = getConfiguredDuration();
  state.duration = state.remaining;
  state.elapsed = 0;
  state.warningPlayed = false;
  setStatus("idle");
}
function showAnnouncement(title, message) {
  $("announcementTitle").textContent = title;
  $("announcementText").textContent = message;
  $("announcement").classList.remove("hidden");
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body: message });
    } catch (_) {}
  }
}
function playTone(
  frequency,
  duration,
  type = "sine",
  volume = 0.16,
  delay = 0,
) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.audioContext ||= new AudioContext();
    const ctx = state.audioContext;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(
      volume,
      ctx.currentTime + delay + 0.025,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + delay + duration,
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.04);
  } catch (_) {}
}
function playDefault(kind) {
  if (kind === "warning") {
    playTone(740, 0.22, "sine", 0.13, 0);
    playTone(620, 0.28, "sine", 0.13, 0.28);
  } else {
    playTone(660, 0.35, "square", 0.12, 0);
    playTone(520, 0.35, "square", 0.12, 0.42);
    playTone(660, 0.55, "square", 0.12, 0.84);
  }
}
function playAlert(kind) {
  // Peringatan waktu hampir habis.
  if (kind === "warning") {
    playDefault("warning");
    return;
  }

  // Sirine khusus ketika waktu habis.
  if (kind === "end") {
    const siren = new Audio("sirine.mp3");
    siren.volume = 1;
    siren.play().catch((error) => {
      console.error("Sirine gagal diputar:", error);
    });
  }
}
function openSettings() {
  $("settingsOverlay").classList.remove("hidden");
}
function closeSettings() {
  $("settingsOverlay").classList.add("hidden");
}
function updateClock() {
  $("clock").textContent = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

startBtn.addEventListener("click", () => {
  if (state.status === "finished") resetTimer();
  if (state.mode === "countdown" && state.status === "idle")
    state.remainingAtStart = getConfiguredDuration();
  else state.remainingAtStart = state.remaining;
  state.elapsedAtStart = state.elapsed;
  startTimer();
});
pauseBtn.addEventListener("click", pauseTimer);
resumeBtn.addEventListener("click", () => {
  if (state.mode === "countdown") state.remainingAtStart = state.remaining;
  state.elapsedAtStart = state.elapsed;
  resumeTimer();
});
resetBtn.addEventListener("click", resetTimer);
document
  .querySelectorAll(".mode-btn")
  .forEach((btn) =>
    btn.addEventListener("click", () => switchMode(btn.dataset.mode)),
  );
minutesInput.addEventListener("change", () => {
  if (state.status === "idle") resetTimer();
});
secondsInput.addEventListener("change", () => {
  if (state.status === "idle") resetTimer();
});
$("settingsBtn").addEventListener("click", openSettings);
$("closeSettings").addEventListener("click", closeSettings);
$("doneSettings").addEventListener("click", closeSettings);
$("settingsOverlay").addEventListener("click", (e) => {
  if (e.target === $("settingsOverlay")) closeSettings();
});
$("fullscreenBtn").addEventListener("click", toggleFullscreen);
function toggleFullscreen() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
}
$("warningInput").addEventListener("change", () => {
  state.warningSeconds = Math.max(0, Number($("warningInput").value) || 0) * 60;
  state.warningPlayed = false;
});
$("logoInput").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (state.logoUrl) URL.revokeObjectURL(state.logoUrl);
  state.logoUrl = URL.createObjectURL(file);
  $("logoPreview").src = state.logoUrl;
  $("logoPreview").hidden = false;
  document.querySelector(".logo-fallback").hidden = true;
  $("logoFileName").textContent = file.name;
});
function loadAudio(inputId, stateKey, nameId) {
  $(inputId).addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (state[stateKey]) URL.revokeObjectURL(state[stateKey]);
    state[stateKey] = URL.createObjectURL(file);
    $(nameId).textContent = file.name;
    $("soundStatus").textContent = "Suara kustom dipilih";
  });
}
loadAudio("warningAudioInput", "warningAudioUrl", "warningAudioName");
loadAudio("endAudioInput", "endAudioUrl", "endAudioName");
$("testSoundBtn").addEventListener("click", () => playAlert("warning"));
$("dismissAnnouncement").addEventListener("click", () =>
  $("announcement").classList.add("hidden"),
);
$("resetCustomization").addEventListener("click", () => {
  ["logoInput", "warningAudioInput", "endAudioInput"].forEach(
    (id) => ($(id).value = ""),
  );

  if (state.logoUrl !== "assets/logihima.png") {
    URL.revokeObjectURL(state.logoUrl);
  }

  state.logoUrl = "logihima.png";
  state.warningAudioUrl = null;
  state.endAudioUrl = "sirine.mp3";

  $("logoPreview").src = "assets/logihima.png";
  $("logoPreview").hidden = false;

  document.querySelector(".logo-fallback").hidden = true;

  $("logoFileName").textContent = "logihima.png · logo aktif";
  $("warningAudioName").textContent = "Menggunakan suara default";
  $("endAudioName").textContent = "sirine.mp3 · suara waktu habis";

  $("soundStatus").textContent = "Suara default + sirine";

  $("warningInput").value = 5;
  state.warningSeconds = 300;
  state.warningPlayed = false;
});
document.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  if (e.key.toLowerCase() === "f") toggleFullscreen();
  if (e.code === "Space") {
    e.preventDefault();
    if (state.status === "running") pauseTimer();
    else if (state.status === "paused") {
      state.remainingAtStart = state.remaining;
      state.elapsedAtStart = state.elapsed;
      resumeTimer();
    } else startBtn.click();
  }
  if (e.key.toLowerCase() === "r") resetTimer();
  if (e.key === "Escape") closeSettings();
});
if ("Notification" in window && Notification.permission === "default") {
  // Permission is requested only after the user starts the session.
  startBtn.addEventListener(
    "click",
    () => {
      if (Notification.permission === "default")
        Notification.requestPermission().catch(() => {});
    },
    { once: true },
  );
}
setInterval(updateClock, 250);
updateClock();
state.remaining = getConfiguredDuration();
updateDisplay();
setStatus("idle");
