import { TfBuffer, TransformException } from "../public/js/tf-buffer.js";
import { describe, it, expect } from "vitest";

describe("TfBuffer Module", () => {
  it("manages frames and computes transforms correctly", () => {
    const tf = new TfBuffer();

    let eventFired = false;
    tf.on("framesChanged", (frames) => {
      eventFired = true;
    });

    // 1. Initial state
    expect(tf.allFrames().length).toBe(0);
    expect(tf.canTransform("map", "odom")).toBe(false);

    // 2. Add edges: map -> odom -> base_footprint -> base_link -> base_scan
    tf.setTransform("map", "odom", [1.0, 2.0, 0], [0, 0, 0, 1]);
    expect(eventFired).toBe(true);
    expect(tf.allFrames()).toEqual(["map", "odom"]);

    tf.setTransform("odom", "base_footprint", [0.5, 0.5, 0], [0, 0, 0, 1]);
    tf.setTransform("base_footprint", "base_link", [0, 0, 0.1], [0, 0, 0, 1]);
    tf.setTransform("base_link", "base_scan", [0.1, 0, 0.2], [0, 0, 0, 1]);

    // 3. canTransform tests
    expect(tf.canTransform("map", "base_scan")).toBe(true);
    expect(tf.canTransform("base_scan", "map")).toBe(true);
    expect(tf.canTransform("map", "unknown_frame")).toBe(false);
    expect(tf.canTransform("base_link", "base_link")).toBe(true);

    // 4. lookupTransform tests
    const trans = tf.lookupTransform("map", "base_scan");
    expect(trans.target_frame).toBe("map");
    expect(trans.source_frame).toBe("base_scan");
    expect(Math.abs(trans.transform.translation.x - 1.6)).toBeLessThan(1e-6);
    expect(Math.abs(trans.transform.translation.y - 2.5)).toBeLessThan(1e-6);
    expect(Math.abs(trans.transform.translation.z - 0.3)).toBeLessThan(1e-6);

    // 5. Exception tests
    expect(() => {
      tf.lookupTransform("map", "missing_frame");
    }).toThrow(TransformException);
  });
});
