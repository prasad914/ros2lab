import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DOCTOR_PASSED_LINES } from "../../public/js/doctor-text.js";

// The real capture from `ros2 doctor` on this machine. Its UserWarning lines depend on the
// installed package versions, so only the final, non-warning lines are compared.
const capture = readFileSync(new URL("../fixtures/_installed/ros2_doctor.txt", import.meta.url), "utf8");

describe("ros2 doctor emulator text matches the real capture", () => {
    it("the capture contains a checks-passed summary", () => {
        expect(capture).toMatch(/All \d+ checks passed/);
    });

    it("the emulator's summary lines equal the capture's blank line and summary", () => {
        // The capture also has two empty lines after the summary. Their source (the command or
        // the capture script) is not known, so only the blank line and summary before them are compared.
        const nonWarning = capture.split("\n").filter((l) => !l.includes("UserWarning"));
        const at = nonWarning.findLastIndex((l) => /^All \d+ checks passed$/.test(l));
        expect(at).toBeGreaterThan(0);
        expect(nonWarning.slice(at - 1, at + 1)).toEqual(DOCTOR_PASSED_LINES);
    });
});
