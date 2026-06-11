import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  enableIndexedDbPersistence,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCoayd1ij4RFJ44vuyKIrglA9yRQRO4mcY",
  authDomain: "gymmer-app-20260611.firebaseapp.com",
  projectId: "gymmer-app-20260611",
  storageBucket: "gymmer-app-20260611.firebasestorage.app",
  messagingSenderId: "301893582672",
  appId: "1:301893582672:web:970356c2398fb46273f655",
};

const MAX_COMPLETIONS = 50;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch(function () {});

let currentUser = auth.currentUser;
let resolveReady;
const ready = new Promise(function (resolve) {
  resolveReady = resolve;
});

function completionKey(entry) {
  if (!entry || typeof entry !== "object") return "";
  return [
    entry.date || "",
    entry.workSeconds || "",
    entry.restSeconds || "",
    entry.completedWork || "",
    entry.completedRest || "",
    entry.totalSets || entry.sets || "",
    entry.workoutPreset || "",
    entry.bodyPart || "",
    entry.full === true ? "full" : "partial",
  ].join("|");
}

function normalizeCompletions(list) {
  return Array.isArray(list) ? list.filter(Boolean).slice(0, MAX_COMPLETIONS) : [];
}

function mergeCompletions(localList, remoteList) {
  const seen = new Set();
  return normalizeCompletions([].concat(localList || [], remoteList || []))
    .sort(function (a, b) {
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    })
    .filter(function (entry) {
      const key = completionKey(entry);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_COMPLETIONS);
}

function userStateRef() {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid, "state", "history");
}

async function saveCompletions(list) {
  await ready;
  const ref = userStateRef();
  if (!ref) return null;
  const completions = normalizeCompletions(list);
  await setDoc(ref, {
    completions,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return completions;
}

async function syncCompletions(localList) {
  await ready;
  const ref = userStateRef();
  if (!ref) return null;

  const snapshot = await getDoc(ref);
  const remoteList = snapshot.exists() ? snapshot.data().completions : [];
  const merged = mergeCompletions(localList, remoteList);
  await setDoc(ref, {
    completions: merged,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return merged;
}

window.gymmerCloud = {
  saveCompletions,
  syncCompletions,
};

onAuthStateChanged(auth, function (user) {
  currentUser = user;
  if (user) {
    resolveReady();
    window.dispatchEvent(new CustomEvent("gymmer-cloud-ready"));
  }
});

signInAnonymously(auth).catch(function () {
  resolveReady();
});
