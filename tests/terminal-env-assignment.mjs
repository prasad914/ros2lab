import assert from "node:assert/strict";
import { Shell } from "../public/js/terminal-sim.js";

const shell = new Shell();
shell.run("export KEEP=exported");
const result = shell.run("LOCAL=value printenv LOCAL");
assert.deepEqual(result.lines.map(({ text }) => text), ["value"]);
assert.equal(shell.env.LOCAL, undefined, "command-scoped assignment must not persist");
assert.equal(shell.env.KEEP, "exported", "export behavior must remain unchanged");
