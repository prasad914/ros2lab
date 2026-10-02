/* ROS2Lab shared script.
   To publish a new lesson: upload its page (lesson-02.html, lesson-03.html, ...) and set ready: true below. */
(function () {
  "use strict";

  var LESSONS = [
    { n: 1,  slug: "lesson-01", url: "lesson-01.html", title: "Meet the Nodes", idea: "A robot is a team of small helpers", emoji: "🧩", ready: true,
      badge: { name: "Node Explorer", icon: "badge-nodes" } },
    { n: 2,  slug: "lesson-02", url: "lesson-02.html", title: "Topics", idea: "Message channels between nodes", emoji: "📡", ready: false },
    { n: 3,  slug: "lesson-03", url: "lesson-03.html", title: "Publishers and Subscribers", idea: "Who talks and who listens", emoji: "📣", ready: false },
    { n: 4,  slug: "lesson-04", url: "lesson-04.html", title: "Messages", idea: "What is inside each message", emoji: "✉️", ready: false },
    { n: 5,  slug: "lesson-05", url: "lesson-05.html", title: "Services", idea: "Ask a question, get an answer", emoji: "🙋", ready: false },
    { n: 6,  slug: "lesson-06", url: "lesson-06.html", title: "Parameters", idea: "Robot settings you can change", emoji: "🎛️", ready: false },
    { n: 7,  slug: "lesson-07", url: "lesson-07.html", title: "Actions", idea: "Long jobs that send updates", emoji: "⏳", ready: false },
    { n: 8,  slug: "lesson-08", url: "lesson-08.html", title: "Launch Files", idea: "Start the whole team at once", emoji: "🚀", ready: false },
    { n: 9,  slug: "lesson-09", url: "lesson-09.html", title: "Frames", idea: "How a robot knows where things are", emoji: "🧭", ready: false },
    { n: 10, slug: "lesson-10", url: "lesson-10.html", title: "Sensors", idea: "How robots see, hear and feel", emoji: "👀", ready: false },
    { n: 11, slug: "lesson-11", url: "lesson-11.html", title: "Turtlesim", idea: "Drive your first ROS 2 robot", emoji: "🐢", ready: false },
    { n: 12, slug: "lesson-12", url: "lesson-12.html", title: "Grand Mission", idea: "Build a delivery robot team", emoji: "🏆", ready: false }
  ];

  /* ---------- Saved progress (stays on this device only) ---------- */
  var KEY = "ros2lab-progress-v1";
  var SOUND_KEY = "ros2lab-sound";
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* storage blocked: progress just isn't kept */ }
  }
  function getLesson(slug) { return load()[slug] || {}; }
  function updateLesson(slug, data) {
    var p = load(); p[slug] = Object.assign({}, p[slug], data); save(p);
  }

  /* ---------- Sounds ---------- */
  var soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) {}
  var ctx = null;
  function tone(freq, start, dur, type) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(start); o.stop(start + dur + 0.05);
  }
  function play(kind) {
    if (!soundOn) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      var t = ctx.currentTime;
      if (kind === "good") { tone(660, t, 0.12); tone(990, t + 0.11, 0.18); }
      else if (kind === "bad") { tone(200, t, 0.22, "square"); }
      else if (kind === "step") { tone(520, t, 0.06, "triangle"); }
      else if (kind === "win") { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.13, 0.22); }); }
    } catch (e) {}
  }
  function say(text) {
    if (!soundOn || !("speechSynthesis" in window)) return;
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1; u.pitch = 1.5;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- Drawings: Chiku the robot and badges ---------- */
  var INK = "#1D2B53";
  var blink = '<animate attributeName="ry" values="8;8;1;8;8" keyTimes="0;.9;.94;.98;1" dur="4.5s" repeatCount="indefinite"/>';
  var SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    '<symbol id="chiku" viewBox="0 0 120 140">' +
      '<line x1="60" y1="16" x2="60" y2="28" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="60" cy="12" r="7" fill="#E2456B" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<rect x="7" y="46" width="13" height="26" rx="5" fill="#0E9F95" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<rect x="100" y="46" width="13" height="26" rx="5" fill="#0E9F95" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<rect x="16" y="26" width="88" height="66" rx="22" fill="#FFC83D" stroke="' + INK + '" stroke-width="4"/>' +
      '<rect x="28" y="38" width="64" height="40" rx="14" fill="' + INK + '"/>' +
      '<ellipse cx="45" cy="56" rx="7" ry="8" fill="#7FF0E3">' + blink + '</ellipse>' +
      '<ellipse cx="75" cy="56" rx="7" ry="8" fill="#7FF0E3">' + blink + '</ellipse>' +
      '<path d="M51 69 Q60 75 69 69" fill="none" stroke="#7FF0E3" stroke-width="3.5" stroke-linecap="round"/>' +
      '<rect x="44" y="92" width="32" height="8" fill="' + INK + '"/>' +
      '<rect x="26" y="98" width="68" height="28" rx="10" fill="#FFFFFF" stroke="' + INK + '" stroke-width="4"/>' +
      '<circle cx="60" cy="112" r="6" fill="#EF7316" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="36" cy="128" r="9" fill="' + INK + '"/><circle cx="36" cy="128" r="3.5" fill="#FFC83D"/>' +
      '<circle cx="84" cy="128" r="9" fill="' + INK + '"/><circle cx="84" cy="128" r="3.5" fill="#FFC83D"/>' +
    '</symbol>' +
    '<symbol id="badge-nodes" viewBox="0 0 120 140">' +
      '<path d="M40 88 L28 136 L46 126 L56 138 L62 96Z" fill="#E2456B" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M80 88 L92 136 L74 126 L64 138 L58 96Z" fill="#7457EE" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<circle cx="60" cy="58" r="50" fill="#FFC83D" stroke="' + INK + '" stroke-width="4"/>' +
      '<circle cx="60" cy="58" r="37" fill="#FFFFFF" stroke="' + INK + '" stroke-width="3"/>' +
      '<path d="M40 42 H80 V74 H40 Z M40 42 L80 74" fill="none" stroke="' + INK + '" stroke-width="3" stroke-dasharray="4 4"/>' +
      '<circle cx="40" cy="42" r="8" fill="#0E9F95" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="80" cy="42" r="8" fill="#7457EE" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="40" cy="74" r="8" fill="#EF7316" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="80" cy="74" r="8" fill="#E2456B" stroke="' + INK + '" stroke-width="3"/>' +
    '</symbol>' +
    '</defs></svg>';
  document.body.insertAdjacentHTML("afterbegin", SPRITE);

  /* ---------- Sound on/off button in the header ---------- */
  function paintToggle(btn) {
    btn.textContent = soundOn ? "🔊" : "🔇";
    btn.setAttribute("aria-label", soundOn ? "Sound is on. Turn sound off" : "Sound is off. Turn sound on");
    btn.setAttribute("aria-pressed", soundOn ? "true" : "false");
  }
  document.querySelectorAll("[data-sound-toggle]").forEach(function (btn) {
    paintToggle(btn);
    btn.addEventListener("click", function () {
      soundOn = !soundOn;
      try { localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off"); } catch (e) {}
      if (!soundOn && "speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
      paintToggle(btn);
      play("good");
    });
  });

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* Small confetti burst inside an element */
  function confetti(host) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var colors = ["#FFC83D", "#0E9F95", "#7457EE", "#EF7316", "#E2456B"];
    for (var i = 0; i < 28; i++) {
      var s = document.createElement("span");
      s.className = "confetti";
      s.style.left = (10 + Math.random() * 80) + "%";
      s.style.background = colors[i % colors.length];
      s.style.setProperty("--dx", (Math.random() * 160 - 80) + "px");
      s.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
      s.style.animationDelay = (Math.random() * 0.25) + "s";
      host.appendChild(s);
      setTimeout(function (el) { el.remove(); }, 1900, s);
    }
  }

  window.RL = { LESSONS: LESSONS, load: load, getLesson: getLesson, updateLesson: updateLesson, play: play, say: say, confetti: confetti };
})();
