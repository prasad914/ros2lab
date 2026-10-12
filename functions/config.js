// ===================== EDIT THIS FILE FOR YOUR COURSE =====================

// How students get access to the course. Must match public/js/firebase-config.js.
//   "id-card" : students upload a college ID card photo; the instructor approves each one
//   "manual"  : no ID card; the instructor approves each student from their college details
//   "auto"    : no ID card, no approval; access right after email verification and college details
const REGISTRATION_MODE = "auto";

// Instructor accounts (lowercase). Register on the website with this email,
// click the verification link, then sign out and sign in again: the account
// becomes an instructor automatically. Keep this list short.
const ADMIN_EMAILS = [
  "prasadprabhu145@gmail.com",
];

// Throwaway email services that may not be used to register.
const BLOCKED_EMAIL_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org", "yopmail.com",
  "trashmail.com", "sharklasers.com", "getnada.com", "dispostable.com", "tempmail.com",
];

// How many times a rejected student may upload a new ID card.
const MAX_ID_SUBMISSIONS = 3;

// ID card images are deleted after review, and at the latest after this many days.
const ID_CARD_MAX_DAYS = 30;

// Server region (Mumbai). Must match public/js/firebase-config.js.
const REGION = "asia-south1";

// Turn this to true AFTER you set up App Check (SETUP-GUIDE.md, Part 15, and SECURITY.md).
// While false, the server accepts calls without an App Check token (the site works without a key).
const ENFORCE_APP_CHECK = false;

// ---------- Security ----------
// Web addresses (origins) allowed to call the Cloud Functions from a browser (CORS).
// Add your own domain here if it changes. Firebase preview channels (ros2lab--name-xxxx.web.app)
// are allowed by the pattern below. Calls from any other website are refused by the browser.
const ALLOWED_ORIGINS = [
  "https://www.ros2lab.com",
  "https://ros2lab.com",
  "https://ros2lab.web.app",
  "https://ros2lab.firebaseapp.com",
  /^https:\/\/ros2lab--[a-z0-9-]{1,60}\.web\.app$/,
];

// Requests per caller (signed-in account) and time window, for each server function:
// name: [requests, window in seconds]. Above the limit the caller gets "Too many requests".
const RATE_LIMITS = {
  startAttempt: [30, 600], submitAnswer: [120, 60], getReview: [60, 600],
  submitForReview: [10, 3600], requestReregistration: [5, 86400], deleteMyAccount: [3, 86400],
  requestExtension: [5, 86400], assignProject: [20, 3600], submitProject: [10, 3600],
  checkCompletion: [60, 3600], applyForCertificate: [10, 86400], requestHardwareLicense: [10, 86400],
  getHardwareSources: [30, 3600],
  // Instructor tools (generous: they are only for the admin accounts anyway).
  admin: [300, 60],
  // Visitor counter (no account needed): per IP address and server instance, in memory only.
  heartbeatPerIp: [300, 60],
};

// Visitor counter on the admin page: "on the site now" = a heartbeat in the last N seconds.
const PRESENCE_WINDOW_SECONDS = 120;

// Extra seconds allowed for slow mobile networks when checking test timers.
const NETWORK_GRACE_SECONDS = 8;

// ---------- Access window ----------
// Days of course access, counted from the moment the registration is approved.
// When it ends, the student loses access and must ask for a new registration,
// which ALWAYS needs your approval (even in "auto" mode).
const ACCESS_DAYS = 60;

// Extra time: a student may ask ONCE, only in the first registration, before the period ends.
// You approve 1 to MAX_EXTENSION_DAYS days (added to the original end date) or refuse.
// If the course is still not finished then, the registration is cancelled automatically.
const MAX_EXTENSION_DAYS = 30;

// After a cancelled registration a student may ask to register again (always afresh, 60 days,
// no extra time), at most this many times. Your approval is always needed. Further requests
// are rejected automatically.
const MAX_REREGISTRATIONS = 2;

// ---------- Certificate rules ----------
// Lifetime access: a student who finishes every lesson AND scores at least
// PASS_TEST_PERCENT in every published test inside the access window keeps access for life.
// A student may APPLY for a certificate only when ALL of these are true:
//   * every lesson is marked complete,
//   * the best score in EVERY published test is at least PASS_TEST_PERCENT,
//   * the project scores at least PASS_PROJECT_PERCENT within PROJECT_MAX_ATTEMPTS submissions.
// The certificate can be downloaded after you sign it in Instructor -> Certificates.
const PASS_TEST_PERCENT = 60;
const PASS_PROJECT_PERCENT = 80;
const PROJECT_MAX_ATTEMPTS = 2;

// A signed certificate is valid for this many years from the day you sign it.
const CERT_VALID_YEARS = 2;

// Printed on every certificate.
// Matches the six modules: Linux terminal, Python and C++ basics, ROS 2 concepts, first nodes.
const CERT_COURSE_TITLE = "ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes";
const CERT_INSTRUCTOR = "Prasad Prabhu";
const CERT_INSTRUCTOR_TITLE = "Course Instructor, ROS2Lab";

// Modules (weeks) that count for lifetime access and the certificate. Weeks 7-9 (UR, XT, RV) are an
// optional advanced track. Leave the list empty ([]) to make EVERY module count.
const CORE_MODULES = ["W1", "W2", "IN", "W3", "PF", "NP"];

module.exports = {
  CORE_MODULES, ALLOWED_ORIGINS, RATE_LIMITS, PRESENCE_WINDOW_SECONDS,
  REGISTRATION_MODE, ADMIN_EMAILS, BLOCKED_EMAIL_DOMAINS, MAX_ID_SUBMISSIONS, ID_CARD_MAX_DAYS, REGION, ENFORCE_APP_CHECK, NETWORK_GRACE_SECONDS,
  ACCESS_DAYS, MAX_EXTENSION_DAYS, MAX_REREGISTRATIONS, CERT_VALID_YEARS, PASS_TEST_PERCENT, PASS_PROJECT_PERCENT, PROJECT_MAX_ATTEMPTS, CERT_COURSE_TITLE, CERT_INSTRUCTOR, CERT_INSTRUCTOR_TITLE,
};
