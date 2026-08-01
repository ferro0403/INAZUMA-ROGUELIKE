import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  browserLocalPersistence, createUserWithEmailAndPassword, deleteUser, getAuth,
  onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
  setPersistence, signInWithEmailAndPassword, signOut, updateProfile,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc, getDoc, getFirestore, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const core = globalThis.InazumaAccountCore;
let auth;
let db;
let registrationInProgress = false;
let authStateRevision = 0;
let state = { status: "initializing", uid: null, username: "", email: "", emailVerified: false, profileComplete: false, error: null };

function publish(patch) {
  state = { ...state, ...patch };
  globalThis.dispatchEvent(new CustomEvent("inazuma:auth-state-changed", { detail: { ...state } }));
}

async function profileState(user) {
  let profile = null;
  let readFailed = false;
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (snapshot.exists()) profile = snapshot.data();
    else console.warn("[Account] Profilo Firestore mancante per l’utente autenticato.");
  } catch (error) {
    readFailed = true;
    console.warn("[Account] Profilo Firestore temporaneamente non disponibile.", error?.code || "unknown");
  }
  return {
    status: "authenticated", uid: user.uid,
    username: profile?.username || user.displayName || "",
    email: user.email || "", emailVerified: Boolean(user.emailVerified),
    profileComplete: Boolean(profile), error: readFailed ? "profile-unavailable" : profile ? null : "profile-incomplete",
  };
}

const ready = (async () => {
  try {
    const app = initializeApp(globalThis.INAZUMA_FIREBASE_CONFIG);
    auth = getAuth(app); db = getFirestore(app);
    await setPersistence(auth, browserLocalPersistence);
    onAuthStateChanged(auth, async (user) => {
      const revision = ++authStateRevision;
      if (registrationInProgress && user) return;
      if (!user) return publish({ status: "signed-out", uid: null, username: "", email: "", emailVerified: false, profileComplete: false, error: null });
      publish({
        status: "authenticated", uid: user.uid, username: user.displayName || "",
        email: user.email || "", emailVerified: Boolean(user.emailVerified),
        profileComplete: false, error: null,
      });
      const profile = await profileState(user);
      if (revision === authStateRevision) publish(profile);
    });
    return true;
  } catch (error) {
    console.warn("[Account] Firebase non disponibile.", error?.code || "initialization-failed");
    publish({ status: "unavailable", error: "firebase-unavailable" });
    return false;
  }
})();

async function ensureReady() {
  if (!await ready || !auth || !db) throw { code: "auth/network-request-failed" };
}

async function register(values) {
  await ensureReady();
  const checked = core.validateRegistration(values);
  if (!checked.valid) throw { code: "account/validation", userMessage: checked.message };
  let user = null;
  registrationInProgress = true;
  try {
    const credential = await createUserWithEmailAndPassword(auth, checked.email, values.password);
    user = credential.user;
    await updateProfile(user, { displayName: checked.username });
    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, "usernames", checked.usernameNormalized);
      if ((await transaction.get(usernameRef)).exists()) throw { code: "account/username-taken" };
      const userRef = doc(db, "users", user.uid);
      const publicRef = doc(db, "publicProfiles", user.uid);
      const timestamp = serverTimestamp();
      transaction.set(usernameRef, { uid: user.uid, username: checked.username, usernameNormalized: checked.usernameNormalized, createdAt: timestamp });
      transaction.set(userRef, { username: checked.username, usernameNormalized: checked.usernameNormalized, createdAt: timestamp, updatedAt: timestamp, cloudSchemaVersion: 1 });
      transaction.set(publicRef, { uid: user.uid, username: checked.username, usernameNormalized: checked.usernameNormalized, avatarId: null, createdAt: timestamp, updatedAt: timestamp });
    });
  } catch (error) {
    if (user) {
      let cleanupFailed = false;
      try { await deleteUser(user); } catch (_) { cleanupFailed = true; }
      try { await signOut(auth); } catch (_) { cleanupFailed = true; }
      if (cleanupFailed) {
        registrationInProgress = false;
        throw { code: "account/cleanup-failed", cause: error };
      }
    }
    registrationInProgress = false;
    throw error;
  }
  let verificationSent = true;
  try { await sendEmailVerification(user); } catch (error) { verificationSent = false; console.warn("[Account] Invio verifica email non riuscito.", error?.code || "unknown"); }
  publish({ status: "authenticated", uid: user.uid, username: checked.username, email: user.email || checked.email, emailVerified: false, profileComplete: true, error: verificationSent ? null : "verification-not-sent" });
  registrationInProgress = false;
  return { verificationSent };
}

async function login(email, password) { await ensureReady(); return signInWithEmailAndPassword(auth, String(email || "").trim(), password); }
async function logout() { await ensureReady(); await signOut(auth); }
async function sendPasswordReset(email) { await ensureReady(); await sendPasswordResetEmail(auth, String(email || "").trim()); }
async function resendVerification() { await ensureReady(); if (!auth.currentUser) throw { code: "auth/invalid-credential" }; await sendEmailVerification(auth.currentUser); }

globalThis.InazumaAccount = Object.freeze({ ready, getState: () => ({ ...state }), getCurrentUser: () => auth?.currentUser || null, getFirestoreInstance: () => db, register, login, logout, sendPasswordReset, resendVerification, openAuthModal: () => globalThis.InazumaAccountUI?.openAuthModal(), openAccountModal: () => globalThis.InazumaAccountUI?.openAccountModal() });
