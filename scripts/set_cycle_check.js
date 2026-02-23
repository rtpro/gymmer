#!/usr/bin/env node

"use strict";

function createState(totalSets) {
  return {
    totalSets: totalSets,
    setsRemaining: totalSets,
    workPhasesCompleted: 0,
    restPhasesCompleted: 0,
    phase: "prep",
    running: true,
    completions: [],
  };
}

function saveCompletion(state, completedWork, completedRest, full) {
  state.completions.push({
    completedWork: completedWork,
    completedRest: completedRest,
    totalSets: state.totalSets,
    full: !!full,
  });
}

function stopTimer(state) {
  state.running = false;
}

function setPhase(state, phase) {
  state.phase = phase;
}

function switchPhase(state) {
  const next = state.phase === "work" ? "rest" : "work";
  if (next === "rest") {
    state.workPhasesCompleted += 1;
  }
  if (next === "work") {
    state.restPhasesCompleted += 1;
    state.setsRemaining -= 1;
    if (state.setsRemaining <= 0) {
      saveCompletion(state, state.totalSets, state.totalSets, true);
      stopTimer(state);
      return;
    }
  }
  setPhase(state, next);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runFullCompletionScenario() {
  const state = createState(3);
  setPhase(state, "work");

  while (state.running) {
    switchPhase(state);
  }

  assert(state.setsRemaining === 0, "Full scenario: setsRemaining should be 0");
  assert(state.workPhasesCompleted === 3, "Full scenario: workPhasesCompleted should equal totalSets");
  assert(state.restPhasesCompleted === 3, "Full scenario: restPhasesCompleted should equal totalSets");
  assert(state.completions.length === 1, "Full scenario: one completion should be saved");
  assert(state.completions[0].full === true, "Full scenario: completion must be marked full");
  assert(state.completions[0].completedWork === 3, "Full scenario: completion should store completedWork=3");
  assert(state.completions[0].completedRest === 3, "Full scenario: completion should store completedRest=3");
}

function runPartialInterruptionScenario() {
  const state = createState(4);
  setPhase(state, "work");

  // One full set (work->rest->work) then interrupt mid-work.
  switchPhase(state); // work -> rest (workPhasesCompleted=1)
  switchPhase(state); // rest -> work (restPhasesCompleted=1, setsRemaining=3)
  stopTimer(state); // interrupted before completion

  assert(state.setsRemaining === 3, "Partial scenario: setsRemaining should stay at 3");
  assert(state.workPhasesCompleted === 1, "Partial scenario: workPhasesCompleted should be 1");
  assert(state.restPhasesCompleted === 1, "Partial scenario: restPhasesCompleted should be 1");
  assert(state.completions.length === 0, "Partial scenario: no full completion should be saved");
}

function startWorkout(state) {
  state.workPhasesCompleted = 0;
  state.restPhasesCompleted = 0;
  state.setsRemaining = state.totalSets;
  state.running = true;
  setPhase(state, "prep");
}

function processPrepEnd(state) {
  assert(state.phase === "prep", "Expected prep phase before transitioning to work");
  setPhase(state, "work");
}

function runOneWorkoutToCompletion(totalSets) {
  const state = createState(totalSets);
  const phaseTrail = [];
  const maxSteps = totalSets * 4 + 10;
  let steps = 0;

  startWorkout(state);
  phaseTrail.push(state.phase);
  processPrepEnd(state);
  phaseTrail.push(state.phase);

  while (state.running) {
    const before = state.phase;
    switchPhase(state);
    steps += 1;
    if (state.running) {
      phaseTrail.push(state.phase);
    }
    assert(steps <= maxSteps, "Phase progression exceeded max steps (possible stuck phase)");
    assert(before !== state.phase || !state.running, "Phase did not advance (possible stuck phase)");
  }

  return { state: state, phaseTrail: phaseTrail };
}

function runBackToBackFullWorkoutsScenario() {
  const first = runOneWorkoutToCompletion(2);
  const second = runOneWorkoutToCompletion(2);

  assert(first.state.setsRemaining === 0, "Double scenario: first workout should complete");
  assert(second.state.setsRemaining === 0, "Double scenario: second workout should complete");
  assert(first.state.completions.length === 1, "Double scenario: first workout should save one full completion");
  assert(second.state.completions.length === 1, "Double scenario: second workout should save one full completion");

  assert(first.phaseTrail[0] === "prep", "Double scenario: first workout must start at prep");
  assert(first.phaseTrail[1] === "work", "Double scenario: first workout must leave prep to work");
  assert(second.phaseTrail[0] === "prep", "Double scenario: second workout must start at prep");
  assert(second.phaseTrail[1] === "work", "Double scenario: second workout must leave prep to work");
}

function main() {
  runFullCompletionScenario();
  console.log("PASS: full workout cycle completion behavior");

  runPartialInterruptionScenario();
  console.log("PASS: interrupted cycle behavior (no false full completion)");

  runBackToBackFullWorkoutsScenario();
  console.log("PASS: two full workouts back-to-back (no stuck phase)");

  console.log("\nSet cycle behavior checks passed.");
}

main();
