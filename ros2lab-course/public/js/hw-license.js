// Real-hardware license: connecting a real robot from ROS2Lab (rosbridge, or launching a *_bringup / real.launch.py in
// the practice terminal) needs a license that the course administrator grants (Cloud Functions requestHardwareLicense /
// adminDecideHardwareLicense, Firestore hardwareLicenses/{uid}). Simulation never needs one.
let cached = null;   // { status, robots, validUntil, note, key, admin }

export async function licenseStatus(force = false) {
  if (cached && !force) return cached;
  try {
    const [{ auth, onAuthStateChanged, db, doc, getDoc, getIdTokenResult }] = await Promise.all([import("./fb.js")]);
    const user = auth.currentUser || await new Promise((res) => { const stop = onAuthStateChanged(auth, (u) => { stop(); res(u); }); setTimeout(() => res(null), 4000); });
    if (!user) return (cached = { status: "signedout" });
    const tok = await getIdTokenResult(user);
    if (tok.claims.admin === true) return (cached = { status: "approved", admin: true, robots: ["all"] });
    const snap = await getDoc(doc(db, "hardwareLicenses", user.uid));
    if (!snap.exists()) return (cached = { status: "none" });
    const d = snap.data(), until = d.validUntil && d.validUntil.toMillis ? d.validUntil.toMillis() : null;
    const status = d.status === "approved" && until && until < Date.now() ? "expired" : d.status;
    return (cached = { status, robots: d.robots || [], validUntil: until, note: d.note || "", key: d.key || "" });
  } catch (e) {
    return (cached = { status: "unavailable", error: String(e && e.message || e) });
  }
}
export const licensed = (st, robot) => !!st && st.status === "approved" && (!robot || (st.robots || []).includes("all") || [].concat(robot).some((r) => (st.robots || []).includes(r)));
export function cachedLicense() { return cached; }

export async function requestLicense(robots, purpose) {
  const { call } = await import("./fb.js");
  const r = await call("requestHardwareLicense")({ robots: [].concat(robots), purpose });
  cached = null;
  return r.data;
}

// The explanation shown wherever a real connection is refused
export function licenseMessage(st, robot) {
  if (Array.isArray(robot)) robot = robot[0];
  const who = robot ? ` for ${robot}` : "";
  switch (st && st.status) {
    case "signedout": return `Connecting real hardware${who} needs a hardware license from your course administrator. Log in first, then ask for one.`;
    case "pending": return `Your hardware license request is waiting for the course administrator. Real hardware stays locked until it is approved.`;
    case "rejected": return `Your hardware license request was refused${st.note ? `: ${st.note}` : ""}. Contact your course administrator.`;
    case "revoked": return `Your hardware license was revoked${st.note ? `: ${st.note}` : ""}. Contact your course administrator.`;
    case "expired": return "Your hardware license has expired. Ask your course administrator to renew it.";
    case "approved": return robot && !licensed(st, robot) ? `Your hardware license does not cover ${robot}. Ask your course administrator to add it.` : "Licensed.";
    case "unavailable": return "The license server cannot be reached, so real hardware stays locked. Check your internet connection and log in again.";
    default: return `Connecting real hardware${who} needs a hardware license from your course administrator. Ask for one with the form below; simulation needs no license.`;
  }
}
