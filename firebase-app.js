import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
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
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

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

function accountState() {
  const user = currentUser;
  if (!user) {
    return { ready: false, signedIn: false, anonymous: true, label: "Sync starting" };
  }

  const providers = user.providerData || [];
  const googleProfile = providers.find(function (profile) {
    return profile.providerId === "google.com";
  });

  return {
    ready: true,
    signedIn: !!googleProfile,
    anonymous: user.isAnonymous,
    uid: user.uid,
    email: googleProfile ? googleProfile.email : null,
    label: googleProfile && googleProfile.email ? googleProfile.email : "Anonymous sync",
  };
}

function emitAccountChange() {
  window.dispatchEvent(new CustomEvent("gymmer-cloud-account", {
    detail: accountState(),
  }));
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

async function signInWithGoogle(localList) {
  await ready;
  const beforeUid = currentUser ? currentUser.uid : null;
  const beforeList = normalizeCompletions(localList);
  const beforeRef = userStateRef();

  if (beforeRef && beforeList.length) {
    await setDoc(beforeRef, {
      completions: beforeList,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  let credential;
  try {
    credential = currentUser && currentUser.isAnonymous
      ? await linkWithPopup(currentUser, googleProvider)
      : await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error && error.code !== "auth/credential-already-in-use" && error.code !== "auth/email-already-in-use") {
      throw error;
    }
    const pendingCredential = GoogleAuthProvider.credentialFromError(error);
    credential = pendingCredential
      ? await signInWithCredential(auth, pendingCredential)
      : await signInWithPopup(auth, googleProvider);
  }

  currentUser = credential.user;
  const merged = await syncCompletions(beforeList);

  if (beforeUid && currentUser.uid !== beforeUid && beforeList.length) {
    await setDoc(userStateRef(), {
      completions: merged,
      migratedFromAnonymousUid: beforeUid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  emitAccountChange();
  return {
    account: accountState(),
    completions: merged,
  };
}

window.gymmerCloud = {
  getAccountState: accountState,
  saveCompletions,
  signInWithGoogle,
  syncCompletions,
};

onAuthStateChanged(auth, function (user) {
  currentUser = user;
  if (user) {
    resolveReady();
    emitAccountChange();
    window.dispatchEvent(new CustomEvent("gymmer-cloud-ready"));
  }
});

signInAnonymously(auth).catch(function () {
  resolveReady();
});
