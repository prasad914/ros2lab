// ROS 2 Jazzy TF2 Buffer Module (tf2_ros::Buffer emulation)
// Implements static + dynamic buffers, authority conflict tracking,
// getAllFrameNames, canTransform, lookupTransform, framesChanged events,
// and transient-local replay of /tf_static for late subscribers.
import { parseURDF, urdfEdges, framePoses } from "./urdf-core.js";

const IDENT = { t: [0, 0, 0], q: [0, 0, 0, 1] };

export class TransformException extends Error {
  constructor(message) {
    super(message);
    this.name = "TransformException";
  }
}

const BUILTIN_ROBOT_TREES = {
  tb3_burger: [
    { parent: "base_footprint", child: "base_link", t: [0, 0, 0.01], q: [0, 0, 0, 1], static: true },
    { parent: "base_link", child: "base_scan", t: [-0.032, 0, 0.172], q: [0, 0, 0, 1], static: true },
    { parent: "base_link", child: "imu_link", t: [-0.032, 0, 0.068], q: [0, 0, 0, 1], static: true },
    { parent: "base_link", child: "wheel_left_link", t: [0, 0.08, 0.023], q: [0, 0, 0, 1], static: false },
    { parent: "base_link", child: "wheel_right_link", t: [0, -0.08, 0.023], q: [0, 0, 0, 1], static: false },
    { parent: "base_link", child: "caster_back_link", t: [-0.081, 0, 0.004], q: [0, 0, 0, 1], static: true },
    { parent: "odom", child: "base_footprint", t: [0, 0, 0], q: [0, 0, 0, 1], static: false }
  ],
  tb3_waffle: [
    { parent: "base_footprint", child: "base_link", t: [0, 0, 0.01], q: [0, 0, 0, 1], static: true },
    { parent: "base_link", child: "base_scan", t: [-0.064, 0, 0.122], q: [0, 0, 0, 1], static: true },
    { parent: "base_link", child: "imu_link", t: [0, 0, 0.068], q: [0, 0, 0, 1], static: true },
    { parent: "base_link", child: "wheel_left_link", t: [0, 0.144, 0.023], q: [0, 0, 0, 1], static: false },
    { parent: "base_link", child: "wheel_right_link", t: [0, -0.144, 0.023], q: [0, 0, 0, 1], static: false },
    { parent: "base_link", child: "caster_back_right_link", t: [-0.177, -0.064, -0.004], q: [-0.706825, 0, 0, 0.707388], static: true },
    { parent: "base_link", child: "caster_back_left_link", t: [-0.177, 0.064, -0.004], q: [-0.706825, 0, 0, 0.707388], static: true },
    { parent: "base_link", child: "camera_link", t: [0.064, -0.065, 0.094], q: [0, 0, 0, 1], static: true },
    { parent: "camera_link", child: "camera_rgb_frame", t: [0, 0.02, 0], q: [0, 0, 0, 1], static: true },
    { parent: "camera_rgb_frame", child: "camera_rgb_optical_frame", t: [0, 0, 0], q: [-0.5, 0.5, -0.5, 0.5], static: true },
    { parent: "camera_link", child: "camera_depth_frame", t: [0, 0.045, 0], q: [0, 0, 0, 1], static: true },
    { parent: "camera_depth_frame", child: "camera_depth_optical_frame", t: [0, 0, 0], q: [-0.5, 0.5, -0.5, 0.5], static: true },
    { parent: "odom", child: "base_footprint", t: [0, 0, 0], q: [0, 0, 0, 1], static: false }
  ],
  tb3_waffle_pi: [
    { parent: "base_footprint", child: "base_link", t: [0, 0, 0.01], q: [0, 0, 0, 1], static: true },
    { parent: "base_link", child: "base_scan", t: [-0.064, 0, 0.122], q: [0, 0, 0, 1], static: true },
    { parent: "base_link", child: "imu_link", t: [0, 0, 0.068], q: [0, 0, 0, 1], static: true },
    { parent: "base_link", child: "wheel_left_link", t: [0, 0.144, 0.023], q: [0, 0, 0, 1], static: false },
    { parent: "base_link", child: "wheel_right_link", t: [0, -0.144, 0.023], q: [0, 0, 0, 1], static: false },
    { parent: "base_link", child: "caster_back_right_link", t: [-0.177, -0.064, -0.004], q: [-0.706825, 0, 0, 0.707388], static: true },
    { parent: "base_link", child: "caster_back_left_link", t: [-0.177, 0.064, -0.004], q: [-0.706825, 0, 0, 0.707388], static: true },
    { parent: "base_link", child: "camera_link", t: [0.073, -0.011, 0.084], q: [0, 0, 0, 1], static: true },
    { parent: "camera_link", child: "camera_rgb_frame", t: [0.003, 0.011, 0.009], q: [0, 0, 0, 1], static: true },
    { parent: "camera_rgb_frame", child: "camera_rgb_optical_frame", t: [0, 0, 0], q: [-0.5, 0.5, -0.5, 0.5], static: true },
    { parent: "odom", child: "base_footprint", t: [0, 0, 0], q: [0, 0, 0, 1], static: false }
  ]
};

export class TfBuffer {
  constructor(opts = {}) {
    this.cacheTime = opts.cacheTime || 10.0;
    this.staticEdges = new Map();  // latched /tf_static edges (${parent}->${child})
    this.dynamicEdges = new Map(); // dynamic /tf edges (${parent}->${child})
    this.listeners = new Map();    // event -> Set<Function>
    this.authorityConflicts = [];  // record authority conflicts
    this._frameCache = null;

    if (opts.robotId) {
      this.initForRobot(opts.robotId);
    }
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const s = this.listeners.get(event);
    if (s) s.delete(fn);
  }

  emit(event, data) {
    const s = this.listeners.get(event);
    if (s) for (const fn of s) { try { fn(data); } catch (e) { console.error(e); } }
  }

  setTransform(parent, child, t = [0, 0, 0], q = [0, 0, 0, 1], time = 0, isStatic = false, authority = "") {
    if (!parent || !child) return false;
    const cleanP = String(parent).replace(/^\//, "");
    const cleanC = String(child).replace(/^\//, "");
    const key = `${cleanP}->${cleanC}`;

    const targetMap = isStatic ? this.staticEdges : this.dynamicEdges;
    const otherMap = isStatic ? this.dynamicEdges : this.staticEdges;
    const prev = targetMap.get(key) || otherMap.get(key);

    // Authority conflict tracking
    if (prev && prev.authority && authority && prev.authority !== authority && !prev.static && !isStatic) {
      this.authorityConflicts.push({
        parent: cleanP,
        child: cleanC,
        prevAuthority: prev.authority,
        newAuthority: authority,
        time: time || Date.now() / 1000
      });
    }

    const isNew = !prev;
    const edge = {
      parent: cleanP,
      child: cleanC,
      t: [Number(t[0] || 0), Number(t[1] || 0), Number(t[2] || 0)],
      q: [Number(q[0] || 0), Number(q[1] || 0), Number(q[2] || 0), Number(q[3] ?? 1)],
      time: time || Date.now() / 1000,
      static: !!isStatic,
      authority: authority || prev?.authority || (isStatic ? "static_transform_publisher" : "default_authority")
    };

    targetMap.set(key, edge);

    if (isStatic) {
      this.emit("staticTransform", edge);
    }

    if (isNew) {
      this._frameCache = null;
      this.emit("framesChanged", this.allFrames());
    }
    return true;
  }

  // Transient-local QoS replay of /tf_static for late subscribers
  subscribeStatic(callback) {
    if (typeof callback !== "function") return () => {};
    // Immediately replay all cached static transforms
    for (const edge of this.staticEdges.values()) {
      try { callback(edge); } catch (e) { console.error(e); }
    }
    return this.on("staticTransform", callback);
  }

  getStaticTransforms() {
    return [...this.staticEdges.values()];
  }

  getAllFrameNames() {
    return this.allFrames();
  }

  get authority() {
    const map = {};
    for (const e of [...this.staticEdges.values(), ...this.dynamicEdges.values()]) {
      if (e.authority) {
        map[e.child] = e.authority;
        map[`${e.parent}->${e.child}`] = e.authority;
      }
    }
    return map;
  }

  clear() {
    this.staticEdges.clear();
    this.dynamicEdges.clear();
    this.authorityConflicts = [];
    this._frameCache = null;
    this.emit("framesChanged", []);
  }

  edges() {
    // Dynamic edges overwrite static edges with same key
    const map = new Map(this.staticEdges);
    for (const [k, v] of this.dynamicEdges) {
      map.set(k, v);
    }
    return [...map.values()];
  }

  allFrames() {
    if (this._frameCache) return this._frameCache;
    const set = new Set();
    for (const e of this.edges()) {
      set.add(e.parent);
      set.add(e.child);
    }
    this._frameCache = [...set].sort();
    return this._frameCache;
  }

  hasFrame(frame) {
    if (!frame) return false;
    const clean = String(frame).replace(/^\//, "");
    return this.allFrames().includes(clean);
  }

  canTransform(targetFrame, sourceFrame, time = 0) {
    if (!targetFrame || !sourceFrame) return false;
    const t = String(targetFrame).replace(/^\//, "");
    const s = String(sourceFrame).replace(/^\//, "");
    if (t === s) return true;
    if (!this.hasFrame(t) || !this.hasFrame(s)) return false;
    const res = framePoses(this.edges(), t);
    return !!(res.poses && res.poses[s]);
  }

  lookupTransform(targetFrame, sourceFrame, time = 0) {
    if (!targetFrame || !sourceFrame) {
      throw new TransformException("target_frame and source_frame must be non-empty strings");
    }
    const t = String(targetFrame).replace(/^\//, "");
    const s = String(sourceFrame).replace(/^\//, "");

    if (t === s) {
      return {
        target_frame: t,
        source_frame: s,
        transform: {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 }
        }
      };
    }

    if (!this.hasFrame(t)) {
      throw new TransformException(`Target frame [${t}] does not exist in TF tree`);
    }
    if (!this.hasFrame(s)) {
      throw new TransformException(`Source frame [${s}] does not exist in TF tree`);
    }

    const res = framePoses(this.edges(), t);
    if (!res.poses || !res.poses[s]) {
      throw new TransformException(`Cannot transform from [${s}] to [${t}]: frames are in disconnected subtrees`);
    }

    const P = res.poses[s];
    return {
      target_frame: t,
      source_frame: s,
      transform: {
        translation: { x: P.t[0], y: P.t[1], z: P.t[2] },
        rotation: { x: P.q[0], y: P.q[1], z: P.q[2], w: P.q[3] }
      }
    };
  }

  poses(fixedFrame) {
    const f = String(fixedFrame || "map").replace(/^\//, "");
    return framePoses(this.edges(), f);
  }

  initFromUrdf(urdfText, robotId = "") {
    if (!urdfText) return false;
    try {
      const model = parseURDF(urdfText);
      const edges = urdfEdges(model, {}, true);
      for (const e of edges) {
        this.setTransform(e.parent, e.child, e.t, e.q, 0, true, "robot_state_publisher");
      }
      const rLower = String(robotId || model.name || "").toLowerCase();
      const isMobile = rLower.includes("tb3") || rLower.includes("burger") || rLower.includes("waffle") || rLower.includes("scout") || rLower.includes("turtlebot");
      if (isMobile) {
        const rootLink = model.root || (this.hasFrame("base_footprint") ? "base_footprint" : "base_link");
        this.setTransform("odom", rootLink, [0, 0, 0], [0, 0, 0, 1], 0, false, "diff_drive_controller");
      }
      return true;
    } catch (e) {
      console.warn("initFromUrdf warning:", e);
      return false;
    }
  }

  initForRobot(robotId = "") {
    const rid = String(robotId || "").toLowerCase();
    const key = rid.includes("burger") ? "tb3_burger" : rid.includes("waffle_pi") ? "tb3_waffle_pi" : rid.includes("waffle") ? "tb3_waffle" : "";
    const tree = BUILTIN_ROBOT_TREES[key];
    if (tree) {
      for (const e of tree) {
        this.setTransform(e.parent, e.child, e.t, e.q, 0, e.static, e.static ? "robot_state_publisher" : "diff_drive_controller");
      }
      return true;
    }
    return false;
  }
}
