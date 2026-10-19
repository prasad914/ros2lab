import { TfBuffer, TransformException } from "../public/js/tf-buffer.js";
import assert from "node:assert";

console.log("=== Testing TfBuffer Module ===");

const tf = new TfBuffer();

let eventFired = false;
tf.on("framesChanged", (frames) => {
  eventFired = true;
});

// 1. Initial state
assert.strictEqual(tf.allFrames().length, 0);
assert.strictEqual(tf.canTransform("map", "odom"), false);

// 2. Add edges: map -> odom -> base_footprint -> base_link -> base_scan
tf.setTransform("map", "odom", [1.0, 2.0, 0], [0, 0, 0, 1]);
assert.strictEqual(eventFired, true, "framesChanged event fired on new transform");
assert.deepStrictEqual(tf.allFrames(), ["map", "odom"]);

tf.setTransform("odom", "base_footprint", [0.5, 0.5, 0], [0, 0, 0, 1]);
tf.setTransform("base_footprint", "base_link", [0, 0, 0.1], [0, 0, 0, 1]);
tf.setTransform("base_link", "base_scan", [0.1, 0, 0.2], [0, 0, 0, 1]);

// 3. canTransform tests
assert.strictEqual(tf.canTransform("map", "base_scan"), true, "canTransform map -> base_scan");
assert.strictEqual(tf.canTransform("base_scan", "map"), true, "canTransform base_scan -> map (inverse)");
assert.strictEqual(tf.canTransform("map", "unknown_frame"), false, "canTransform unknown frame returns false");
assert.strictEqual(tf.canTransform("base_link", "base_link"), true, "canTransform self is true");

// 4. lookupTransform tests
const trans = tf.lookupTransform("map", "base_scan");
assert.strictEqual(trans.target_frame, "map");
assert.strictEqual(trans.source_frame, "base_scan");
// Expected total translation: [1.0 + 0.5 + 0 + 0.1, 2.0 + 0.5 + 0 + 0, 0 + 0 + 0.1 + 0.2] = [1.6, 2.5, 0.3]
assert(Math.abs(trans.transform.translation.x - 1.6) < 1e-6, "x translation matches");
assert(Math.abs(trans.transform.translation.y - 2.5) < 1e-6, "y translation matches");
assert(Math.abs(trans.transform.translation.z - 0.3) < 1e-6, "z translation matches");

// 5. Exception tests
assert.throws(() => {
  tf.lookupTransform("map", "missing_frame");
}, TransformException, "throws TransformException for missing frame");

console.log("All TfBuffer unit tests passed successfully!");
