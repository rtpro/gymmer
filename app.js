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
  const SESSION_GROUP_WINDOW_MS = 90 * 60 * 1000;
  const HISTORY_DEDUPE_MIGRATION_KEY = "gymmer_history_dedupe_v1_done";

  const BODY_PART_META = {
    chest: { label: "Chest", icon: "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"3.8\" r=\"1.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M9 7.2c.6-.7 1.8-1.1 3-1.1s2.4.4 3 1.1l.6 1.4c.4.9.4 2 .1 2.9l-1 2.5v6.2h-2v-4h-1.4v4h-2V14l-1-2.5c-.3-.9-.3-2 .1-2.9z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".9\"/><rect x=\"9.7\" y=\"7.9\" width=\"4.6\" height=\"2.7\" rx=\".7\" fill=\"currentColor\"/></svg>" },
    arms: { label: "Arms", icon: "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"3.8\" r=\"1.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M9 7.2c.6-.7 1.8-1.1 3-1.1s2.4.4 3 1.1l.6 1.4c.4.9.4 2 .1 2.9l-1 2.5v6.2h-2v-4h-1.4v4h-2V14l-1-2.5c-.3-.9-.3-2 .1-2.9z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".9\"/><rect x=\"5.8\" y=\"8.2\" width=\"2.1\" height=\"6.2\" rx=\"1\" fill=\"currentColor\"/><rect x=\"16.1\" y=\"8.2\" width=\"2.1\" height=\"6.2\" rx=\"1\" fill=\"currentColor\"/></svg>" },
    abs: { label: "Abs", icon: "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"3.8\" r=\"1.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M9 7.2c.6-.7 1.8-1.1 3-1.1s2.4.4 3 1.1l.6 1.4c.4.9.4 2 .1 2.9l-1 2.5v6.2h-2v-4h-1.4v4h-2V14l-1-2.5c-.3-.9-.3-2 .1-2.9z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".9\"/><rect x=\"10.1\" y=\"10.5\" width=\"3.8\" height=\"4.2\" rx=\".8\" fill=\"currentColor\"/></svg>" },
    back: { label: "Back", icon: "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"3.8\" r=\"1.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M9 7.2c.6-.7 1.8-1.1 3-1.1s2.4.4 3 1.1l.6 1.4c.4.9.4 2 .1 2.9l-1 2.5v6.2h-2v-4h-1.4v4h-2V14l-1-2.5c-.3-.9-.3-2 .1-2.9z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".9\"/><rect x=\"9.8\" y=\"8.2\" width=\"4.4\" height=\"7.8\" rx=\"1\" fill=\"currentColor\"/></svg>" },
    legs: { label: "Legs", icon: "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"3.8\" r=\"1.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M9 7.2c.6-.7 1.8-1.1 3-1.1s2.4.4 3 1.1l.6 1.4c.4.9.4 2 .1 2.9l-1 2.5v6.2h-2v-4h-1.4v4h-2V14l-1-2.5c-.3-.9-.3-2 .1-2.9z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".9\"/><rect x=\"9.4\" y=\"15.2\" width=\"1.9\" height=\"4.3\" rx=\".8\" fill=\"currentColor\"/><rect x=\"12.7\" y=\"15.2\" width=\"1.9\" height=\"4.3\" rx=\".8\" fill=\"currentColor\"/></svg>" },
    delts: { label: "Delts", icon: "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"3.8\" r=\"1.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M9 7.2c.6-.7 1.8-1.1 3-1.1s2.4.4 3 1.1l.6 1.4c.4.9.4 2 .1 2.9l-1 2.5v6.2h-2v-4h-1.4v4h-2V14l-1-2.5c-.3-.9-.3-2 .1-2.9z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".9\"/><circle cx=\"9.1\" cy=\"8.1\" r=\"1.1\" fill=\"currentColor\"/><circle cx=\"14.9\" cy=\"8.1\" r=\"1.1\" fill=\"currentColor\"/></svg>" },
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
    historyFilter: "all",
    historyBodyFilter: "all",
    historyMode: "session",
  };

  let wakeLockSentinel = null;
  const TIMER_NOTIFICATION_TAG = "gymmer-timer";
  const TIMER_NOTIFICATION_UPDATE_MS = 5000;
  let lastTimerNotificationKey = "";
  let lastTimerNotificationAt = 0;

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

  function canUseTimerNotifications() {
    return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  }

  async function ensureTimerNotificationPermission() {
    if (!canUseTimerNotifications()) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "default") return false;
    try {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    } catch (_) {
      return false;
    }
  }

  function getCurrentSetIndex() {
    const completed = state.totalSets - state.setsRemaining;
    return Math.min(state.totalSets, completed + 1);
  }

  function getTimerNotificationText() {
    if (state.setsRemaining <= 0) return "Done";
    const phaseLabel = state.phase === "prep" ? "Get ready" : state.phase === "work" ? "Work" : "Rest";
    const timeText = state.phase === "prep" ? String(state.remainingSeconds) + "s" : formatTime(state.remainingSeconds);
    return phaseLabel + " • " + timeText + " left • Set " + getCurrentSetIndex() + "/" + state.totalSets;
  }

  async function closeTimerNotification() {
    if (!canUseTimerNotifications()) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      const existing = await reg.getNotifications({ tag: TIMER_NOTIFICATION_TAG });
      existing.forEach(function (n) {
        try { n.close(); } catch (_) {}
      });
      lastTimerNotificationKey = "";
      lastTimerNotificationAt = 0;
    } catch (_) {}
  }

  async function updateTimerNotification(force) {
    if (!state.running || state.setsRemaining <= 0) {
      closeTimerNotification();
      return;
    }
    const now = Date.now();
    if (!force && now - lastTimerNotificationAt < TIMER_NOTIFICATION_UPDATE_MS) return;
    const allowed = await ensureTimerNotificationPermission();
    if (!allowed) return;
    const text = getTimerNotificationText();
    const key = text;
    if (!force && key === lastTimerNotificationKey) {
      lastTimerNotificationAt = now;
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      await reg.showNotification("Gymmer timer", {
        body: text,
        tag: TIMER_NOTIFICATION_TAG,
        renotify: false,
        requireInteraction: true,
        silent: true,
        data: { url: "./" },
      });
      lastTimerNotificationKey = key;
      lastTimerNotificationAt = now;
    } catch (_) {}
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
    presetStatus: document.getElementById("preset-status"),
    timerMuscleGroup: document.getElementById("timer-muscle-group"),
    customWork: document.getElementById("custom-work"),
    customRest: document.getElementById("custom-rest"),
    completionsList: document.getElementById("completions-list"),
    historyInsights: document.getElementById("history-insights"),
    historyModeBtns: document.querySelectorAll(".history-mode-btn"),
    historyFilterBtns: document.querySelectorAll(".history-filter-btn"),
    historyBodyFilters: document.getElementById("history-body-filters"),
    btnClearHistory: document.getElementById("btn-clear-history"),
    btnViewHistory: document.getElementById("btn-view-history"),
    btnBackHistory: document.getElementById("btn-back-history"),
    btnBackHistoryBottom: document.getElementById("btn-back-history-bottom"),
  };

  function showView(name) {
    const isSettings = name === "settings";
    const isTimer = name === "timer";
    const isHistory = name === "history";
    dom.viewSettings.classList.toggle("hidden", !isSettings);
    dom.viewTimer.classList.toggle("hidden", !isTimer);
    dom.viewHistory.classList.toggle("hidden", !isHistory);
    document.body.classList.toggle("timer-mode", isTimer);
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
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];

      // One-time historical normalization:
      // If all work sets were completed, treat entry as Full even when the
      // final rest was cut short.
      let changed = false;
      const normalized = list.map(function (entry) {
        if (!entry || typeof entry !== "object") return entry;
        const total = entry.totalSets != null ? entry.totalSets : entry.sets;
        const completedWork = entry.completedWork != null ? entry.completedWork : total;
        if (total == null || completedWork == null) return entry;
        if (completedWork >= total && entry.full !== true) {
          changed = true;
          return Object.assign({}, entry, { full: true });
        }
        return entry;
      });

      // One-time cleanup for historical duplicate full logs caused by the
      // prior done/reset double-save path.
      let dedupeRan = false;
      try {
        dedupeRan = localStorage.getItem(HISTORY_DEDUPE_MIGRATION_KEY) === "1";
      } catch (_) {}

      let cleaned = normalized;
      if (!dedupeRan) {
        const dedupeWindowMs = 10 * 60 * 1000;
        const result = [];
        normalized.forEach(function (entry) {
          if (!entry || typeof entry !== "object") return;
          const total = entry.totalSets != null ? entry.totalSets : entry.sets;
          const completedWork = entry.completedWork != null ? entry.completedWork : total;
          const completedRest = entry.completedRest != null ? entry.completedRest : completedWork;
          const ts = new Date(entry.date).getTime();
          const prev = result.length ? result[result.length - 1] : null;

          let isDuplicate = false;
          if (prev && prev.full === true && entry.full === true) {
            const prevTotal = prev.totalSets != null ? prev.totalSets : prev.sets;
            const prevCompletedWork = prev.completedWork != null ? prev.completedWork : prevTotal;
            const prevCompletedRest = prev.completedRest != null ? prev.completedRest : prevCompletedWork;
            const prevTs = new Date(prev.date).getTime();
            const closeInTime = !isNaN(ts) && !isNaN(prevTs) && Math.abs(prevTs - ts) <= dedupeWindowMs;
            const sameShape =
              prev.workSeconds === entry.workSeconds &&
              prev.restSeconds === entry.restSeconds &&
              prevTotal === total &&
              prevCompletedWork === completedWork &&
              prevCompletedRest === completedRest &&
              (prev.workoutPreset || "") === (entry.workoutPreset || "") &&
              (prev.bodyPart || "") === (entry.bodyPart || "");
            isDuplicate = closeInTime && sameShape;
          }

          if (!isDuplicate) {
            result.push(entry);
          } else {
            changed = true;
          }
        });
        cleaned = result;
        try {
          localStorage.setItem(HISTORY_DEDUPE_MIGRATION_KEY, "1");
        } catch (_) {}
      }

      if (changed) saveCompletions(cleaned);
      return cleaned;
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

  function isSelectedWorkoutPresetModified() {
    if (!state.selectedWorkoutPreset) return false;
    const selectedBtn = Array.from(dom.workoutPresetBtns).find(function (btn) {
      return btn.dataset.preset === state.selectedWorkoutPreset;
    });
    if (!selectedBtn) return false;
    return (
      parseInt(selectedBtn.dataset.sets, 10) !== state.totalSets ||
      parseInt(selectedBtn.dataset.work, 10) !== state.workSeconds ||
      parseInt(selectedBtn.dataset.rest, 10) !== state.restSeconds
    );
  }

  function renderWorkoutPresetStatus() {
    if (!dom.presetStatus) return;
    if (!state.selectedWorkoutPreset) {
      dom.presetStatus.textContent = "Preset: Custom";
      return;
    }
    const meta = getBodyPartMeta(state.selectedWorkoutPreset);
    const modifiedSuffix = isSelectedWorkoutPresetModified() ? " (modified)" : "";
    dom.presetStatus.textContent = "Preset: " + meta.label + modifiedSuffix;
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
    updateRestBadgeUrgency();
    
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
      applyPrimaryTimerActionLabel();
      applyPausedUI(false);
      syncTimerFromTimestamp();
      if (state.running && !state.intervalId) {
        state.intervalId = setInterval(tick, 1000);
      }
    } else {
      applyPrimaryTimerActionLabel();
      applyPausedUI(true);
      updateProgressRing();
    }
    return true;
  }

  function inferWorkoutPresetFromCurrentConfig() {
    const matches = Array.from(dom.workoutPresetBtns).filter(function (btn) {
      return (
        parseInt(btn.dataset.sets, 10) === state.totalSets &&
        parseInt(btn.dataset.work, 10) === state.workSeconds &&
        parseInt(btn.dataset.rest, 10) === state.restSeconds
      );
    });
    return matches.length === 1 ? matches[0].dataset.preset : null;
  }

  function getResolvedWorkoutPreset() {
    return state.selectedWorkoutPreset || inferWorkoutPresetFromCurrentConfig();
  }

  function renderTimerMuscleGroup() {
    if (!dom.timerMuscleGroup) return;
    const meta = getBodyPartMeta(getResolvedWorkoutPreset());
    dom.timerMuscleGroup.textContent = "Muscle group: " + meta.label;
  }

  function saveCompletion(completedWork, completedRest, full) {
    const list = getCompletions();
    const resolvedPreset = getResolvedWorkoutPreset();
    const bodyPartMeta = getBodyPartMeta(resolvedPreset);
    const bodyPart = bodyPartMeta ? bodyPartMeta.label : null;

    list.unshift({
      date: new Date().toISOString(),
      workSeconds: state.workSeconds,
      restSeconds: state.restSeconds,
      completedWork: completedWork,
      completedRest: completedRest,
      totalSets: state.totalSets,
      full: !!full,
      workoutPreset: resolvedPreset,
      bodyPart: bodyPart,
    });
    saveCompletions(list.slice(0, MAX_COMPLETIONS));
    renderCompletions();
  }

  function saveSessionIfAny() {
    const w = state.workPhasesCompleted;
    const r = state.restPhasesCompleted;

    // When workout is already finished (Done state), completion was already
    // persisted by the phase-transition handler. Avoid duplicate history rows.
    if (state.setsRemaining <= 0) {
      clearSessionState();
      return;
    }

    // If all work phases were completed, treat workout as completed even if
    // the last rest was shortened via hold-to-reset.
    if (w >= state.totalSets && state.totalSets > 0) {
      saveCompletion(state.totalSets, state.totalSets, true);
      clearSessionState();
      return;
    }

    if (w > 0 || r > 0) saveCompletion(w, r, false);
    clearSessionState();
  }

  function formatDuration(seconds) {
    if (seconds < 60) return seconds + "s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? m + "m" : m + ":" + String(s).padStart(2, "0");
  }

  function isEntryFull(entry) {
    if (!entry) return false;
    if (entry.full === true) return true;
    const total = entry.totalSets != null ? entry.totalSets : entry.sets;
    const completedWork = entry.completedWork != null ? entry.completedWork : total;
    const completedRest = entry.completedRest != null ? entry.completedRest : total;
    if (total == null) return false;
    return completedWork >= total && completedRest >= total;
  }

  function getEntryBodyPart(entry) {
    return entry.bodyPart || (entry.workoutPreset ? getBodyPartMeta(entry.workoutPreset).label : "Custom");
  }

  function getMuscleGroupPriority(name) {
    const order = {
      Legs: 1,
      Back: 2,
      Chest: 3,
      Delts: 4,
      Arms: 5,
      Abs: 6,
      Custom: 7,
    };
    return order[name] || 99;
  }

  function getLongestDailyStreak(daySet) {
    const days = Array.from(daySet).sort();
    let best = 0;
    let current = 0;
    let prev = null;
    days.forEach(function (dayKey) {
      const parts = dayKey.split("-").map(function (x) { return parseInt(x, 10); });
      const cur = new Date(parts[0], parts[1] - 1, parts[2]);
      if (!prev) {
        current = 1;
      } else {
        const delta = Math.round((cur - prev) / (24 * 60 * 60 * 1000));
        current = delta === 1 ? current + 1 : 1;
      }
      if (current > best) best = current;
      prev = cur;
    });
    return best;
  }

  function groupWorkoutsIntoSessions(list) {
    const sessions = [];
    let current = null;
    let prevTs = null;

    list.forEach(function (entry) {
      const ts = new Date(entry.date).getTime();
      if (isNaN(ts)) return;
      if (!current || prevTs == null || (prevTs - ts) > SESSION_GROUP_WINDOW_MS) {
        current = {
          entries: [],
          newestTs: ts,
          oldestTs: ts,
        };
        sessions.push(current);
      }
      current.entries.push(entry);
      current.oldestTs = Math.min(current.oldestTs, ts);
      current.newestTs = Math.max(current.newestTs, ts);
      prevTs = ts;
    });

    return sessions;
  }

  function renderHistoryInsights(list, sessions) {
    if (!dom.historyInsights) return;
    if (!list || list.length === 0) {
      dom.historyInsights.innerHTML = "";
      dom.historyInsights.classList.add("hidden");
      return;
    }

    const BODY_PART_TARGETS = { Chest: 16, Back: 18, Legs: 16, Delts: 16, Arms: 14, Abs: 10 };

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const last7Start = now.getTime() - (7 * dayMs);
    const dayKeys = [];
    const setsByDay = {};
    const allWorkoutDays = new Set();

    let fullCount = 0;
    let workouts7 = 0;
    let sessions7 = 0;
    let sets7 = 0;
    let seconds7 = 0;
    let peakSetsWorkout = 0;
    let totalWorkDone = 0;
    let totalRestDone = 0;
    const bodyPartFreq7 = {};
    const bodyPartSets7 = {};
    const workoutDays7 = new Set();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * dayMs);
      dayKeys.push(d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate());
    }

    list.forEach(function (entry) {
      const ts = new Date(entry.date).getTime();
      if (isNaN(ts)) return;
      if (isEntryFull(entry)) fullCount += 1;

      const completedWork = entry.completedWork != null ? entry.completedWork : (entry.totalSets || entry.sets || 0);
      const completedRest = entry.completedRest != null ? entry.completedRest : completedWork;
      peakSetsWorkout = Math.max(peakSetsWorkout, completedWork || 0);

      const d = new Date(ts);
      const dayKey = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
      allWorkoutDays.add(dayKey);
      setsByDay[dayKey] = (setsByDay[dayKey] || 0) + (completedWork || 0);

      if (ts < last7Start) return;
      workouts7 += 1;
      sets7 += completedWork || 0;
      totalWorkDone += completedWork || 0;
      totalRestDone += completedRest || 0;
      seconds7 += (entry.workSeconds || 0) * (completedWork || 0);
      seconds7 += (entry.restSeconds || 0) * (completedRest || 0);
      workoutDays7.add(dayKey);

      const part = getEntryBodyPart(entry);
      bodyPartFreq7[part] = (bodyPartFreq7[part] || 0) + 1;
      bodyPartSets7[part] = (bodyPartSets7[part] || 0) + (completedWork || 0);
    });

    sessions7 = (sessions || []).filter(function (s) { return s.newestTs >= last7Start; }).length;

    const topBodyPart = Object.keys(bodyPartFreq7).sort(function (a, b) {
      return bodyPartFreq7[b] - bodyPartFreq7[a];
    })[0] || "Custom";

    const completionRate = Math.round((fullCount / list.length) * 100);
    const restAdherenceRaw = totalWorkDone > 0 ? Math.round((totalRestDone / totalWorkDone) * 100) : 0;
    const restAdherence = Math.min(100, restAdherenceRaw);
    const qualityScore = Math.round((completionRate * 0.65) + (restAdherence * 0.35));
    const qualityBand = qualityScore >= 85 ? "Excellent" : qualityScore >= 70 ? "Good" : qualityScore >= 55 ? "Fair" : "Needs work";
    const streak7 = workoutDays7.size;
    const longestStreak = getLongestDailyStreak(allWorkoutDays);

    const targetKeys = Object.keys(BODY_PART_TARGETS);
    let touchedTargets = 0;
    const volumeRows = targetKeys.map(function (name) {
      const done = bodyPartSets7[name] || 0;
      const target = BODY_PART_TARGETS[name];
      const ratio = target > 0 ? Math.min(1, done / target) : 0;
      if (done > 0) touchedTargets += 1;
      const pct = Math.round(ratio * 100);
      return {
        name: name,
        done: done,
        target: target,
        pct: pct,
      };
    });

    const lagging = volumeRows.slice().sort(function (a, b) {
      return (a.done / a.target) - (b.done / b.target);
    })[0];

    const splitCoverage = Math.round((touchedTargets / targetKeys.length) * 100);
    const laggingPct = Math.round((lagging.done / lagging.target) * 100);

    const barsMax = Math.max(1, ...dayKeys.map(function (k) { return setsByDay[k] || 0; }));
    const sparkBars = dayKeys.map(function (k) {
      const v = setsByDay[k] || 0;
      const h = Math.max(10, Math.round((v / barsMax) * 100));
      return "<span class=\"spark-bar\" style=\"height:" + h + "%\" title=\"" + v + " sets\"></span>";
    }).join("");
    const sparkLabels = dayKeys.map(function (k) {
      const parts = k.split("-").map(function (x) { return parseInt(x, 10); });
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return "<span>" + d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2) + "</span>";
    }).join("");

    const volumeHtml = volumeRows.map(function (row) {
      const overflow = Math.max(0, row.done - row.target);
      const valueText = row.done + "/" + row.target + (overflow > 0 ? " (+" + overflow + ")" : "");
      const valueClass = overflow > 0 ? "insight-value insight-value-over" : "insight-value";
      return "<div class=\"insight-row\"><span>" + row.name + "</span><div class=\"insight-bar\"><i style=\"width:" + row.pct + "%\"></i></div><b class=\"" + valueClass + "\">" + valueText + "</b></div>";
    }).join("");

    const primaryCount = state.historyMode === "session" ? sessions7 : workouts7;
    const primaryLabel = state.historyMode === "session" ? "sessions" : "exercises";
    const primarySub = state.historyMode === "session" ? "Grouped by 90m window" : "Raw exercise entries";

    dom.historyInsights.classList.remove("hidden");
    dom.historyInsights.innerHTML =
      "<div class=\"insight-pill\"><span>This week</span><strong>" + primaryCount + " " + primaryLabel + "</strong><small>" + primarySub + "</small></div>" +
      "<div class=\"insight-pill\"><span>Volume</span><strong>" + sets7 + " sets</strong></div>" +
      "<div class=\"insight-pill\"><span>Total time</span><strong>" + formatDuration(seconds7) + "</strong></div>" +
      "<div class=\"insight-pill\"><span>Streak (7d)</span><strong>" + streak7 + "/7 days</strong></div>" +
      "<div class=\"coach-card\"><span>Quality score</span><strong>" + qualityScore + "% · " + qualityBand + "</strong><small>Completion rate " + completionRate + "% · Rest adherence " + restAdherence + "% (rest sets completed vs work sets)</small></div>" +
      "<div class=\"insight-heatmap\"><span>Volume by muscle group (sets / target)</span>" + volumeHtml + "</div>" +
      "<div class=\"insight-spark\"><span>Sets trend (last 7 days)</span><div class=\"spark-bars\">" + sparkBars + "</div><div class=\"spark-labels\">" + sparkLabels + "</div></div>" +
      "<div class=\"insight-pr\"><span>Bodybuilder coaching</span><strong>Split coverage: " + splitCoverage + "%</strong><small>Lagging muscle group: <span class=\"lagging-emphasis\">" + lagging.name + " (" + laggingPct + "% of target)</span> · Most trained muscle group: " + topBodyPart + " · Best session: " + peakSetsWorkout + " sets · Longest streak: " + longestStreak + " days</small></div>";
  }

  function syncHistoryModeButtons() {
    if (!dom.historyModeBtns) return;
    dom.historyModeBtns.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.historyMode === state.historyMode);
    });
  }

  function syncHistoryFilterButtons() {
    if (!dom.historyFilterBtns) return;
    dom.historyFilterBtns.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.filter === state.historyFilter);
    });
  }

  function renderBodyPartFilters(list) {
    if (!dom.historyBodyFilters) return;
    const counts = {};
    list.forEach(function (entry) {
      const key = getEntryBodyPart(entry);
      counts[key] = (counts[key] || 0) + 1;
    });
    const parts = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    if (state.historyBodyFilter !== "all" && !counts[state.historyBodyFilter]) {
      state.historyBodyFilter = "all";
    }

    dom.historyBodyFilters.innerHTML =
      "<button type=\"button\" class=\"history-body-btn" + (state.historyBodyFilter === "all" ? " active" : "") + "\" data-body-filter=\"all\">All muscle groups</button>" +
      parts.map(function (part) {
        const active = state.historyBodyFilter === part ? " active" : "";
        return "<button type=\"button\" class=\"history-body-btn" + active + "\" data-body-filter=\"" + part + "\">" + part + " <small>" + counts[part] + "</small></button>";
      }).join("");
  }

  function filterHistoryList(list) {
    let filtered = list;
    if (state.historyBodyFilter !== "all") {
      filtered = filtered.filter(function (entry) {
        return getEntryBodyPart(entry) === state.historyBodyFilter;
      });
    }
    return filtered;
  }

  function renderCompletions() {
    const list = getCompletions();
    renderBodyPartFilters(list);
    const byBody = filterHistoryList(list);
    const workoutFiltered = state.historyFilter === "full"
      ? byBody.filter(isEntryFull)
      : state.historyFilter === "partial"
        ? byBody.filter(function (entry) { return !isEntryFull(entry); })
        : byBody;
    let sessions = groupWorkoutsIntoSessions(byBody);
    if (state.historyFilter === "full") {
      sessions = sessions.filter(function (s) { return s.entries.every(isEntryFull); });
    } else if (state.historyFilter === "partial") {
      sessions = sessions.filter(function (s) { return !s.entries.every(isEntryFull); });
    }
    renderHistoryInsights(list, groupWorkoutsIntoSessions(list));
    syncHistoryModeButtons();
    syncHistoryFilterButtons();
    dom.completionsList.innerHTML = "";

    const isSessionMode = state.historyMode === "session";
    if ((isSessionMode ? sessions.length : workoutFiltered.length) === 0) {
      const li = document.createElement("li");
      li.className = "completion-item completion-item-empty";
      li.innerHTML = "<span class=\"completion-empty-icon\" aria-hidden=\"true\">🗓️</span><span>No workouts in this filter</span><small>Try another filter or complete a workout.</small>";
      dom.completionsList.appendChild(li);
      dom.btnClearHistory.hidden = list.length === 0;
      return;
    }

    const now = new Date();
    if (isSessionMode) {
      sessions.forEach(function (session) {
        const entries = session.entries;
        const newest = new Date(session.newestTs);
        const dateStr = newest.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: newest.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
        const timeStr = newest.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        const parts = Array.from(new Set(entries.map(getEntryBodyPart))).sort(function (a, b) {
          return getMuscleGroupPriority(a) - getMuscleGroupPriority(b);
        });
        const totalSets = entries.reduce(function (sum, entry) {
          return sum + (entry.completedWork != null ? entry.completedWork : entry.sets || 0);
        }, 0);
        const full = entries.every(isEntryFull);
        const statusClass = full ? "is-full" : "is-partial";
        const statusLabel = full ? "Full" : "Partial";
        const title = parts.slice(0, 2).join(" + ") + (parts.length > 2 ? " +" + (parts.length - 2) : "") + " • " + totalSets + " sets";

        const li = document.createElement("li");
        li.className = "completion-item";
        li.innerHTML =
          "<div class=\"completion-top\">" +
            "<span class=\"completion-summary\">" + title + "</span>" +
            "<span class=\"completion-status " + statusClass + "\">" + statusLabel + "</span>" +
          "</div>" +
          "<div class=\"completion-meta\">" +
            "<span>" + entries.length + " exercises</span>" +
            "<span>Window " + Math.max(1, Math.round((session.newestTs - session.oldestTs) / 60000)) + "m</span>" +
            "<span>" + dateStr + " · " + timeStr + "</span>" +
          "</div>";
        dom.completionsList.appendChild(li);
      });
    } else {
      workoutFiltered.forEach(function (entry) {
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
        const total = entry.totalSets != null ? entry.totalSets : entry.sets;
        const isFull = isEntryFull(entry);
        const statusClass = isFull ? "is-full" : "is-partial";
        const statusLabel = isFull ? "Full" : "Partial";
        const bodyPart = getEntryBodyPart(entry);
        const title = bodyPart + " • " + w + (total ? "/" + total : "") + " sets";

        const entryIndex = list.indexOf(entry);
        const li = document.createElement("li");
        li.className = "completion-item";
        li.innerHTML =
          "<div class=\"completion-top\">" +
            "<span class=\"completion-summary\">" + title + "</span>" +
            "<div class=\"completion-top-actions\">" +
              "<span class=\"completion-status " + statusClass + "\">" + statusLabel + "</span>" +
              "<button type=\"button\" class=\"completion-delete-btn\" data-entry-index=\"" + entryIndex + "\" aria-label=\"Delete this exercise log\" title=\"Delete log\">🗑</button>" +
            "</div>" +
          "</div>" +
          "<div class=\"completion-meta\">" +
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

  function deleteHistoryEntry(index) {
    const list = getCompletions();
    if (isNaN(index) || index < 0 || index >= list.length) return;
    list.splice(index, 1);
    saveCompletions(list);
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

  function updateRestBadgeUrgency() {
    const urgent = state.phase === "rest" && state.remainingSeconds > 0 && state.remainingSeconds <= 3;
    dom.phaseBadge.classList.toggle("urgent", urgent);
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
      const hasAnotherSet = state.setsRemaining > 1;
      if (hasAnotherSet) {
        soundBeginWork();
        showPhaseEndAnimation("Work!", "work", function () {
          switchPhase();
          if (state.running) {
            state.intervalId = setInterval(tick, 1000);
          }
        });
        return;
      }
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
      updateRestBadgeUrgency();
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
    updateRestBadgeUrgency();
    applyPrimaryTimerActionLabel();
        saveSessionState();
    updateTimerNotification(true);
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
    updateRestBadgeUrgency();
        saveSessionState();
    updateTimerNotification(false);
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

  function hapticLight() {
    if (typeof navigator.vibrate === "function") navigator.vibrate(18);
  }

  function hapticStrong() {
    if (typeof navigator.vibrate === "function") navigator.vibrate([30, 35, 55]);
  }

  function haptic() {
    hapticLight();
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
      dom.phaseBadge.classList.remove("urgent");
            setTimerValue("Done!");
      dom.timerValue.classList.add("done-text");
      dom.timerDisplay.style.setProperty("--progress", "0");
      dom.btnStart.textContent = "Next exercise";
      dom.btnStart.setAttribute("aria-label", "Start next exercise");
      dom.timerDisplayBtn.setAttribute("aria-label", "Start next exercise");
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
    closeTimerNotification();
  }

  function switchPhase() {
    const next = state.phase === "work" ? "rest" : "work";
    if (next === "rest") {
      state.workPhasesCompleted += 1;
      hapticStrong(); // set complete
    }
    if (next === "work") {
      state.restPhasesCompleted += 1;
      state.setsRemaining -= 1;
      if (state.setsRemaining <= 0) {
        saveCompletion(state.totalSets, state.totalSets, true);
        clearSessionState();
        stopTimer();
        updateSetDisplay();
        soundDone();
        hapticStrong(); // workout complete
        return;
      }
      hapticLight(); // phase switch to next work block
    }
    setPhase(next);
    updateSetDisplay();
  }

  function getPhaseLabel() {
    if (state.phase === "prep") return "Get ready";
    if (state.phase === "work") return "Work";
    if (state.phase === "rest") return "Rest";
    return "Work";
  }

  function isFinalRestPhase() {
    return state.running && state.phase === "rest" && state.setsRemaining === 1;
  }

  function applyPrimaryTimerActionLabel() {
    if (state.setsRemaining <= 0) return;
    if (!state.running) {
      dom.btnStart.textContent = "Resume";
      dom.btnStart.setAttribute("aria-label", "Resume timer");
      dom.timerDisplayBtn.setAttribute("aria-label", "Resume timer");
      dom.btnStart.classList.remove("running");
      return;
    }
    if (isFinalRestPhase()) {
      dom.btnStart.textContent = "Done";
      dom.btnStart.setAttribute("aria-label", "Finish exercise");
      dom.timerDisplayBtn.setAttribute("aria-label", "Finish exercise");
      dom.btnStart.classList.add("running");
      return;
    }
    dom.btnStart.textContent = "Pause";
    dom.btnStart.setAttribute("aria-label", "Pause timer");
    dom.timerDisplayBtn.setAttribute("aria-label", "Pause timer");
    dom.btnStart.classList.add("running");
  }

  function completeWorkoutNow() {
    state.restPhasesCompleted = state.totalSets;
    state.setsRemaining = 0;
    saveCompletion(state.totalSets, state.totalSets, true);
    clearSessionState();
    stopTimer();
    updateSetDisplay();
    soundDone();
    hapticStrong();
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
      updateRestBadgeUrgency();
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
    applyPrimaryTimerActionLabel();
    saveSessionState();
    closeTimerNotification();
  }

  function resumeTimer() {
    if (state.running) return;
    state.running = true;
    setPhaseEndTimestamp();
    requestWakeLock();
    applyPausedUI(false);
    applyPrimaryTimerActionLabel();
    state.intervalId = setInterval(tick, 1000);
    saveSessionState();
    updateTimerNotification(true);
  }

  function startWorkout() {
    state.workPhasesCompleted = 0;
    state.restPhasesCompleted = 0;
    state.setsRemaining = state.totalSets;
    goToTimer();
    state.running = true;
    requestWakeLock();
    applyPrimaryTimerActionLabel();
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
    updateTimerNotification(true);
  }

  function startStop() {
    if (state.running) {
      if (isFinalRestPhase()) {
        completeWorkoutNow();
        return;
      }
      pauseTimer();
    } else {
      resumeTimer();
    }
  }

  function reset() {
    saveSessionIfAny();
    releaseWakeLock();
    closeTimerNotification();
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
    syncPresetActiveStates();
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
    const selectedPresetBefore = state.selectedWorkoutPreset;
    const clamped = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, seconds));
    if (target === "work") {
      state.workSeconds = clamped;
      if (state.phase === "work") state.remainingSeconds = clamped;
    } else {
      state.restSeconds = clamped;
      if (state.phase === "rest") state.remainingSeconds = clamped;
    }
    state.selectedWorkoutPreset = selectedPresetBefore;
    setTimerValue(formatTime(state.remainingSeconds));
    syncPresetActiveStates();
    syncCustomInputs();
    saveSessionState();
  }

  function applySets(total) {
    if (state.running) return;
    const selectedPresetBefore = state.selectedWorkoutPreset;
    state.totalSets = total;
    state.setsRemaining = total;
    state.selectedWorkoutPreset = selectedPresetBefore;
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
    renderWorkoutPresetStatus();
    renderTimerMuscleGroup();
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
    goToSettings(true);
  } else {
    updateSetDisplay();
    if (state.setsRemaining > 0) {
      goToTimer();
    } else {
      goToSettings(true);
    }
  }
  syncPresetActiveStates();
  syncCustomInputs();
  renderCompletions();
  if (state.running && state.setsRemaining > 0) {
    updateTimerNotification(true);
  } else {
    closeTimerNotification();
  }

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
      if (btn.dataset.preset === state.selectedWorkoutPreset) {
        state.selectedWorkoutPreset = null;
        syncPresetActiveStates();
        saveSessionState();
        return;
      }
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
  dom.completionsList.addEventListener("click", function (e) {
    const btn = e.target.closest(".completion-delete-btn");
    if (!btn) return;
    const entryIndex = parseInt(btn.dataset.entryIndex, 10);
    if (isNaN(entryIndex)) return;
    const ok = window.confirm("Delete this exercise log?");
    if (!ok) return;
    hapticLight();
    deleteHistoryEntry(entryIndex);
  });
  dom.btnViewHistory.addEventListener("click", function () {
    haptic();
    goToHistory();
  });
  dom.btnBackHistory.addEventListener("click", function () {
    haptic();
    goToSettings();
  });
  if (dom.historyModeBtns && dom.historyModeBtns.length) {
    dom.historyModeBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const nextMode = btn.dataset.historyMode || "session";
        if (state.historyMode === nextMode) return;
        state.historyMode = nextMode;
        hapticLight();
        renderCompletions();
      });
    });
  }
  if (dom.historyFilterBtns && dom.historyFilterBtns.length) {
    dom.historyFilterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const nextFilter = btn.dataset.filter || "all";
        if (state.historyFilter === nextFilter) return;
        state.historyFilter = nextFilter;
        hapticLight();
        renderCompletions();
      });
    });
  }
  if (dom.historyBodyFilters) {
    dom.historyBodyFilters.addEventListener("click", function (e) {
      const btn = e.target.closest(".history-body-btn");
      if (!btn) return;
      const next = btn.dataset.bodyFilter || "all";
      if (state.historyBodyFilter === next) return;
      state.historyBodyFilter = next;
      hapticLight();
      renderCompletions();
    });
  }
  if (dom.btnBackHistoryBottom) {
    dom.btnBackHistoryBottom.addEventListener("click", function () {
      haptic();
      goToSettings();
    });
  }

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
