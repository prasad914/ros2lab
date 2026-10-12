// What Gazebo keeps of a URDF (sdformat's urdf2sdf rules), against the messages libsdformat 14 prints.
import assert from "node:assert/strict";
import { parseURDF } from "../public/js/urdf-core.js";
import { urdfToSdf } from "../public/js/urdf2sdf.js";
const I = (m) => `<inertial><mass value="${m}"/><inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/></inertial>`;
const C = `<collision><geometry><box size="0.2 0.2 0.1"/></geometry></collision>`;
const W = (n, inert = true) => `<link name="${n}">${C}${inert ? I(0.1) : ""}</link>`;
const J = (n, p, c, t = "continuous") => `<joint name="${n}" type="${t}"><parent link="${p}"/><child link="${c}"/><axis xyz="0 1 0"/>${t === "revolute" ? `<limit lower="-1" upper="1" effort="1" velocity="1"/>` : ""}</joint>`;
const run = (body) => { const u = `<robot name="r">${body}</robot>`; return urdfToSdf(parseURDF(u), u); };
let n = 0; const ok = (name, f) => { f(); n++; console.log("ok", name); };

ok("massless base_footprint lumped with base_link: no warning", () => {
  const r = run(`<link name="base_footprint"/><link name="base_link">${C}${I(2)}</link>${J("bf", "base_footprint", "base_link", "fixed")}${W("wl")}${J("wj", "base_link", "wl")}`);
  assert.equal(r.warnings.length, 0); assert.equal(r.dropped.size, 0); assert.ok(r.model.links.wl);
});
ok("wheel without inertial is not modeled", () => {
  const r = run(`<link name="base_link">${C}${I(2)}</link>${W("wl", false)}${J("wj", "base_link", "wl")}${W("wr")}${J("wr_j", "base_link", "wr")}`);
  assert.deepEqual([...r.dropped], ["wl"]);
  assert.equal(r.warnings[0], "Warning [parser_urdf.cc:2774] Error Code 19: Msg: urdf2sdf: link[wl] has no <inertial> block defined. Please ensure this link has a valid mass to prevent any missing links or joints in the resulting SDF model.");
  assert.equal(r.warnings[1], "Error Code 19: Msg: urdf2sdf: parent joint[wj] ignored.");
  assert.equal(r.warnings[2], "Warning [parser_urdf.cc:2777] Error Code 19: Msg: urdf2sdf: link[wl] is not modeled in sdf.");
  assert.ok(!r.model.joints.wj && r.model.joints.wr_j);
});
ok("zero mass link drops its subtree with child counts", () => {
  const r = run(`<link name="base_link">${C}${I(2)}</link><link name="arm">${C}${I(0)}</link>${J("a", "base_link", "arm", "revolute")}${W("h")}${J("hj", "arm", "h", "revolute")}${W("t")}${J("tj", "h", "t", "revolute")}`);
  assert.deepEqual([...r.dropped].sort(), ["arm", "h", "t"]);
  assert.match(r.warnings[0], /a mass value of less than or equal to zero/);
  assert.ok(r.warnings.includes("Error Code 19: Msg: urdf2sdf: [1] child joints ignored.") && r.warnings.includes("Error Code 19: Msg: urdf2sdf: [1] child links ignored."));
});
ok("massless root with moving children: nothing left", () => {
  const r = run(`<link name="base_link"/>${W("wl")}${J("wj", "base_link", "wl")}`);
  assert.equal(r.model, null);
});
ok("preserveFixedJoint keeps a massless link out, with the lumping advice", () => {
  const r = run(`<link name="base_link">${C}${I(2)}</link><link name="cam"/>${J("cj", "base_link", "cam", "fixed")}<gazebo reference="cj"><preserveFixedJoint>true</preserveFixedJoint></gazebo>`);
  assert.deepEqual([...r.dropped], ["cam"]);
  assert.match(r.warnings[1], /allowing joint lumping by removing any <disableFixedJointLumping> or <preserveFixedJoint> gazebo tag on fixed parent joint\[cj\]/);
});
ok("massless sensor link on a fixed joint is lumped (no warning)", () => {
  const r = run(`<link name="base_link">${C}${I(2)}</link><link name="lidar"/>${J("lj", "base_link", "lidar", "fixed")}`);
  assert.equal(r.warnings.length, 0); assert.equal(r.dropped.size, 0);
});
ok("no collisions counted", () => { const r = run(`<link name="base_link">${I(1)}</link>`); assert.equal(r.collisions, 0); });
console.log(`${n} passed`);
