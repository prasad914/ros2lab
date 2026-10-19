// ROS 2 Jazzy RViz FrameManager (rviz_common::FrameManager emulation)
// Centralizes coordinate frame transforms, status diagnostics, and fixedFrame synchronization.

export class FrameManager {
  constructor(tfBuffer, initialFixedFrame = "map", opts = {}) {
    this.tf = tfBuffer;
    this.robotId = opts.robotId || "";

    // Load persisted frame from localStorage if available
    let persisted = "";
    if (typeof localStorage !== "undefined") {
      try {
        const key = this.robotId ? `ros2lab.fixed_frame.${this.robotId}` : "ros2lab.fixed_frame.default";
        persisted = localStorage.getItem(key) || "";
      } catch (e) {
        // Ignore storage errors in private browsing
      }
    }

    this._fixedFrame = String(persisted || initialFixedFrame || "map").replace(/^\//, "");
    this.listeners = new Set();

    // Re-dispatch on TF buffer topology changes
    if (this.tf && typeof this.tf.on === "function") {
      this.tf.on("framesChanged", (frames) => {
        this.emitChange();
      });
    }
  }

  get fixedFrame() {
    return this._fixedFrame;
  }

  setFixedFrame(frame) {
    const clean = String(frame || "").trim().replace(/^\//, "");
    if (!clean) return false;
    if (clean === this._fixedFrame) return false;
    this._fixedFrame = clean;

    // Persist to localStorage per robot/lesson
    if (typeof localStorage !== "undefined") {
      try {
        const key = this.robotId ? `ros2lab.fixed_frame.${this.robotId}` : "ros2lab.fixed_frame.default";
        localStorage.setItem(key, clean);
      } catch (e) {
        // Ignore quota/private mode errors
      }
    }

    this.emitChange();
    return true;
  }

  getAllFrameNames() {
    return this.tf ? this.tf.getAllFrameNames() : [];
  }

  hasFrame(frame) {
    if (!this.tf) return false;
    const clean = String(frame || "").replace(/^\//, "");
    return this.tf.hasFrame(clean);
  }

  canTransform(sourceFrame, targetFrame = this._fixedFrame, time = 0) {
    if (!this.tf) return false;
    return this.tf.canTransform(targetFrame, sourceFrame, time);
  }

  lookupTransform(sourceFrame, targetFrame = this._fixedFrame, time = 0) {
    if (!this.tf) {
      throw new Error("No TF buffer available");
    }
    return this.tf.lookupTransform(targetFrame, sourceFrame, time);
  }

  // Returns { ok: boolean, pose?: {t, q}, level?: "ok"|"warn"|"error", error?: string }
  transform(sourceFrame, time = 0) {
    const s = String(sourceFrame || this._fixedFrame).replace(/^\//, "");
    const target = this._fixedFrame;

    // Check if target frame exists in TF
    if (!this.hasFrame(target)) {
      const edges = this.tf ? this.tf.edges() : [];
      const errorMsg = edges.length > 0
        ? `Fixed Frame [${target}] does not exist`
        : `No tf data.  Actual error: Frame [${target}] does not exist`;
      return {
        ok: false,
        level: edges.length > 0 ? "error" : "warn",
        error: errorMsg
      };
    }

    if (s === target) {
      return {
        ok: true,
        level: "ok",
        pose: { t: [0, 0, 0], q: [0, 0, 0, 1] }
      };
    }

    if (!this.hasFrame(s)) {
      return {
        ok: false,
        level: "error",
        error: `Could not transform from [${s}] to Fixed Frame [${target}]`
      };
    }

    try {
      const res = this.tf.lookupTransform(target, s, time);
      const tr = res.transform;
      return {
        ok: true,
        level: "ok",
        pose: {
          t: [tr.translation.x, tr.translation.y, tr.translation.z],
          q: [tr.rotation.x, tr.rotation.y, tr.rotation.z, tr.rotation.w]
        }
      };
    } catch (e) {
      return {
        ok: false,
        level: "error",
        error: `Could not transform from [${s}] to Fixed Frame [${target}]`
      };
    }
  }

  // Global status diagnostic string
  getGlobalStatus() {
    const target = this._fixedFrame;
    if (!this.hasFrame(target)) {
      const edges = this.tf ? this.tf.edges() : [];
      return edges.length > 0
        ? ["error", `Fixed Frame [${target}] does not exist`]
        : ["warn", `No tf data.  Actual error: Frame [${target}] does not exist`];
    }
    return ["ok", "OK"];
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emitChange() {
    for (const fn of this.listeners) {
      try { fn(this._fixedFrame); } catch (e) { console.error(e); }
    }
  }
}
