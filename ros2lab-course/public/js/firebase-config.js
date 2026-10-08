// ======================================================================
// STEP: paste YOUR Firebase web app settings below.
// Find them in: Firebase console > Project settings (gear icon) > General >
// "Your apps" > ros2lab-web > "SDK setup and configuration" > Config.
// These values are NOT secret (Google designs them to be public).
// Security comes from firestore.rules and the server code.
// ======================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBSIRbvJDMsiQDwyX9QepGqp1h6RBcTkes",
  authDomain: "ros2lab.firebaseapp.com",
  projectId: "ros2lab",
  storageBucket: "ros2lab.firebasestorage.app",
  messagingSenderId: "1038209894341",
  appId: "1:1038209894341:web:c2fadcc7a36b68d550edac",
  measurementId: "G-43K3V7EWHP"
};

// How students get access. MUST be the same as REGISTRATION_MODE in functions/config.js.
//   "id-card" : upload a college ID card photo, instructor approves
//   "manual"  : no ID card, instructor approves from the college details
//   "auto"    : no ID card, no approval (access after email verification + details)
export const REGISTRATION_MODE = "auto";

// Server region (must match functions/config.js).
export const REGION = "asia-south1";

// Optional: App Check site key (reCAPTCHA Enterprise). Leave empty until SETUP-GUIDE Part 8.
export const RECAPTCHA_ENTERPRISE_SITE_KEY = "";

// Change this text when you change the privacy notice; students will be asked again.
export const CONSENT_VERSION = "2026-11-terms";

// Shown on the registration pages for questions about registration and privacy.
export const CONTACT_EMAIL = "prasadprabhu145@gmail.com";
