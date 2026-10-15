import { describe, it, expect } from "vitest";
import { TfBuffer, TransformException } from "../../public/js/tf-buffer.js";

describe("Fixed Frame & TF Registry Parity (Spec S1-S3)", () => {
  it("manages static and dynamic transforms, framesChanged events, and frame lookups", () => {
    const tf = new TfBuffer();

    let lastFrames = [];
    tf.on("framesChanged", (frames) => {
      lastFrames = frames;
    });

    // 1. Add static transform (/tf_static emulation)
    tf.setTransform("odom", "base_footprint", [0, 0, 0], [0, 0, 0, 1], 0, true);
    expect(lastFrames).toContain("odom");
    expect(lastFrames).toContain("base_footprint");

    // 2. Add dynamic transform (/tf emulation)
    tf.setTransform("map", "odom", [1, 2, 0], [0, 0, 0, 1], 1.0, false);
    expect(tf.canTransform("map", "base_footprint")).toBe(true);

    // 3. Lookup transform
    const tx = tf.lookupTransform("map", "base_footprint");
    expect(tx.target_frame).toBe("map");
    expect(tx.source_frame).toBe("base_footprint");
    expect(tx.transform.translation.x).toBe(1);
    expect(tx.transform.translation.y).toBe(2);

    // 4. Unknown frame handling
    expect(tf.canTransform("map", "unknown_sensor")).toBe(false);
    expect(() => tf.lookupTransform("map", "unknown_sensor")).toThrow(TransformException);
  });
});
