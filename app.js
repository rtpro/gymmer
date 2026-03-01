/**
 * Gymmer – Work / Rest timer
 * Counts down work phase, then rest phase, and repeats until stopped.
 */

(function () {
  "use strict";

  const PREP_SECONDS = 3;
  const STORAGE_KEY = "gymmer_completions";
  const SESSION_KEY = "gymmer_session_v1";
  const MAX_COMPLETIONS = 50;

  const BODY_PART_META = {
    chest: { label: "Chest", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 17v-2.4c0-1 .4-1.9 1.1-2.5l1.2-1c1-.8 1.6-2 1.6-3.3V6.5c0-1.4-1.1-2.5-2.5-2.5S6 5.1 6 6.5V9\"/><path d=\"M17 17v-2.4c0-1-.4-1.9-1.1-2.5l-1.2-1c-1-.8-1.6-2-1.6-3.3V6.5c0-1.4 1.1-2.5 2.5-2.5S18 5.1 18 6.5V9\"/><path d=\"M7 17h10\"/><path d=\"M9.5 20h5\"/></svg>" },
    arms: { label: "Arms", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 15c1.4 0 2.5-1.1 2.5-2.5V10\"/><path d=\"M8.5 10h2.2c1.3 0 2.3 1 2.3 2.3V13\"/><path d=\"M13 13h2.4c1.4 0 2.6 1.2 2.6 2.6S16.8 18 15.4 18H10a4 4 0 0 1-4-4v-1\"/><path d=\"M9 10V7.8c0-.9.7-1.6 1.6-1.6H12\"/></svg>" },
    abs: { label: "Abs", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"4\" width=\"6\" height=\"16\" rx=\"2.2\"/><path d=\"M9 9h6\"/><path d=\"M9 14h6\"/><path d=\"M12 4v16\"/></svg>" },
    back: { label: "Back", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 6.5C8 5.1 9.1 4 10.5 4h3C14.9 4 16 5.1 16 6.5V8\"/><path d=\"M7.5 20V12c0-1.6 1.3-3 3-3h3c1.7 0 3 1.4 3 3v8\"/><path d=\"M10 12v8\"/><path d=\"M14 12v8\"/></svg>" },
    legs: { label: "Legs", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 4v7.5L7 20\"/><path d=\"M15 4v7.5l2 8.5\"/><path d=\"M6.2 20h3.6\"/><path d=\"M14.2 20h3.6\"/></svg>" },
    delts: { label: "Shoulders", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 12a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4\"/><path d=\"M6 12v4\"/><path d=\"M18 12v4\"/><path d=\"M10 8V6.5A1.5 1.5 0 0 1 11.5 5h1A1.5 1.5 0 0 1 14 6.5V8\"/></svg>" },
    custom: { label: "Custom", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 8v8\"/><path d=\"M8 12h8\"/></svg>" },
  };

  const state = {
    workSeconds: 30,
    restSeconds: 60,
    totalSets: 5,
    setsRemaining: 5,
    workPhasesCompleted: 0,
    restPhasesCompleted: 0,
    phase: "work",
    remainingSeconds: 30,
    phaseEndTimestamp: 0,
    running: false,
    intervalId: null,
    selectedWorkoutPreset: null,
  };

  let wakeLockSentinel = null;

  async function requestWakeLock() {
    if (!navigator.wakeLock) return;
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", function () {
        wakeLockSentinel = null;
      });
    } catch (_) {
      wakeLockSentinel = null;
    }
  }

  function releaseWakeLock() {
    if (wakeLockSentinel) {
      try {
        wakeLockSentinel.release();
      } catch (_) {}
      wakeLockSentinel = null;
    }
  }

  const dom = {
    viewSettings: document.getElementById("view-settings"),
    viewTimer: document.getElementById("view-timer"),
    viewHistory: document.getElementById("view-history"),
    setDots: document.getElementById("set-dots"),
    phaseBadge: document.getElementById("phase-badge"),
    timerValue: document.getElementById("timer-value"),
    timerDisplay: document.getElementById("timer-display"),
    timerDisplayBtn: document.getElementById("timer-display-btn"),
    btnStartWorkout: document.getElementById("btn-start-workout"),
    btnStart: document.getElementById("btn-start"),
    btnReset: document.getElementById("btn-reset"),
    timerActions: document.querySelector(".timer-actions"),
    presetBtns: document.querySelectorAll(".preset-btn[data-target]"),
    setBtns: document.querySelectorAll(".preset-btn-sets"),
    workoutPresetBtns: document.querySelectorAll(".preset-btn-workout"),
    customWork: document.getElementById("custom-work"),
    customRest: document.getElementById("custom-rest"),
    completionsList: document.getElementById("completions-list"),
    btnClearHistory: document.getElementById("btn-clear-history"),
    btnViewHistory: document.getElementById("btn-view-history"),
    btnBackHistory: document.getElementById("btn-back-history"),
  };

  function showView(name) {
    const isSettings = name === "settings";
    const isTimer = name === "timer";
    const isHistory = name === "history";
    dom.viewSettings.classList.toggle("hidden", !isSettings);
    dom.viewTimer.classList.toggle("hidden", !isTimer);
    dom.viewHistory.classList.toggle("hidden", !isHistory);
  }

  function goToSettings(skipSave) {
    if (state.running) pauseTimer();
    if (!skipSave) saveSessionIfAny();
    showView("settings");
  }

  function goToTimer() {
    showView("timer");
  }

  function goToHistory() {
    showView("history");
  }

  function getCompletions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveCompletions(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  function getBodyPartMeta(presetId) {
    if (!presetId) return BODY_PART_META.custom;
    return BODY_PART_META[presetId] || { label: presetId.charAt(0).toUpperCase() + presetId.slice(1), icon: BODY_PART_META.custom.icon };
  }

  function renderWorkoutPresetIcons() {
    dom.workoutPresetBtns.forEach((btn) => {
      const iconEl = btn.querySelector(".preset-icon");
      if (!iconEl) return;
      const meta = getBodyPartMeta(btn.dataset.preset);
      iconEl.innerHTML = meta.icon;
    });
  }

  function saveSessionState() {
    const session = {
      workSeconds: state.workSeconds,
      restSeconds: state.restSeconds,
      totalSets: state.totalSets,
      setsRemaining: state.setsRemaining,
      workPhasesCompleted: state.workPhasesCompleted,
      restPhasesCompleted: state.restPhasesCompleted,
      phase: state.phase,
      remainingSeconds: state.remainingSeconds,
      phaseEndTimestamp: state.phaseEndTimestamp,
      running: state.running,
      selectedWorkoutPreset: state.selectedWorkoutPreset,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_) {}
  }

  function clearSessionState() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  function restoreSessionState() {
    let raw = null;
    try {
      raw = localStorage.getItem(SESSION_KEY);
    } catch (_) {
      return false;
    }
    if (!raw) return false;

    let saved = null;
    try {
      saved = JSON.parse(raw);
    } catch (_) {
      clearSessionState();
      return false;
    }
    if (!saved || typeof saved !== "object") return false;

    const parsed = {
      workSeconds: parseInt(saved.workSeconds, 10),
      restSeconds: parseInt(saved.restSeconds, 10),
      totalSets: parseInt(saved.totalSets, 10),
      setsRemaining: parseInt(saved.setsRemaining, 10),
      workPhasesCompleted: parseInt(saved.workPhasesCompleted, 10),
      restPhasesCompleted: parseInt(saved.restPhasesCompleted, 10),
      remainingSeconds: parseInt(saved.remainingSeconds, 10),
      phaseEndTimestamp: parseInt(saved.phaseEndTimestamp, 10),
      phase: saved.phase,
      running: !!saved.running,
      selectedWorkoutPreset: saved.selectedWorkoutPreset != null ? String(saved.selectedWorkoutPreset) : null,
    };

    if (
      isNaN(parsed.workSeconds) ||
      isNaN(parsed.restSeconds) ||
      isNaN(parsed.totalSets) ||
      isNaN(parsed.setsRemaining) ||
      isNaN(parsed.workPhasesCompleted) ||
      isNaN(parsed.restPhasesCompleted) ||
      isNaN(parsed.remainingSeconds) ||
      !parsed.phase ||
      !["prep", "work", "rest"].includes(parsed.phase)
    ) {
      clearSessionState();
      return false;
    }

    state.workSeconds = Math.max(1, parsed.workSeconds);
    state.restSeconds = Math.max(1, parsed.restSeconds);
    state.totalSets = Math.max(1, parsed.totalSets);
    state.setsRemaining = Math.max(0, parsed.setsRemaining);
    state.workPhasesCompleted = Math.max(0, parsed.workPhasesCompleted);
    state.restPhasesCompleted = Math.max(0, parsed.restPhasesCompleted);
    state.phase = parsed.phase;
    state.remainingSeconds = Math.max(0, parsed.remainingSeconds);
    state.phaseEndTimestamp = isNaN(parsed.phaseEndTimestamp) ? 0 : parsed.phaseEndTimestamp;
    state.running = parsed.running;
    state.selectedWorkoutPreset = parsed.selectedWorkoutPreset;

    if (state.phase === "work") {
      dom.phaseBadge.textContent = "Work";
      dom.phaseBadge.className = "phase-badge work";
      dom.timerDisplay.className = "timer-display work";
      dom.timerValue.classList.remove("done-text");
      setTimerValue(formatTime(state.remainingSeconds));
    } else if (state.phase === "rest") {
      dom.phaseBadge.textContent = "Rest";
      dom.phaseBadge.className = "phase-badge rest";
      dom.timerDisplay.className = "timer-display rest";
      dom.timerValue.classList.remove("done-text");
      setTimerValue(formatTime(state.remainingSeconds));
    } else {
      dom.phaseBadge.textContent = "Get ready";
      dom.phaseBadge.className = "phase-badge prep";
      dom.timerDisplay.className = "timer-display prep";
      dom.timerValue.classList.remove("done-text");
      setTimerValue(String(state.remainingSeconds));
    }

    dom.btnReset.textContent = "Hold to reset";
    dom.btnReset.setAttribute("aria-label", "Hold for 1 second to reset and go back");
    dom.btnReset.classList.remove("btn-primary");
    dom.btnReset.classList.add("btn-secondary");
    dom.timerActions.classList.remove("done");

    if (state.setsRemaining <= 0) {
      updateSetDisplay();
      return true;
    }

    if (state.running) {
      dom.btnStart.textContent = "Pause";
      dom.btnStart.setAttribute("aria-label", "Pause timer");
      dom.timerDisplayBtn.setAttribute("aria-label", "Pause timer");
      dom.btnStart.classList.add("running");
      applyPausedUI(false);
      syncTimerFromTimestamp();
      if (state.running && !state.intervalId) {
        state.intervalId = setInterval(tick, 1000);
      }
    } else {
      dom.btnStart.textContent = "Resume";
      dom.btnStart.setAttribute("aria-label", "Resume timer");
      dom.timerDisplayBtn.setAttribute("aria-label", "Resume timer");
      dom.btnStart.classList.remove("running");
      applyPausedUI(true);
      updateProgressRing();
    }
    return true;
  }

  function saveCompletion(completedWork, completedRest, full) {
    const list = getCompletions();
    const bodyPartMeta = getBodyPartMeta(state.selectedWorkoutPreset);
    const bodyPart = bodyPartMeta ? bodyPartMeta.label : null;

    list.unshift({
      date: new Date().toISOString(),
      workSeconds: state.workSeconds,
      restSeconds: state.restSeconds,
      completedWork: completedWork,
      completedRest: completedRest,
      totalSets: state.totalSets,
      full: !!full,
      workoutPreset: state.selectedWorkoutPreset,
      bodyPart: bodyPart,
    });
    saveCompletions(list.slice(0, MAX_COMPLETIONS));
    renderCompletions();
  }

  function saveSessionIfAny() {
    const w = state.workPhasesCompleted;
    const r = state.restPhasesCompleted;
    if (w > 0 || r > 0) saveCompletion(w, r, false);
    clearSessionState();
  }

  function formatDuration(seconds) {
    if (seconds < 60) return seconds + "s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? m + "m" : m + ":" + String(s).padStart(2, "0");
  }

  function renderCompletions() {
    const list = getCompletions();
    dom.completionsList.innerHTML = "";
    if (list.length === 0) {
      const li = document.createElement("li");
      li.className = "completion-item completion-item-empty";
      li.innerHTML = "<span class=\"completion-empty-icon\" aria-hidden=\"true\">🗓️</span><span>No workouts yet</span><small>Complete one session and it will appear here.</small>";
      dom.completionsList.appendChild(li);
    } else {
      const now = new Date();
      list.forEach(function (entry) {
        const d = new Date(entry.date);
        const dateStr = d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
        const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        const workStr = formatDuration(entry.workSeconds);
        const restStr = formatDuration(entry.restSeconds);
        const w = entry.completedWork != null ? entry.completedWork : entry.sets;
        const r = entry.completedRest != null ? entry.completedRest : entry.sets;
        const total = entry.totalSets != null ? entry.totalSets : entry.sets;
        const isFull = !!(entry.full || (entry.completedWork == null && entry.sets != null));

        const summary = isFull
          ? w + " sets completed"
          : w + " work / " + r + " rest" + (total != null ? " of " + total : "");
        const statusClass = isFull ? "is-full" : "is-partial";
        const statusLabel = isFull ? "Completed" : "Partial";
        const bodyPart = entry.bodyPart || (entry.workoutPreset ? getBodyPartMeta(entry.workoutPreset).label : null);

        const li = document.createElement("li");
        li.className = "completion-item";
        li.innerHTML =
          "<div class=\"completion-top\">" +
            "<span class=\"completion-summary\">" + summary + "</span>" +
            "<span class=\"completion-status " + statusClass + "\">" + statusLabel + "</span>" +
          "</div>" +
          "<div class=\"completion-meta\">" +
            (bodyPart ? "<span class=\"completion-body-part\">" + bodyPart + "</span>" : "") +
            "<span>Work " + workStr + "</span>" +
            "<span>Rest " + restStr + "</span>" +
            "<span>" + dateStr + " · " + timeStr + "</span>" +
          "</div>";
        dom.completionsList.appendChild(li);
      });
    }
    dom.btnClearHistory.hidden = list.length === 0;
  }

  function clearHistory() {
    saveCompletions([]);
    renderCompletions();
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : String(s);
  }

  function formatTimeForInput(seconds) {
    if (seconds < 60) return String(seconds);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function parseTimeInput(str) {
    if (!str || typeof str !== "string") return null;
    const trimmed = str.trim();
    if (!trimmed) return null;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx >= 0) {
      const m = parseInt(trimmed.slice(0, colonIdx), 10);
      const s = parseInt(trimmed.slice(colonIdx + 1), 10);
      if (isNaN(m) || isNaN(s) || m < 0 || s < 0 || s >= 60) return null;
      return m * 60 + s;
    }
    const n = parseInt(trimmed, 10);
    return isNaN(n) || n < 1 ? null : n;
  }

  function setTimerValue(str) {
    dom.timerValue.textContent = str;
    var len = str.length;
    if (len === 1) dom.timerValue.setAttribute("data-digits", "1");
    else if (len === 2) dom.timerValue.setAttribute("data-digits", "2");
    else dom.timerValue.setAttribute("data-digits", "long");
  }

  function getPhaseTotalSeconds() {
    if (state.phase === "prep") return PREP_SECONDS;
    return state.phase === "work" ? state.workSeconds : state.restSeconds;
  }

  function setPhaseEndTimestamp() {
    state.phaseEndTimestamp = Date.now() + state.remainingSeconds * 1000;
    saveSessionState();
  }

  function processPhaseEnd(skipAnimation) {
    if (state.phase === "prep") {
      setPhase("work");
      updateProgressRing();
      soundBeginWork();
      haptic();
      return;
    }
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    if (state.phase === "work" && !skipAnimation) {
      soundSetComplete();
      showPhaseEndAnimation("Set complete", "set-complete", function () {
        switchPhase();
        if (state.running) {
          state.intervalId = setInterval(tick, 1000);
        }
      });
      return;
    }
    if (state.phase === "rest" && !skipAnimation) {
      soundBeginWork();
      showPhaseEndAnimation("Work!", "work", function () {
        switchPhase();
        if (state.running) {
          state.intervalId = setInterval(tick, 1000);
        }
      });
      return;
    }
    switchPhase();
    if (state.running) {
      state.intervalId = setInterval(tick, 1000);
    }
  }

  function syncTimerFromTimestamp() {
    if (!state.running) return;
    if (phaseEndTimeoutId) return;
    while (state.running && state.phaseEndTimestamp && Date.now() >= state.phaseEndTimestamp) {
      processPhaseEnd(true);
      if (!state.running) return;
    }
    if (state.running) {
      state.remainingSeconds = Math.max(0, Math.ceil((state.phaseEndTimestamp - Date.now()) / 1000));
      if (state.phase === "prep") {
        setTimerValue(String(state.remainingSeconds));
      } else {
        setTimerValue(formatTime(state.remainingSeconds));
      }
      updateProgressRing();
      saveSessionState();
    }
  }

  function updateProgressRing() {
    const total = getPhaseTotalSeconds();
    const p = total > 0 ? state.remainingSeconds / total : 0;
    dom.timerDisplay.style.setProperty("--progress", String(p));
  }

  function setPhase(phase) {
    state.phase = phase;
    if (phase === "prep") {
      state.remainingSeconds = PREP_SECONDS;
      dom.phaseBadge.textContent = "Get ready";
      dom.phaseBadge.className = "phase-badge prep";
      dom.timerDisplay.className = "timer-display prep";
      dom.timerValue.classList.remove("done-text");
      setTimerValue(String(PREP_SECONDS));
    } else {
      state.remainingSeconds = phase === "work" ? state.workSeconds : state.restSeconds;
      dom.phaseBadge.textContent = phase === "work" ? "Work" : "Rest";
      dom.phaseBadge.className = "phase-badge " + phase;
      dom.timerDisplay.className = "timer-display " + phase;
      dom.timerValue.classList.remove("done-text");
      setTimerValue(formatTime(state.remainingSeconds));
    }
    setPhaseEndTimestamp();
    dom.timerDisplay.classList.remove("done");
    updateProgressRing();
    saveSessionState();
  }

  const PHASE_END_DURATION_MS = 1200;
  let phaseEndTimeoutId = null;

  function clearPhaseEndAnimation() {
    if (phaseEndTimeoutId) {
      clearTimeout(phaseEndTimeoutId);
      phaseEndTimeoutId = null;
    }
    dom.timerValue.classList.remove("timer-value--phase-end");
    dom.timerValue.removeAttribute("data-phase-end");
    dom.timerDisplay.classList.remove("timer-display--phase-end");
  }

  function showPhaseEndAnimation(message, dataPhaseEnd, onComplete) {
    clearPhaseEndAnimation();
    dom.timerValue.textContent = message;
    dom.timerValue.removeAttribute("data-digits");
    dom.timerValue.classList.add("timer-value--phase-end");
    dom.timerValue.setAttribute("data-phase-end", dataPhaseEnd);
    dom.timerDisplay.classList.add("timer-display--phase-end");
    dom.timerDisplay.style.setProperty("--progress", "0");
    phaseEndTimeoutId = setTimeout(function () {
      phaseEndTimeoutId = null;
      dom.timerValue.classList.remove("timer-value--phase-end");
      dom.timerValue.removeAttribute("data-phase-end");
      dom.timerDisplay.classList.remove("timer-display--phase-end");
      onComplete();
    }, PHASE_END_DURATION_MS);
  }

  function tick() {
    state.remainingSeconds = Math.max(0, Math.ceil((state.phaseEndTimestamp - Date.now()) / 1000));
    if (state.remainingSeconds <= 0) {
      processPhaseEnd(false);
      return;
    }
    if (state.phase === "prep") {
      soundPrepTick();
      setTimerValue(String(state.remainingSeconds));
    } else {
      if ((state.phase === "work" || state.phase === "rest") && state.remainingSeconds >= 1 && state.remainingSeconds <= 3) {
        soundCountdownTick();
      }
      setTimerValue(formatTime(state.remainingSeconds));
    }
    updateProgressRing();
    saveSessionState();
  }

  let audioCtx = null;
  const SOUND_VOLUME = 2.8;
  const VOL_MAIN = 0.22;     // all sounds

  function getAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration, volume, startTime) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = startTime != null ? startTime : ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    const v = Math.min(1, volume * SOUND_VOLUME);
    gain.gain.setValueAtTime(v, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  }

  function soundPrepTick() {
    try {
      playTone(600, 0.08, VOL_MAIN);
    } catch (_) {}
  }

  function soundWorkStart() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(523, 0.12, VOL_MAIN, t);
      playTone(659, 0.2, VOL_MAIN, t + 0.15);
    } catch (_) {}
  }

  function soundBeginWork() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(523, 0.1, VOL_MAIN, t);
      playTone(784, 0.22, VOL_MAIN, t + 0.12);
    } catch (_) {}
  }

  function soundRest() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(440, 0.15, VOL_MAIN, t);
      playTone(349, 0.2, VOL_MAIN, t + 0.18);
    } catch (_) {}
  }

  function soundDone() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(523, 0.15, VOL_MAIN, t);
      playTone(659, 0.15, VOL_MAIN, t + 0.2);
      playTone(784, 0.25, VOL_MAIN, t + 0.4);
    } catch (_) {}
  }

  function soundCountdownTick() {
    try {
      playTone(600, 0.08, VOL_MAIN);
    } catch (_) {}
  }

  function soundSetComplete() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(523, 0.12, VOL_MAIN, t);
      playTone(659, 0.14, VOL_MAIN, t + 0.14);
      playTone(784, 0.2, VOL_MAIN, t + 0.3);
    } catch (_) {}
  }

  function haptic() {
    if (typeof navigator.vibrate === "function") navigator.vibrate(50);
  }

  function renderSetDots() {
    const total = state.totalSets;
    const filled = state.workPhasesCompleted; // mark when work phase ends, not rest
    dom.setDots.innerHTML = "";
    dom.setDots.setAttribute("aria-label", state.setsRemaining <= 0 ? "All sets complete" : "Set " + state.setsRemaining + " of " + total);
    for (let i = 0; i < total; i++) {
      const dot = document.createElement("span");
      dot.className = "set-dot" + (i < filled ? " filled" : "");
      dot.setAttribute("aria-hidden", "true");
      dom.setDots.appendChild(dot);
    }
  }

  function updateSetDisplay() {
    renderSetDots();
    if (state.setsRemaining <= 0) {
      dom.timerDisplay.classList.add("done");
      setTimerValue("Done!");
      dom.timerValue.classList.add("done-text");
      dom.timerDisplay.style.setProperty("--progress", "0");
      dom.btnStart.textContent = "Again";
      dom.btnStart.setAttribute("aria-label", "Start another round");
      dom.timerDisplayBtn.setAttribute("aria-label", "Start another round");
      dom.btnStart.classList.remove("btn-primary");
      dom.btnStart.classList.add("btn-secondary");
      dom.btnReset.textContent = "Done";
      dom.btnReset.setAttribute("aria-label", "Go back to settings");
      dom.btnReset.classList.remove("btn-secondary");
      dom.btnReset.classList.add("btn-primary");
      dom.timerActions.classList.add("done");
    }
  }

  function stopTimer() {
    clearPhaseEndAnimation();
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = null;
    state.running = false;
    releaseWakeLock();
    dom.btnStart.textContent = "Start";
    dom.btnStart.setAttribute("aria-label", "Start timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Start timer");
    dom.btnStart.classList.remove("running");
    saveSessionState();
  }

  function switchPhase() {
    const next = state.phase === "work" ? "rest" : "work";
    if (next === "rest") {
      state.workPhasesCompleted += 1;
    }
    if (next === "work") {
      state.restPhasesCompleted += 1;
      state.setsRemaining -= 1;
      if (state.setsRemaining <= 0) {
        saveCompletion(state.totalSets, state.totalSets, true);
        stopTimer();
        updateSetDisplay();
        soundDone();
        haptic();
        return;
      }
    }
    setPhase(next);
    updateSetDisplay();
    haptic();
  }

  function getPhaseLabel() {
    if (state.phase === "prep") return "Get ready";
    if (state.phase === "work") return "Work";
    if (state.phase === "rest") return "Rest";
    return "Work";
  }

  function applyPausedUI(paused) {
    if (paused) {
      dom.phaseBadge.textContent = "Paused";
      dom.phaseBadge.className = "phase-badge paused";
      dom.timerDisplay.classList.add("paused");
    } else {
      dom.phaseBadge.textContent = getPhaseLabel();
      dom.phaseBadge.className = "phase-badge " + state.phase;
      dom.timerDisplay.classList.remove("paused");
    }
  }

  function pauseTimer() {
    if (!state.running) return;
    if (phaseEndTimeoutId) {
      clearPhaseEndAnimation();
      switchPhase();
    }
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.running = false;
    releaseWakeLock();
    haptic();
    applyPausedUI(true);
    dom.btnStart.textContent = "Resume";
    dom.btnStart.setAttribute("aria-label", "Resume timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Resume timer");
    dom.btnStart.classList.remove("running");
    saveSessionState();
  }

  function resumeTimer() {
    if (state.running) return;
    state.running = true;
    setPhaseEndTimestamp();
    requestWakeLock();
    applyPausedUI(false);
    dom.btnStart.textContent = "Pause";
    dom.btnStart.setAttribute("aria-label", "Pause timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Pause timer");
    dom.btnStart.classList.add("running");
    state.intervalId = setInterval(tick, 1000);
    saveSessionState();
  }

  function startWorkout() {
    state.workPhasesCompleted = 0;
    state.restPhasesCompleted = 0;
    state.setsRemaining = state.totalSets;
    goToTimer();
    state.running = true;
    requestWakeLock();
    dom.btnStart.textContent = "Pause";
    dom.btnStart.setAttribute("aria-label", "Pause timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Pause timer");
    dom.btnStart.classList.add("running");
    dom.btnReset.textContent = "Hold to reset";
    dom.btnReset.setAttribute("aria-label", "Hold for 1 second to reset and go back");
    dom.btnReset.classList.remove("btn-primary");
    dom.btnReset.classList.add("btn-secondary");
    dom.btnStart.classList.remove("btn-secondary");
    dom.btnStart.classList.add("btn-primary");
    dom.timerActions.classList.remove("done");
    setPhase("prep");
    soundPrepTick();
    state.intervalId = setInterval(tick, 1000);
    saveSessionState();
  }

  function startStop() {
    if (state.running) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  }

  function reset() {
    saveSessionIfAny();
    releaseWakeLock();
    clearPhaseEndAnimation();
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    state.running = false;
    state.setsRemaining = state.totalSets;
    state.workPhasesCompleted = 0;
    state.restPhasesCompleted = 0;
    state.phase = "work";
    state.remainingSeconds = state.workSeconds;
    state.selectedWorkoutPreset = null;
    syncCustomInputs();
    dom.btnStart.textContent = "Start";
    dom.btnStart.setAttribute("aria-label", "Start timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Start timer");
    dom.btnStart.classList.remove("running");
    dom.timerDisplay.classList.remove("paused");
    setPhase("work");
    updateSetDisplay();
    showView("settings");
    clearSessionState();
  }

  const MIN_SECONDS = 1;
  const MAX_SECONDS = 600;

  function applyPreset(target, seconds) {
    if (state.running) return;
    state.selectedWorkoutPreset = null;
    const clamped = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, seconds));
    if (target === "work") {
      state.workSeconds = clamped;
      if (state.phase === "work") state.remainingSeconds = clamped;
    } else {
      state.restSeconds = clamped;
      if (state.phase === "rest") state.remainingSeconds = clamped;
    }
    setTimerValue(formatTime(state.remainingSeconds));
    syncPresetActiveStates();
    syncCustomInputs();
    saveSessionState();
  }

  function applySets(total) {
    if (state.running) return;
    state.totalSets = total;
    state.setsRemaining = total;
    state.selectedWorkoutPreset = null;
    updateSetDisplay();
    syncPresetActiveStates();
    saveSessionState();
  }

  function applyWorkoutPreset(sets, workSeconds, restSeconds, presetId) {
    if (state.running) return;
    state.totalSets = sets;
    state.setsRemaining = sets;
    state.workSeconds = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, workSeconds));
    state.restSeconds = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, restSeconds));
    state.selectedWorkoutPreset = presetId != null ? presetId : null;
    if (state.phase === "work") state.remainingSeconds = state.workSeconds;
    if (state.phase === "rest") state.remainingSeconds = state.restSeconds;
    setTimerValue(formatTime(state.remainingSeconds));
    updateSetDisplay();
    syncPresetActiveStates();
    syncCustomInputs();
    saveSessionState();
  }

  function syncPresetActiveStates() {
    dom.setBtns.forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.dataset.sets, 10) === state.totalSets);
    });
    dom.presetBtns.forEach((btn) => {
      const isWork = btn.dataset.target === "work";
      const isRest = btn.dataset.target === "rest";
      const val = parseInt(btn.dataset.seconds, 10);
      const match = (isWork && state.workSeconds === val) || (isRest && state.restSeconds === val);
      btn.classList.toggle("active", !!match);
    });
    dom.workoutPresetBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === state.selectedWorkoutPreset);
    });
  }

  function syncCustomInputs() {
    if (dom.customWork && document.activeElement !== dom.customWork) {
      dom.customWork.value = formatTimeForInput(state.workSeconds);
    }
    if (dom.customRest && document.activeElement !== dom.customRest) {
      dom.customRest.value = formatTimeForInput(state.restSeconds);
    }
  }

  function applyCustomTime(target, seconds) {
    if (state.running) return;
    const val = parseTimeInput(String(seconds));
    if (val == null) return;
    applyPreset(target, val);
  }

  function onTimerDisplayClick() {
    if (state.setsRemaining <= 0) return;
    startStop();
  }

  // Initial UI
  renderWorkoutPresetIcons();
  const restoredSession = restoreSessionState();
  if (!restoredSession) {
    setPhase("work");
    updateSetDisplay();
  } else {
    goToTimer();
    updateSetDisplay();
  }
  syncPresetActiveStates();
  syncCustomInputs();
  renderCompletions();

  const RESET_HOLD_MS = 1200;
  let resetHoldTimer = null;
  let resetHoldPointerId = null;

  function clearResetHold(pointerId) {
    if (pointerId != null && resetHoldPointerId != null && pointerId !== resetHoldPointerId) return;
    if (resetHoldTimer) {
      clearTimeout(resetHoldTimer);
      resetHoldTimer = null;
    }
    if (resetHoldPointerId != null) {
      try {
        if (dom.btnReset.hasPointerCapture(resetHoldPointerId)) {
          dom.btnReset.releasePointerCapture(resetHoldPointerId);
        }
      } catch (_) {}
      resetHoldPointerId = null;
    }
    dom.btnReset.classList.remove("holding");
  }

  dom.btnStartWorkout.addEventListener("click", function () {
    haptic();
    startWorkout();
  });
  dom.btnStart.addEventListener("click", function () {
    haptic();
    if (state.setsRemaining <= 0 && !state.running) {
      startWorkout();
    } else {
      startStop();
    }
  });
  dom.btnReset.addEventListener("click", function () {
    if (state.setsRemaining <= 0 && !state.running) {
      haptic();
      goToSettings(true);
    }
  });
  dom.btnReset.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    if (state.setsRemaining <= 0 && !state.running) return;
    if (resetHoldPointerId != null) return;
    haptic();
    clearResetHold();
    resetHoldPointerId = e.pointerId;
    try {
      dom.btnReset.setPointerCapture(e.pointerId);
    } catch (_) {}
    dom.btnReset.classList.add("holding");
    resetHoldTimer = setTimeout(function () {
      clearResetHold();
      reset();
    }, RESET_HOLD_MS);
  });
  dom.btnReset.addEventListener("pointerup", function (e) {
    clearResetHold(e.pointerId);
  });
  dom.btnReset.addEventListener("pointercancel", function (e) {
    clearResetHold(e.pointerId);
  });
  dom.btnReset.addEventListener("lostpointercapture", function (e) {
    clearResetHold(e.pointerId);
  });
  dom.btnReset.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
  dom.timerDisplayBtn.addEventListener("click", function () {
    haptic();
    onTimerDisplayClick();
  });
  dom.presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      haptic();
      applyPreset(btn.dataset.target, parseInt(btn.dataset.seconds, 10));
    });
  });
  dom.setBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      haptic();
      applySets(parseInt(btn.dataset.sets, 10));
    });
  });
  dom.workoutPresetBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      haptic();
      applyWorkoutPreset(
        parseInt(btn.dataset.sets, 10),
        parseInt(btn.dataset.work, 10),
        parseInt(btn.dataset.rest, 10),
        btn.dataset.preset
      );
    });
  });

  function handleCustomTimeInput(inputEl, target) {
    const val = parseTimeInput(inputEl.value);
    if (val != null) {
      applyCustomTime(target, val);
      haptic();
    } else if (inputEl.value.trim() !== "") {
      syncCustomInputs();
    }
  }

  if (dom.customWork) {
    dom.customWork.addEventListener("blur", function () {
      handleCustomTimeInput(dom.customWork, "work");
    });
    dom.customWork.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        dom.customWork.blur();
      }
    });
  }
  if (dom.customRest) {
    dom.customRest.addEventListener("blur", function () {
      handleCustomTimeInput(dom.customRest, "rest");
    });
    dom.customRest.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        dom.customRest.blur();
      }
    });
  }
  dom.btnClearHistory.addEventListener("click", function () {
    haptic();
    clearHistory();
  });
  dom.btnViewHistory.addEventListener("click", function () {
    haptic();
    goToHistory();
  });
  dom.btnBackHistory.addEventListener("click", function () {
    haptic();
    goToSettings();
  });

  document.addEventListener("visibilitychange", function () {
    if (state.running) {
      if (document.visibilityState === "visible") {
        requestWakeLock();
        syncTimerFromTimestamp();
      } else {
        saveSessionState();
      }
    }
  });

  window.addEventListener("pageshow", function () {
    if (state.running) {
      syncTimerFromTimestamp();
      if (!state.intervalId) state.intervalId = setInterval(tick, 1000);
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () {});
  }
})();
