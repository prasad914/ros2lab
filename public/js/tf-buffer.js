// ROS 2 Jazzy TF2 Buffer Module (tf2_ros::Buffer emulation)
// Implements lookupTransform, canTransform, frame tree queries, and change events.
import { framePoses } from "./urdf-core.js";

const IDENT = { t: [0, 0, 0], q: [0, 0, 0, 1] };

export class TransformException extends Error {
  constructor(message) {
    super(message);
    this.name = "TransformException";
  }
}

export class TfBuffer {
  constructor(opts = {}) {
    this.cacheTime = opts.cacheTime || 10.0;
    this.edgeMap = new Map(); // key: `${parent}->${child}`
    this.listeners = new Map(); // event -> Set<Function>
    this._frameCache = null;
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

  setTransform(parent, child, t = [0, 0, 0], q = [0, 0, 0, 1], time = 0, isStatic = false) {
    if (!parent || !child) return false;
    const cleanP = String(parent).replace(/^\//, "");
    const cleanC = String(child).replace(/^\//, "");
    const key = `${cleanP}->${cleanC}`;
    const prev = this.edgeMap.get(key);

    const isNew = !prev;
    this.edgeMap.set(key, {
      parent: cleanP,
      child: cleanC,
      t: [Number(t[0] || 0), Number(t[1] || 0), Number(t[2] || 0)],
      q: [Number(q[0] || 0), Number(q[1] || 0), Number(q[2] || 0), Number(q[3] ?? 1)],
      time: time || Date.now() / 1000,
      static: !!isStatic
    });

    if (isNew) {
      this._frameCache = null;
      this.emit("framesChanged", this.allFrames());
    }
    return true;
  }

  clear() {
    this.edgeMap.clear();
    this._frameCache = null;
    this.emit("framesChanged", []);
  }

  edges() {
    return [...this.edgeMap.values()];
  }

  allFrames() {
    if (this._frameCache) return this._frameCache;
    const set = new Set();
    for (const e of this.edgeMap.values()) {
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
}
