// TurtleBot3 base motion on Gazebo Harmonic (Night 1, Part 3). Only the TurtleBot3 models of turtlebot3_gazebo
// (models/turtlebot3_{burger,waffle,waffle_pi}/model.sdf) use it; every other robot keeps the kinematic drive.
//
// What real Gazebo does (parity/fixtures/tb3_jazzy_v3/physics/, captured on this PC with the installed models):
// the DiffDrive system sets the wheel joint velocities from its SpeedLimiter output at once, and the odometry
// integrates the wheel angles, so /odom follows the command (linear: ramp at <max_linear_acceleration> 1.0 m/s²;
// angular: at once). The body does not: it moves only as fast as the wheel contacts let it, so it lags the wheels
// (wheel slip). Odometry therefore leads the ground truth, most of all in a spin.
//
// Model: the body velocity follows the wheel-surface velocity (what odom integrates) seen `delay` s late, with
//   dv/dt = clamp((v_wheels - v) / tau, -aMax, aMax)
// separately for the forward speed and the yaw rate. The constants are fitted by parity/compare/tb3_motion_fit.py
// to the ground-truth speed curves of the cases named next to each value (3 runs each, bit-identical; captured with
// parity/scripts/tb3_v3/run_physics.sh, gz-sim 8.10, the installed turtlebot3_gazebo 2.3.7 models).

export const TB3_SLIP = {
  // Burger. lin: tb3_lin (0.2 m/s step: ground truth 50 % / 90 % of the speed 0.252 / 0.275 s after the command, odom
  // leads by 0.0218 m) and tb3_stop (after the stop the body still travels 0.0179 m; odom stops at once), fitted
  // together (0.227 / 0.305 s, 0.0221 m, 0.0268 m). ang: tb3_ang (1.0 rad/s step: 50 % / 90 % of the yaw rate after
  // 0.599 / 1.250 s, odom leads by 0.634 rad after 10 s; this model gives 0.596 / 1.263 s, 0.648 rad).
  burger: { lin: { delay: 0.09, tau: 0.02, aMax: 5.0 }, ang: { delay: 0.02, tau: 0.4, aMax: 0.9 } },
  // Waffle Pi. lin: tb3wp_lin / tb3wp_stop (the body follows the wheels within 0.02 s; odom leads by 0.0011 m; the
  // body stops 0.0043 m after the stop). ang: tb3wp_ang (50 % / 90 % after 0.284 / 0.514 s, odom leads by 0.303 rad;
  // this model: 0.303 / 0.545 s, 0.303 rad).
  waffle_pi: { lin: { delay: 0.0, tau: 0.0, aMax: 5.0 }, ang: { delay: 0.0, tau: 0.0, aMax: 1.65 } },
};
// the Waffle has the Waffle Pi's base (same DiffDrive values and wheels; another camera); it was not captured
TB3_SLIP.waffle = TB3_SLIP.waffle_pi;

// "burger" | "waffle" | "waffle_pi" for a model spawned from turtlebot3_gazebo's model.sdf, else null
export function tb3Kind(m) {
  const s = `${m.file || ""} ${m.uri || ""}`;
  const k = (s.match(/turtlebot3_(burger|waffle_pi|waffle)(?:\/model\.sdf)?(?:\s|$)/) || [])[1];
  if (k) return k;
  const t = String(m.sdfText || "").match(/<model\s+name\s*=\s*["']turtlebot3_(burger|waffle_pi|waffle)["']/);
  return t ? t[1] : null;
}

// the body velocities of one TurtleBot3 (state kept on the Gazebo model: m.tb3)
export class Tb3Body {
  constructor(kind) { this.c = TB3_SLIP[kind]; this.v = 0; this.w = 0; this.t = 0; this.hist = [[0, 0, 0]]; }
  // wheel-surface velocities (vw m/s, ww rad/s) held for dt seconds; returns the body's mean velocities over dt
  step(vw, ww, dt) {
    const { lin, ang } = this.c, h = 0.001, n = Math.max(1, Math.round(dt / h)), hh = dt / n;
    const keep = Math.max(lin.delay, ang.delay) + dt + 0.01;
    this.hist.push([this.t, vw, ww]);
    while (this.hist.length > 2 && this.hist[1][0] < this.t - keep) this.hist.shift();
    const at = (t, i) => { let x = this.hist[0][i]; for (const e of this.hist) { if (e[0] <= t + 1e-9) x = e[i]; else break; } return x; };
    const follow = (v, target, c) => { const a = c.tau > 0 ? (target - v) / c.tau : (target - v) / hh; return v + Math.max(-c.aMax, Math.min(c.aMax, a)) * hh; };
    let sv = 0, sw = 0;
    for (let i = 0; i < n; i++) {
      const t = this.t + i * hh;
      this.v = follow(this.v, at(t - lin.delay, 1), lin);
      this.w = follow(this.w, at(t - ang.delay, 2), ang);
      sv += this.v; sw += this.w;
    }
    this.t += dt;
    return { vx: sv / n, wz: sw / n };
  }
  // the base hit something it cannot push: it stops
  blocked() { this.v = 0; this.w = 0; }
}
