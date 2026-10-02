// Turtle Commander: a browser turtlesim that understands the real ros2 commands from the Jazzy tutorials.
import { el, reducedMotion } from "../dom.js";
import { shell, sleep } from "./shell.js";

const W = 11.088889;                        // turtlesim world size
const BG = [69, 86, 255];                   // turtlesim default background
const PEN = { r: 179, g: 184, b: 255, width: 3, off: false };
const TWIST = 'ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}, angular: {z: 0.0}}"';
const TEMPLATES = [
  ["Move forward", TWIST],
  ["Turn left 90°", 'ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.0}, angular: {z: 1.57}}"'],
  ["Red pen", 'ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 255, g: 0, b: 0, width: 4, \'off\': 0}"'],
  ["Teleport", 'ros2 service call /turtle1/teleport_absolute turtlesim/srv/TeleportAbsolute "{x: 1.5, y: 1.5, theta: 0.0}"'],
  ["Background", "ros2 param set /turtlesim background_r 150"],
  ["Clear drawing", "ros2 service call /clear std_srvs/srv/Empty"],
  ["List topics", "ros2 topic list"],
];
const MISSIONS = [
  ["fwd", "Drive the turtle forward with a Twist message on /turtle1/cmd_vel."],
  ["turn", "Turn the turtle about 90° (angular z ≈ 1.57 radians)."],
  ["red", "Change the pen to red with the /turtle1/set_pen service, then draw a line."],
  ["corner", "Teleport the turtle into the yellow box in the bottom-left corner."],
  ["bg", "Change the background colour with ros2 param set."],
];

const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1]) : null; };

export function mount(container, meta, opts) {
  const g = shell(container, { ...meta, goal: "Type real ros2 commands to control the turtle. Tap a grey button to fill in a command, change the numbers, then press Enter." }, opts);
  let st;
  const canvas = el("canvas", { class: "tt-canvas", width: 440, height: 440, role: "img", "aria-label": "Turtlesim window" });
  const ctx = canvas.getContext("2d");
  const missions = el("ol", { class: "pz-missions tt-missions" });
  const out = el("div", { class: "tt-out", "aria-live": "polite" });
  const input = el("input", { type: "text", class: "pf-input", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Type a ros2 command" });
  const runBtn = el("button", { class: "btn btn-small", type: "button", text: "Run" });
  const chips = el("div", { class: "so-chips" }, TEMPLATES.map(([label, cmd]) => el("button", { type: "button", class: "so-chip tt-chip", text: label, onclick: () => { input.value = cmd; input.focus(); } })));
  g.stage.append(el("div", { class: "tt-grid" },
    el("div", { class: "tt-win" }, el("div", { class: "tt-title", text: "TurtleSim" }), canvas),
    el("div", { class: "tt-side" }, missions)),
    el("div", { class: "tt-term" }, out, el("div", { class: "pf-line tt-line" }, el("span", { class: "pf-prompt", text: "$ " }), input), runBtn),
    el("div", { class: "rd-label", text: "Fill in a command" }), chips);

  const px = (v) => (v / W) * canvas.width;
  const py = (v) => canvas.height - (v / W) * canvas.height;

  function draw() {
    const [r, gg, b] = st.bg;
    ctx.fillStyle = `rgb(${r},${gg},${b})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // goal box for the teleport mission
    if (!st.done.corner) { ctx.strokeStyle = "#FFC83D"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.strokeRect(px(0.15), py(3), px(2.85), px(2.85)); ctx.setLineDash([]); }
    ctx.lineCap = "round";
    for (const s of st.trail) { ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(px(s.x1), py(s.y1)); ctx.lineTo(px(s.x2), py(s.y2)); ctx.stroke(); }
    // turtle
    const t = st.turtle;
    ctx.save(); ctx.translate(px(t.x), py(t.y)); ctx.rotate(-t.th);
    ctx.fillStyle = "#3FA34D"; ctx.strokeStyle = "#1D2B53"; ctx.lineWidth = 2;
    for (const [lx, ly] of [[8, 9], [8, -9], [-8, 9], [-8, -9]]) { ctx.beginPath(); ctx.ellipse(lx, ly, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(17, 0, 6, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8BC34A"; ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#3FA34D"; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(-6, 6); ctx.lineTo(6, -6); ctx.stroke();
    ctx.restore();
  }

  const print = (text, cls = "") => { out.append(el("div", { class: `tt-l ${cls}`, text })); out.scrollTop = out.scrollHeight; };

  async function moveTwist(vx, wz) {
    const t = st.turtle, steps = 40, dt = 1 / steps;
    const before = { x: t.x, y: t.y }, turned = Math.abs(wz);
    let hit = false;
    for (let i = 0; i < steps; i++) {
      t.th += wz * dt;
      let nx = t.x + vx * Math.cos(t.th) * dt, ny = t.y + vx * Math.sin(t.th) * dt;
      if (nx < 0 || ny < 0 || nx > W || ny > W) { hit = true; nx = Math.min(W, Math.max(0, nx)); ny = Math.min(W, Math.max(0, ny)); }
      if (!st.pen.off && (nx !== t.x || ny !== t.y)) st.trail.push({ x1: t.x, y1: t.y, x2: nx, y2: ny, c: `rgb(${st.pen.r},${st.pen.g},${st.pen.b})`, w: st.pen.width });
      t.x = nx; t.y = ny;
      if (!reducedMotion()) { draw(); await sleep(1000 / steps); }
    }
    draw();
    if (hit) print("[WARN] [turtlesim]: Oh no! I hit the wall! (Clamping from going out of the window)", "warn");
    const moved = Math.hypot(t.x - before.x, t.y - before.y);
    if (moved >= 1.0 && vx > 0) st.done.fwd = true;
    if (turned >= 1.4 && turned <= 1.75) st.done.turn = true;
    if (moved > 0.5 && !st.pen.off && st.pen.r >= 200 && st.pen.g < 90 && st.pen.b < 90) st.done.red = true;
  }

  async function exec(raw) {
    const cmd = raw.trim().replace(/\s+/g, " ");
    if (!cmd) return;
    print("$ " + raw, "cmd");
    if (cmd === "clear") { out.replaceChildren(); return; }
    if (cmd === "help") { print("Try the grey buttons below. Every command here works the same way on a real Ubuntu computer with ROS 2 Jazzy and turtlesim running."); return; }
    if (!cmd.startsWith("ros2 ")) { print(`${cmd.split(" ")[0]}: this practice terminal only understands ros2 commands.`, "err"); return; }

    if (cmd === "ros2 node list") return print("/turtlesim");
    if (cmd === "ros2 topic list") return print("/parameter_events\n/rosout\n/turtle1/cmd_vel\n/turtle1/color_sensor\n/turtle1/pose");
    if (cmd === "ros2 service list") return print("/clear\n/kill\n/reset\n/spawn\n/turtle1/set_pen\n/turtle1/teleport_absolute\n/turtle1/teleport_relative\n/turtlesim/get_parameters\n/turtlesim/set_parameters");
    if (cmd === "ros2 action list") return print("/turtle1/rotate_absolute");
    if (/^ros2 topic echo \/turtle1\/pose/.test(cmd)) { const t = st.turtle; return print(`x: ${t.x.toFixed(4)}\ny: ${t.y.toFixed(4)}\ntheta: ${(((t.th + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI).toFixed(4)}\nlinear_velocity: 0.0\nangular_velocity: 0.0\n---`); }

    let m;
    if ((m = cmd.match(/^ros2 topic pub (--once |-1 )?(\S+) (\S+) (.+)$/))) {
      const [, once, topic, type, yaml] = m;
      if (type !== "geometry_msgs/msg/Twist") return print(`The passed message type is invalid. /turtle1/cmd_vel uses geometry_msgs/msg/Twist (you typed ${type}).`, "err");
      const vx = num(yaml, /linear\s*:\s*\{[^}]*?\bx\s*:\s*(-?\d*\.?\d+)/) ?? 0;
      const wz = num(yaml, /angular\s*:\s*\{[^}]*?\bz\s*:\s*(-?\d*\.?\d+)/) ?? 0;
      if (!/linear|angular/.test(yaml)) return print('Could not read the message. Use the form "{linear: {x: 2.0}, angular: {z: 0.0}}" with the quotes.', "err");
      print("publisher: beginning loop");
      if (topic !== "/turtle1/cmd_vel") { print(`publishing #1: geometry_msgs.msg.Twist(...)\n(Nothing moved: no node subscribes to ${topic}. The turtle listens on /turtle1/cmd_vel. Exact names matter!)`, "warn"); return; }
      const times = once ? 1 : 4;
      for (let i = 1; i <= times; i++) {
        print(`publishing #${i}: geometry_msgs.msg.Twist(linear=Vector3(x=${vx.toFixed(1)}, y=0.0, z=0.0), angular=Vector3(x=0.0, y=0.0, z=${wz.toFixed(2)}))`);
        await moveTwist(vx, wz);
      }
      if (!once) print("(Stopped after 4 messages. On a real terminal it keeps publishing once per second until you press Ctrl+C. Add --once to send just one.)", "hint");
      return;
    }
    if ((m = cmd.match(/^ros2 service call (\S+) (\S+)\s*(.*)$/))) {
      const [, srv, type, yaml] = m;
      const SRV = { "/turtle1/set_pen": "turtlesim/srv/SetPen", "/turtle1/teleport_absolute": "turtlesim/srv/TeleportAbsolute", "/clear": "std_srvs/srv/Empty", "/reset": "std_srvs/srv/Empty" };
      if (!SRV[srv]) return print(`waiting for service to become available...\n(No service called ${srv}. Run ros2 service list to see the real names.)`, "err");
      if (SRV[srv] !== type) return print(`The passed service type is invalid. ${srv} uses ${SRV[srv]}.`, "err");
      print(`requester: making request: ${type.replace(/\//g, ".").replace(".srv.", ".srv.")}_Request(...)`);
      if (srv === "/clear") { st.trail = []; }
      else if (srv === "/reset") { const keep = st.done; reset(); st.done = keep; }
      else if (srv === "/turtle1/set_pen") {
        const r = num(yaml, /\br\s*:\s*(\d+)/), gg = num(yaml, /\bg\s*:\s*(\d+)/), b = num(yaml, /\bb\s*:\s*(\d+)/), w = num(yaml, /width\s*:\s*(\d+)/), off = num(yaml, /off'?\s*:\s*(\d)/);
        if ([r, gg, b].some((v) => v == null)) return print("Give all three colours, like \"{r: 255, g: 0, b: 0, width: 4, 'off': 0}\"", "err");
        st.pen = { r: Math.min(255, r), g: Math.min(255, gg), b: Math.min(255, b), width: w ?? 3, off: off === 1 };
      } else if (srv === "/turtle1/teleport_absolute") {
        const x = num(yaml, /\bx\s*:\s*(-?\d*\.?\d+)/), y = num(yaml, /\by\s*:\s*(-?\d*\.?\d+)/), th = num(yaml, /theta\s*:\s*(-?\d*\.?\d+)/) ?? 0;
        if (x == null || y == null) return print('Give x and y, like "{x: 1.5, y: 1.5, theta: 0.0}"', "err");
        const t = st.turtle, nx = Math.min(W, Math.max(0, x)), ny = Math.min(W, Math.max(0, y));
        if (!st.pen.off) st.trail.push({ x1: t.x, y1: t.y, x2: nx, y2: ny, c: `rgb(${st.pen.r},${st.pen.g},${st.pen.b})`, w: st.pen.width });
        t.x = nx; t.y = ny; t.th = th;
        if (nx < 3 && ny < 3) st.done.corner = true;
      }
      print("response:\n" + type.split("/").pop() + "_Response()");
      draw(); paint();
      return;
    }
    if ((m = cmd.match(/^ros2 param (get|set) \/turtlesim (background_[rgb])(?: (\d+))?$/))) {
      const idx = "rgb".indexOf(m[2].slice(-1));
      if (m[1] === "get") return print(`Integer value is: ${st.bg[idx]}`);
      if (m[3] == null) return print("Add a value from 0 to 255, for example: ros2 param set /turtlesim background_r 150", "err");
      const v = Math.min(255, parseInt(m[3], 10));
      st.bg = st.bg.slice(); st.bg[idx] = v; st.done.bg = true;
      print("Set parameter successful"); draw(); paint(); return;
    }
    if (/^ros2 param list/.test(cmd)) return print("/turtlesim:\n  background_b\n  background_g\n  background_r\n  use_sim_time");
    print("This practice terminal doesn't know that command yet. Tap a grey button for one that works.", "err");
  }

  function paint() {
    missions.replaceChildren(...MISSIONS.map(([k, t]) => el("li", { class: st.done[k] ? "done" : "" }, el("span", { class: "box", text: st.done[k] ? "✓" : "" }), el("span", { text: t }))));
    if (MISSIONS.every(([k]) => st.done[k]) && !st.won) {
      st.won = true;
      g.win("You used a **topic** (cmd_vel), two **services** (set_pen, teleport) and a **parameter** (background). On Ubuntu, start the real turtle with `ros2 run turtlesim turtlesim_node` and type the same commands in a second terminal.",
        "ros2 run turtlesim turtlesim_node\n" + TWIST);
    }
  }
  function reset() { st = { ...(st || {}), turtle: { x: W / 2, y: W / 2, th: 0 }, trail: [], pen: { ...PEN }, bg: BG.slice(), done: st?.done || {}, won: st?.won || false }; draw(); }

  let busy = false;
  const go = async () => { if (busy) return; busy = true; runBtn.disabled = true; const v = input.value; input.value = ""; try { await exec(v); } finally { busy = false; runBtn.disabled = false; paint(); } };
  runBtn.addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  g.onRestart(() => { st = null; reset(); out.replaceChildren(); print("turtlesim is running. Try: ros2 topic list"); paint(); });
  st = null; reset(); print("turtlesim is running. Try: ros2 topic list"); paint();
}
