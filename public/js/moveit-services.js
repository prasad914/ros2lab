// MoveIt 2 move_group services and topics reached from the terminal (mixed into RosGraph.prototype):
//   /compute_fk  /compute_ik  /check_state_validity  /get_planning_scene  /apply_planning_scene  /compute_cartesian_path
//   /collision_object (moveit_msgs/msg/CollisionObject: ADD / REMOVE / MOVE boxes, cylinders, spheres)
// The request is the real moveit_msgs service request (checked by ros-iface.js); the answer is computed with the
// same kinematics and collision model the MotionPlanning panel uses.
import { fromQuat, toQuat } from "./moveit-core.js";

const SUCCESS = 1, NO_IK_SOLUTION = -31, INVALID_GROUP_NAME = -15, INVALID_LINK_NAME = -17, FRAME_TRANSFORM_FAILURE = -21;
const prim = { 1: "box", 2: "sphere", 3: "cylinder" };   // shape_msgs/SolidPrimitive: BOX=1 SPHERE=2 CYLINDER=3 (CONE=4)
const poseOf = (T, frame) => { const q = toQuat(T); return { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: frame }, pose: { position: { x: T[3], y: T[7], z: T[11] }, orientation: { x: q[0], y: q[1], z: q[2], w: q[3] } } }; };

export const moveitServiceMethods = {
  mgReady() { return this.mg && this.node(this.mg.node) ? this.mg : null; },
  // joint values from a moveit_msgs/RobotState (empty = the current state, like is_diff)
  mgStateValues(rs) {
    const mg = this.mg, v = { ...mg.current() };
    const js = rs && rs.joint_state;
    if (js && js.name) js.name.forEach((n, i) => { if (js.position[i] !== undefined) v[n] = js.position[i]; });
    return v;
  },
  svcAnswer(name, type, req) {
    const mg = this.mgReady();
    if (!mg || !/^moveit_msgs\/srv\//.test(type)) return null;
    const frame = mg.model.root;
    const RS = (vals) => ({ joint_state: { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: frame }, name: Object.keys(vals), position: Object.values(vals), velocity: [], effort: [] }, is_diff: false });
    if (type === "moveit_msgs/srv/GetPositionFK") {
      const vals = this.mgStateValues(req.robot_state), P = mg.K.fk(vals);
      const links = req.fk_link_names.length ? req.fk_link_names : [];
      const bad = links.find((l) => !P[l]);
      if (bad) return { response: { pose_stamped: [], fk_link_names: [], error_code: { val: INVALID_LINK_NAME, message: "", source: "" } }, note: `(Link '${bad}' is not in the robot model.)` };
      mg.log(`Received request to compute forward kinematics for ${links.join(", ")}`, "INFO", "move_group.moveit.moveit.ros.move_group.fk_service_capability");
      return { response: { pose_stamped: links.map((l) => poseOf(P[l], req.header.frame_id || frame)), fk_link_names: links, error_code: { val: SUCCESS, message: "", source: "" } } };
    }
    if (type === "moveit_msgs/srv/GetPositionIK") {
      const ik = req.ik_request, G = mg.group(ik.group_name);
      if (!G || !G.tip) return { response: { solution: RS({}), error_code: { val: INVALID_GROUP_NAME, message: "", source: "" } }, note: `(Planning groups: ${mg.groupNames().join(", ")})` };
      const ps = ik.pose_stamped, f = ps.header.frame_id || frame;
      if (f !== frame && !mg.K.fk(mg.current())[f]) return { response: { solution: RS({}), error_code: { val: FRAME_TRANSFORM_FAILURE, message: "", source: "" } } };
      const p = ps.pose.position, o = ps.pose.orientation;
      let T = fromQuat([p.x, p.y, p.z], [o.x, o.y, o.z, o.w]);
      if (f !== frame) { const F = mg.K.fk(mg.current())[f]; T = mul(F, T); }
      const seed = this.mgStateValues(ik.robot_state), r = mg.poseToJoints(ik.group_name, T, seed);
      mg.log("Received request to compute IK", "INFO", "move_group.moveit.moveit.ros.move_group.ik_service_capability");
      if (!r.ok) return { response: { solution: RS({}), error_code: { val: r.error === "GOAL_IN_COLLISION" ? -12 : NO_IK_SOLUTION, message: "", source: "" } }, note: `(${r.message})` };
      return { response: { solution: RS({ ...seed, ...r.values }), error_code: { val: SUCCESS, message: "", source: "" } }, note: `(IK solution for ${G.tip}: ${Object.entries(r.values).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(", ")})` };
    }
    if (type === "moveit_msgs/srv/GetStateValidity") {
      const c = mg.stateValid(this.mgStateValues(req.robot_state));
      return { response: { valid: !c, contacts: [], cost_sources: [], constraint_result: [] }, note: c ? `(Not valid: ${c.a || ""} touches ${c.b || "something"})` : "(Valid: no collisions)" };
    }
    if (type === "moveit_msgs/srv/GetPlanningScene") {
      const objs = mg.objects.map((o) => this.mgCollisionMsg(o, frame));
      return { response: { scene: { name: "(noname)+", robot_state: RS(mg.current()), robot_model_name: mg.robot || "", fixed_frame_transforms: [], allowed_collision_matrix: { entry_names: [], entry_values: [], default_entry_names: [], default_entry_values: [] }, link_padding: [], link_scale: [], object_colors: [], world: { collision_objects: objs, octomap: { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: "" }, origin: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } }, octomap: { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: "" }, binary: false, id: "", resolution: 0, data: [] } } }, is_diff: false } }, note: `(${objs.length} collision object${objs.length === 1 ? "" : "s"}: ${mg.objects.map((o) => o.id).join(", ") || "none"})` };
    }
    if (type === "moveit_msgs/srv/ApplyPlanningScene") {
      const n = this.mgApplyObjects(req.scene.world.collision_objects, frame);
      return { response: { success: true }, note: `(Planning scene: ${n} change${n === 1 ? "" : "s"} applied. Objects now: ${mg.objects.map((o) => o.id).join(", ") || "none"})` };
    }
    if (type === "moveit_msgs/srv/GetCartesianPath") {
      if (!req.waypoints.length) return { response: { start_state: RS(mg.current()), solution: emptyTraj(), fraction: 0, error_code: { val: SUCCESS, message: "", source: "" } } };
      const w = req.waypoints[req.waypoints.length - 1], T = fromQuat([w.position.x, w.position.y, w.position.z], [w.orientation.x, w.orientation.y, w.orientation.z, w.orientation.w]);
      const r = mg.cartesianPath({ group: req.group_name, T, eef_step: req.max_step || 0.01, vel: req.max_velocity_scaling_factor || 0.1, acc: req.max_acceleration_scaling_factor || 0.1 });
      const fraction = r.ok ? 1 : r.fraction || 0;
      return { response: { start_state: RS(mg.current()), solution: emptyTraj(), fraction, error_code: { val: SUCCESS, message: "", source: "" } }, note: `(Computed ${(fraction * 100).toFixed(1)} % of the Cartesian path. Execute it from code with /execute_trajectory, or tick "Use Cartesian Path" in RViz.)` };
    }
    return null;
  },
  mgCollisionMsg(o, frame) {
    const T = o.pose, q = toQuat(T), type = { box: 1, sphere: 2, cylinder: 3 }[o.type] || 1;
    return { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: frame }, pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } }, id: o.id, type: { key: "", db: "" },
      primitives: [{ type, dimensions: o.dims }], primitive_poses: [{ position: { x: T[3], y: T[7], z: T[11] }, orientation: { x: q[0], y: q[1], z: q[2], w: q[3] } }], meshes: [], mesh_poses: [], planes: [], plane_poses: [], subframe_names: [], subframe_poses: [], operation: 0 };
  },
  // moveit_msgs/CollisionObject list -> the planning scene (ADD=0, REMOVE=1, APPEND=2, MOVE=3)
  mgApplyObjects(list, frame) {
    const mg = this.mg; let n = 0;
    for (const co of list || []) {
      if (co.operation === 1) { if (co.id) mg.removeObject(co.id); else for (const o of [...mg.objects]) mg.removeObject(o.id); n++; continue; }
      const P0 = co.pose, base = fromQuat([P0.position.x, P0.position.y, P0.position.z], [P0.orientation.x, P0.orientation.y, P0.orientation.z, P0.orientation.w || (P0.orientation.x || P0.orientation.y || P0.orientation.z ? 0 : 1)]);
      const F = co.header.frame_id && co.header.frame_id !== frame ? mg.K.fk(mg.current())[co.header.frame_id] : null;
      if (co.operation === 3) { const o = mg.objects.find((x) => x.id === co.id); if (o) { const pp = co.primitive_poses[0]; if (pp) { o.pose = fromQuat([pp.position.x, pp.position.y, pp.position.z], [pp.orientation.x, pp.orientation.y, pp.orientation.z, pp.orientation.w || 1]); mg.sceneVersion++; mg.emit({ type: "scene" }); n++; } } continue; }
      co.primitives.forEach((pr, i) => {
        const kind = prim[pr.type]; if (!kind) return;
        const pp = co.primitive_poses[i] || { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
        let T = mul(base, fromQuat([pp.position.x, pp.position.y, pp.position.z], [pp.orientation.x, pp.orientation.y, pp.orientation.z, pp.orientation.w || (pp.orientation.x || pp.orientation.y || pp.orientation.z ? 0 : 1)]));
        if (F) T = mul(F, T);
        const dims = kind === "box" ? pr.dimensions.slice(0, 3) : kind === "sphere" ? [pr.dimensions[0]] : [pr.dimensions[0], pr.dimensions[1]];   // cylinder: [height, radius]
        mg.addObject({ id: co.primitives.length > 1 ? `${co.id}_${i}` : co.id, type: kind, dims, pose: T, xyz: [T[3], T[7], T[11]] });
        n++;
      });
    }
    if (n) mg.log(`Planning scene updated (${n} change${n === 1 ? "" : "s"})`, "INFO", "move_group.moveit.moveit.ros.planning_scene_monitor");
    return n;
  },
  mgTopic(topic, type, msg) {
    const mg = this.mgReady(); if (!mg) return null;
    if (topic === "/collision_object" && type === "moveit_msgs/msg/CollisionObject") {
      const n = this.mgApplyObjects([msg], mg.model.root);
      return { note: `(move_group's planning scene monitor applied it: ${n} change${n === 1 ? "" : "s"}. Objects now: ${mg.objects.map((o) => o.id).join(", ") || "none"}. RViz shows them in green; the planners avoid them.)` };
    }
    return null;
  },
};
function mul(A, B) {
  const r = new Array(12);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) r[i * 4 + j] = A[i * 4] * B[j] + A[i * 4 + 1] * B[4 + j] + A[i * 4 + 2] * B[8 + j];
    r[i * 4 + 3] = A[i * 4] * B[3] + A[i * 4 + 1] * B[7] + A[i * 4 + 2] * B[11] + A[i * 4 + 3];
  }
  return r;
}
function emptyTraj() { return { joint_trajectory: { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: "" }, joint_names: [], points: [] }, multi_dof_joint_trajectory: { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: "" }, joint_names: [], points: [] } }; }
