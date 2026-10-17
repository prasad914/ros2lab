import { describe, it, expect } from "vitest";
import { CHECKS, getRobotReadiness, isGameUnlocked, calculateScore, saveScore, getLeaderboard } from "../../public/js/games/readiness.js";
import { FIXTURE_STATUS } from "../../public/js/games/fixture-status.js";

// Readiness follows the fixture parity tests (parity/compare/readiness_from_fixtures.py): a check is true only when
// the fixture status says it passed; checks without fixture tests are locked.
describe("Playground Readiness and Game Locking (Prompt P12, step G: wired to fixture tests)", () => {
    it("every check equals its fixture test result; unknown robots are fully locked", () => {
        for (const robot of ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"]) {
            const r = getRobotReadiness(robot);
            for (const id of Object.keys(CHECKS)) expect(r[id]).toBe(!!FIXTURE_STATUS.robots[robot]?.[id]?.pass);
        }
        const none = getRobotReadiness("no_such_robot");
        expect(Object.values(none).every((v) => v === false)).toBe(true);
    });

    it("checks without fixture tests stay locked (FIXED_FRAME, FILT, CM, BT, DOCK, NS)", () => {
        for (const robot of ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"]) {
            const r = getRobotReadiness(robot);
            for (const id of ["FIXED_FRAME", "FILT", "CM", "BT", "DOCK", "NS"]) expect(r[id]).toBe(false);
        }
    });

    it("tb3_burger has no camera: CAM is locked and camera games stay locked", () => {
        expect(getRobotReadiness("tb3_burger").CAM).toBe(false);
        const c = isGameUnlocked("color_finder", "tb3_burger", ["CAM"]);
        expect(c.unlocked).toBe(false);
        expect(c.missingCheck).toBe("CAM");
    });

    it("locks docking and relay games for all TB3 models because their checks are PENDING", () => {
        const dockCheck = isGameUnlocked("dock_it", "tb3_waffle", ["DOCK"]);
        expect(dockCheck.unlocked).toBe(false);
        expect(dockCheck.missingCheck).toBe("DOCK");

        const relayCheck = isGameUnlocked("relay", "tb3_waffle", ["NS"]);
        expect(relayCheck.unlocked).toBe(false);
        expect(relayCheck.missingCheck).toBe("NS");
    });

    it("calculates score correctly based on time and penalties", () => {
        const score1 = calculateScore(1000, 5000, 2); // 5000ms = 50 penalty, 2 penalties * 50 = 100 penalty => 850
        expect(score1).toBe(850);

        const score2 = calculateScore(500, 100000, 10); // clamped at 0
        expect(score2).toBe(0);
    });

    it("persists leaderboard entries locally", () => {
        const gameId = "test_game_" + Date.now();
        const entry = { name: "TestBot", score: 950, time: 2000 };
        const lb = saveScore(gameId, entry);
        expect(lb.length).toBe(1);
        expect(lb[0].name).toBe("TestBot");

        const fetched = getLeaderboard(gameId);
        expect(fetched.length).toBe(1);
        expect(fetched[0].score).toBe(950);
    });
});
