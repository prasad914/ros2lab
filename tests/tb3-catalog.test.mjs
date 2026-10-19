import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(path.join(root, "public/robots/index.json"), "utf8"));
const robot = catalog.find(({ id }) => id === "tb3_waffle_pi");

assert.ok(robot, "tb3_waffle_pi direct URL must resolve to a catalog robot");
assert.equal(robot.category, "mobile");
assert.equal(robot.title, "TurtleBot3 Waffle Pi");
assert.equal(robot.pkg, "turtlebot3_description");
assert.equal(robot.file, "ws/turtlebot3/src/turtlebot3/turtlebot3_description/urdf/turtlebot3_waffle_pi.urdf");
assert.ok(readFileSync(path.join(root, "public/robots", robot.file), "utf8").includes('<robot name="turtlebot3_waffle_pi"'));
assert.equal(robot.fixedFrame, "base_footprint");
