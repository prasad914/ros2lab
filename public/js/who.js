// Public pages: when someone is logged in, the header shows their own links
// (My course / My account / Log out) instead of "Log in" and "Register".
(async () => {
  const who = document.getElementById("who");
  if (!who) return;
  try {
    const [{ auth, onAuthStateChanged }, { el, getStage, signOutNow }] = await Promise.all([import("./fb.js"), import("./common.js")]);
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const st = await getStage(user);
      const where = st.stage === "admin" ? "/admin.html" : st.stage === "approved" ? "/course.html" : "/register.html";
      who.replaceChildren(...[
        el("a", { class: "btn btn-small", href: where, text: st.stage === "admin" ? "Instructor" : st.stage === "approved" ? "My course" : "My registration" }),
        st.stage === "admin" ? null : el("a", { class: "btn btn-white btn-small", href: "/account.html", text: "My account" }),
        el("button", { class: "btn btn-white btn-small", type: "button", onclick: signOutNow, text: "Log out" })].filter(Boolean));
    });
  } catch { /* offline: the Log in and Register buttons still work */ }
})();
