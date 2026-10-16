import { describe, it, expect } from "vitest";
import { TfBuffer, TransformException } from "../public/js/tf-buffer.js";

describe("TfBuffer (tf2_ros::Buffer emulation)", () => {
  it("initializes empty and cannot transform between non-existent frames", () => {
    const tf = new TfBuffer();
    expect(tf.allFrames().length).toBe(0);
    expect(tf.canTransform("map", "odom")).toBe(false);
  });

  it("adds transforms and emits framesChanged event", () => {
    const tf = new TfBuffer();
    let eventFired = false;
    let framesList = [];
    tf.on("framesChanged", (frames) => {
      eventFired = true;
      framesList = frames;
    });

    tf.setTransform("map", "odom", [1.0, 2.0, 0], [0, 0, 0, 1]);
    expect(eventFired).toBe(true);
    expect(tf.allFrames()).toEqual(["map", "odom"]);
    expect(framesList).toEqual(["map", "odom"]);
  });

  it("correctly evaluates canTransform for direct, inverse, and multi-hop paths", () => {
    const tf = new TfBuffer();
    tf.setTransform("map", "odom", [1.0, 2.0, 0], [0, 0, 0, 1]);
    tf.setTransform("odom", "base_footprint", [0.5, 0.5, 0], [0, 0, 0, 1]);
    tf.setTransform("base_footprint", "base_link", [0, 0, 0.1], [0, 0, 0, 1]);
    tf.setTransform("base_link", "base_scan", [0.1, 0, 0.2], [0, 0, 0, 1]);

    expect(tf.canTransform("map", "base_scan")).toBe(true);
    expect(tf.canTransform("base_scan", "map")).toBe(true);
    expect(tf.canTransform("odom", "base_link")).toBe(true);
    expect(tf.canTransform("base_link", "base_link")).toBe(true);
    expect(tf.canTransform("map", "unknown_frame")).toBe(false);
    expect(tf.canTransform("unknown_frame", "map")).toBe(false);
  });

  it("accurately chains multi-hop translations in lookupTransform", () => {
    const tf = new TfBuffer();
    tf.setTransform("map", "odom", [1.0, 2.0, 0], [0, 0, 0, 1]);
    tf.setTransform("odom", "base_footprint", [0.5, 0.5, 0], [0, 0, 0, 1]);
    tf.setTransform("base_footprint", "base_link", [0, 0, 0.1], [0, 0, 0, 1]);
    tf.setTransform("base_link", "base_scan", [0.1, 0, 0.2], [0, 0, 0, 1]);

    const trans = tf.lookupTransform("map", "base_scan");
    expect(trans.target_frame).toBe("map");
    expect(trans.source_frame).toBe("base_scan");
    expect(trans.transform.translation.x).toBeCloseTo(1.6, 5);
    expect(trans.transform.translation.y).toBeCloseTo(2.5, 5);
    expect(trans.transform.translation.z).toBeCloseTo(0.3, 5);
  });

  it("throws TransformException for non-existent frames", () => {
    const tf = new TfBuffer();
    tf.setTransform("map", "odom", [1.0, 2.0, 0], [0, 0, 0, 1]);

    expect(() => {
      tf.lookupTransform("map", "missing_frame");
    }).toThrow(TransformException);

    expect(() => {
      tf.lookupTransform("missing_frame", "odom");
    }).toThrow(TransformException);
  });

  it("supports transient-local /tf_static replay for late subscribers", () => {
    const tf = new TfBuffer();
    tf.setTransform("base_link", "base_scan", [0.1, 0, 0.2], [0, 0, 0, 1], 0, true, "robot_state_publisher");
    tf.setTransform("base_link", "imu_link", [0, 0, 0.1], [0, 0, 0, 1], 0, true, "robot_state_publisher");

    const replayed = [];
    tf.subscribeStatic((edge) => {
      replayed.push(edge);
    });

    expect(replayed.length).toBe(2);
    expect(replayed.map((e) => e.child)).toEqual(["base_scan", "imu_link"]);
  });

  it("detects and records publisher authority conflicts", () => {
    const tf = new TfBuffer();
    tf.setTransform("odom", "base_footprint", [0, 0, 0], [0, 0, 0, 1], 100, false, "ekf_filter_node");
    expect(tf.authorityConflicts.length).toBe(0);

    // Conflicting publisher for the same edge
    tf.setTransform("odom", "base_footprint", [0.1, 0, 0], [0, 0, 0, 1], 101, false, "diff_drive_controller");
    expect(tf.authorityConflicts.length).toBe(1);
    expect(tf.authorityConflicts[0].prevAuthority).toBe("ekf_filter_node");
    expect(tf.authorityConflicts[0].newAuthority).toBe("diff_drive_controller");
  });
});
