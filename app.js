/**
 * Gymmer – Work / Rest timer
 * Counts down work phase, then rest phase, and repeats until stopped.
 */

(function () {
  "use strict";

  const PREP_SECONDS = 3;
  const STORAGE_KEY = "gymmer_completions";
  const MAX_COMPLETIONS = 50;

  const state = {
    workSeconds: 30,
    restSeconds: 60,
    totalSets: 5,
    setsRemaining: 5,
    workPhasesCompleted: 0,
    restPhasesCompleted: 0,
    phase: "work",
    remainingSeconds: 30,
    running: false,
    intervalId: null,
  };

  const dom = {
    viewSettings: document.getElementById("view-settings"),
    viewTimer: document.getElementById("view-timer"),
    setDots: document.getElementById("set-dots"),
    phaseBadge: document.getElementById("phase-badge"),
    timerValue: document.getElementById("timer-value"),
    timerDisplay: document.getElementById("timer-display"),
    timerDisplayBtn: document.getElementById("timer-display-btn"),
    btnStartWorkout: document.getElementById("btn-start-workout"),
    btnSettings: document.getElementById("btn-settings"),
    btnStart: document.getElementById("btn-start"),
    btnReset: document.getElementById("btn-reset"),
    presetBtns: document.querySelectorAll(".preset-btn[data-target]"),
    setBtns: document.querySelectorAll(".preset-btn-sets"),
    workoutPresetBtns: document.querySelectorAll(".preset-btn-workout"),
    completionsList: document.getElementById("completions-list"),
    btnClearHistory: document.getElementById("btn-clear-history"),
  };

  function showView(name) {
    const isTimer = name === "timer";
    dom.viewSettings.classList.toggle("hidden", isTimer);
    dom.viewTimer.classList.toggle("hidden", !isTimer);
  }

  function goToSettings() {
    if (state.running) pauseTimer();
    saveSessionIfAny();
    showView("settings");
  }

  function goToTimer() {
    showView("timer");
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

  function saveCompletion(completedWork, completedRest, full) {
    const list = getCompletions();
    list.unshift({
      date: new Date().toISOString(),
      workSeconds: state.workSeconds,
      restSeconds: state.restSeconds,
      completedWork: completedWork,
      completedRest: completedRest,
      totalSets: state.totalSets,
      full: !!full,
    });
    saveCompletions(list.slice(0, MAX_COMPLETIONS));
    renderCompletions();
  }

  function saveSessionIfAny() {
    const w = state.workPhasesCompleted;
    const r = state.restPhasesCompleted;
    if (w > 0 || r > 0) saveCompletion(w, r, false);
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
      li.textContent = "No completions yet";
      dom.completionsList.appendChild(li);
    } else {
      list.forEach(function (entry) {
        const d = new Date(entry.date);
        const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
        const workStr = formatDuration(entry.workSeconds);
        const restStr = formatDuration(entry.restSeconds);
        const w = entry.completedWork != null ? entry.completedWork : entry.sets;
        const r = entry.completedRest != null ? entry.completedRest : entry.sets;
        const summary = (entry.full || (entry.completedWork == null && entry.sets != null))
          ? w + " sets"
          : w + " work, " + r + " rest";
        const li = document.createElement("li");
        li.className = "completion-item";
        li.textContent = summary + " · " + workStr + " work · " + restStr + " rest · " + dateStr;
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

  function getPhaseTotalSeconds() {
    if (state.phase === "prep") return PREP_SECONDS;
    return state.phase === "work" ? state.workSeconds : state.restSeconds;
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
      dom.timerValue.textContent = String(PREP_SECONDS);
      dom.timerValue.classList.remove("done-text");
    } else {
      state.remainingSeconds = phase === "work" ? state.workSeconds : state.restSeconds;
      dom.phaseBadge.textContent = phase === "work" ? "Work" : "Rest";
      dom.phaseBadge.className = "phase-badge " + phase;
      dom.timerDisplay.className = "timer-display " + phase;
      dom.timerValue.textContent = formatTime(state.remainingSeconds);
      dom.timerValue.classList.remove("done-text");
    }
    dom.timerDisplay.classList.remove("done");
    updateProgressRing();
  }

  function tick() {
    if (state.remainingSeconds <= 0) {
      if (state.phase === "prep") {
        setPhase("work");
        updateProgressRing();
        soundWorkStart();
        haptic();
        return;
      }
      switchPhase();
      return;
    }
    state.remainingSeconds -= 1;
    if (state.phase === "prep") {
      soundPrepTick();
      dom.timerValue.textContent = String(state.remainingSeconds);
    } else {
      dom.timerValue.textContent = formatTime(state.remainingSeconds);
    }
    updateProgressRing();
  }

  let audioCtx = null;

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
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  }

  function soundPrepTick() {
    try {
      playTone(600, 0.08, 0.15);
    } catch (_) {}
  }

  function soundWorkStart() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(523, 0.12, 0.2, t);
      playTone(659, 0.2, 0.2, t + 0.15);
    } catch (_) {}
  }

  function soundRest() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(440, 0.15, 0.2, t);
      playTone(349, 0.2, 0.18, t + 0.18);
    } catch (_) {}
  }

  function soundWork() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(523, 0.1, 0.2, t);
      playTone(523, 0.1, 0.2, t + 0.12);
    } catch (_) {}
  }

  function soundDone() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      playTone(523, 0.15, 0.22, t);
      playTone(659, 0.15, 0.22, t + 0.2);
      playTone(784, 0.25, 0.22, t + 0.4);
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
      dom.timerValue.textContent = "Done!";
      dom.timerValue.classList.add("done-text");
      dom.timerDisplay.style.setProperty("--progress", "0");
    }
  }

  function stopTimer() {
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = null;
    state.running = false;
    dom.btnStart.textContent = "Start";
    dom.btnStart.setAttribute("aria-label", "Start timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Start timer");
    dom.btnStart.classList.remove("running");
  }

  function switchPhase() {
    const next = state.phase === "work" ? "rest" : "work";
    if (next === "rest") {
      state.workPhasesCompleted += 1;
      soundRest();
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
      soundWork();
    }
    setPhase(next);
    updateSetDisplay();
    haptic();
  }

  function pauseTimer() {
    if (!state.running) return;
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.running = false;
    dom.btnStart.textContent = "Start";
    dom.btnStart.setAttribute("aria-label", "Start timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Start timer");
    dom.btnStart.classList.remove("running");
  }

  function resumeTimer() {
    if (state.running) return;
    state.running = true;
    dom.btnStart.textContent = "Pause";
    dom.btnStart.setAttribute("aria-label", "Pause timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Pause timer");
    dom.btnStart.classList.add("running");
    state.intervalId = setInterval(tick, 1000);
  }

  function startWorkout() {
    state.workPhasesCompleted = 0;
    state.restPhasesCompleted = 0;
    goToTimer();
    state.running = true;
    dom.btnStart.textContent = "Pause";
    dom.btnStart.setAttribute("aria-label", "Pause timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Pause timer");
    dom.btnStart.classList.add("running");
    setPhase("prep");
    soundPrepTick();
    state.intervalId = setInterval(tick, 1000);
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
    dom.btnStart.textContent = "Start";
    dom.btnStart.setAttribute("aria-label", "Start timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Start timer");
    dom.btnStart.classList.remove("running");
    setPhase("work");
    updateSetDisplay();
  }

  function applyPreset(target, seconds) {
    if (state.running) return;
    if (target === "work") {
      state.workSeconds = seconds;
      if (state.phase === "work") state.remainingSeconds = seconds;
    } else {
      state.restSeconds = seconds;
      if (state.phase === "rest") state.remainingSeconds = seconds;
    }
    dom.timerValue.textContent = formatTime(state.remainingSeconds);
    syncPresetActiveStates();
  }

  function applySets(total) {
    if (state.running) return;
    state.totalSets = total;
    state.setsRemaining = total;
    updateSetDisplay();
    syncPresetActiveStates();
  }

  function applyWorkoutPreset(sets, workSeconds, restSeconds) {
    if (state.running) return;
    state.totalSets = sets;
    state.setsRemaining = sets;
    state.workSeconds = workSeconds;
    state.restSeconds = restSeconds;
    if (state.phase === "work") state.remainingSeconds = workSeconds;
    if (state.phase === "rest") state.remainingSeconds = restSeconds;
    dom.timerValue.textContent = formatTime(state.remainingSeconds);
    updateSetDisplay();
    syncPresetActiveStates();
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
      const match =
        parseInt(btn.dataset.sets, 10) === state.totalSets &&
        parseInt(btn.dataset.work, 10) === state.workSeconds &&
        parseInt(btn.dataset.rest, 10) === state.restSeconds;
      btn.classList.toggle("active", !!match);
    });
  }

  function onTimerDisplayClick() {
    if (state.setsRemaining <= 0) return;
    startStop();
  }

  // Initial UI
  setPhase("work");
  updateSetDisplay();
  renderCompletions();
  syncPresetActiveStates();

  const RESET_HOLD_MS = 800;
  let resetHoldTimer = null;

  function clearResetHold() {
    if (resetHoldTimer) {
      clearTimeout(resetHoldTimer);
      resetHoldTimer = null;
    }
    dom.btnReset.classList.remove("holding");
  }

  dom.btnStartWorkout.addEventListener("click", startWorkout);
  dom.btnSettings.addEventListener("click", goToSettings);
  dom.btnStart.addEventListener("click", startStop);
  dom.btnReset.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    clearResetHold();
    dom.btnReset.classList.add("holding");
    resetHoldTimer = setTimeout(function () {
      resetHoldTimer = null;
      dom.btnReset.classList.remove("holding");
      reset();
    }, RESET_HOLD_MS);
  });
  dom.btnReset.addEventListener("pointerup", clearResetHold);
  dom.btnReset.addEventListener("pointercancel", clearResetHold);
  dom.btnReset.addEventListener("pointerleave", clearResetHold);
  dom.timerDisplayBtn.addEventListener("click", onTimerDisplayClick);
  dom.presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => applyPreset(btn.dataset.target, parseInt(btn.dataset.seconds, 10)));
  });
  dom.setBtns.forEach((btn) => {
    btn.addEventListener("click", () => applySets(parseInt(btn.dataset.sets, 10)));
  });
  dom.workoutPresetBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      applyWorkoutPreset(
        parseInt(btn.dataset.sets, 10),
        parseInt(btn.dataset.work, 10),
        parseInt(btn.dataset.rest, 10)
      );
    });
  });
  dom.btnClearHistory.addEventListener("click", clearHistory);
})();
