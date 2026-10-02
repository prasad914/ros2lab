// Loads Firebase and exposes the pieces the pages use.
import { firebaseConfig, REGION, RECAPTCHA_ENTERPRISE_SITE_KEY } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut, getIdTokenResult, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, reload,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, collectionGroup,
  query, where, serverTimestamp, writeBatch, Timestamp, onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getBlob } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";

export const app = initializeApp(firebaseConfig);
if (RECAPTCHA_ENTERPRISE_SITE_KEY) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true });
}
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
const functions = getFunctions(app, REGION);
export const call = (name) => httpsCallable(functions, name);

export {
  onAuthStateChanged, signOut, getIdTokenResult, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, reload,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, collectionGroup, query, where, serverTimestamp, writeBatch, Timestamp, onSnapshot,
  storageRef, uploadBytes, getBlob,
};
