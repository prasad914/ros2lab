// Shows only the page text that matches the registration mode (see firebase-config.js).
import { REGISTRATION_MODE } from "./firebase-config.js";
document.querySelectorAll("[data-mode]").forEach((el) => {
  if (!el.dataset.mode.split(" ").includes(REGISTRATION_MODE)) el.remove();
});
