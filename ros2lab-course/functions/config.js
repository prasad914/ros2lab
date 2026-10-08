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

// Turn this to true AFTER you set up App Check (SETUP-GUIDE.md, Part 11).
const ENFORCE_APP_CHECK = false;

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
  CORE_MODULES,
  REGISTRATION_MODE, ADMIN_EMAILS, BLOCKED_EMAIL_DOMAINS, MAX_ID_SUBMISSIONS, ID_CARD_MAX_DAYS, REGION, ENFORCE_APP_CHECK, NETWORK_GRACE_SECONDS,
  ACCESS_DAYS, MAX_EXTENSION_DAYS, MAX_REREGISTRATIONS, CERT_VALID_YEARS, PASS_TEST_PERCENT, PASS_PROJECT_PERCENT, PROJECT_MAX_ATTEMPTS, CERT_COURSE_TITLE, CERT_INSTRUCTOR, CERT_INSTRUCTOR_TITLE,
};
