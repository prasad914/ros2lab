// Loads Firebase and exposes the pieces the pages use. Every page loads this file
// (directly, or through who.js / index.js), so it also sends the anonymous visitor heartbeat.
import { firebaseConfig, REGION, RECAPTCHA_ENTERPRISE_SITE_KEY } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  onAuthStateChanged, signOut, getIdTokenResult, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, reload,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, collectionGroup,
  query, where, orderBy, limit, serverTimestamp, writeBatch, Timestamp, onSnapshot, deleteField, getCountFromServer,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getBlob } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";

export const app = initializeApp(firebaseConfig);
// App Check (optional): only when a reCAPTCHA Enterprise site key is configured. The site keeps
// working without one; the server enforces App Check only when ENFORCE_APP_CHECK is true.
if (RECAPTCHA_ENTERPRISE_SITE_KEY) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true });
}
isSupported().then((ok) => { if (ok) getAnalytics(app); }).catch(() => {});
// Sign-in persistence, chosen explicitly: the Firebase SDK keeps its own session (refresh token)
// in IndexedDB (localStorage only if IndexedDB is unavailable), so students stay logged in
// between visits. Our code never stores tokens, roles or personal data in browser storage.
// No popup/redirect resolver is loaded: the site uses email + password only (add
// browserPopupRedirectResolver here if Google sign-in buttons are added later).
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
export const db = getFirestore(app);
export const storage = getStorage(app);
const functions = getFunctions(app, REGION);
export const call = (name) => httpsCallable(functions, name);

export {
  onAuthStateChanged, signOut, getIdTokenResult, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, reload,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, collectionGroup, query, where, orderBy, limit,
  serverTimestamp, writeBatch, Timestamp, onSnapshot, deleteField, getCountFromServer,
  storageRef, uploadBytes, getBlob,
};

// ---------- anonymous visitor heartbeat (for the instructor's "on the site now" count) ----------
// A random id (no personal data) kept in this browser, the page path (no query string), nothing
// else. Sent when the page opens and every 60 s while the tab is visible; never in the background.
function visitorId() {
  const ok = (v) => typeof v === "string" && /^[a-f0-9]{32}$/.test(v);
  try {
    const old = localStorage.getItem("ros2lab.vid");
    if (ok(old)) return old;
  } catch { /* storage off: a new id per page view */ }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  const id = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  try { localStorage.setItem("ros2lab.vid", id); } catch { /* ignore */ }
  return id;
}
function startHeartbeat() {
  if (window.__ros2labHeartbeat || !/^https?:$/.test(location.protocol)) return;
  window.__ros2labHeartbeat = true;
  const beat = call("heartbeat");
  const vid = visitorId();
  const page = location.pathname.replace(/[^A-Za-z0-9/_.-]/g, "").slice(0, 80) || "/";
  let last = 0;
  const send = () => {
    if (document.visibilityState !== "visible" || Date.now() - last < 30000) return;
    last = Date.now();
    beat({ v: vid, p: page }).catch(() => { /* offline or limited: not important */ });
  };
  // Wait until the sign-in state is known, so the first beat says whether someone is signed in.
  const stop = onAuthStateChanged(auth, () => { stop(); send(); });
  setInterval(send, 60000);
  document.addEventListener("visibilitychange", send);
}
try { startHeartbeat(); } catch { /* never break a page for the counter */ }
