import { describe, it, expect } from "vitest";
import { getRobotReadiness, isGameUnlocked, calculateScore, saveScore, getLeaderboard } from "../../public/js/games/readiness.js";

describe("Playground Readiness and Game Locking (Prompt P12)", () => {
    it("evaluates correct readiness checks per robot (tb3_burger has no camera)", () => {
        const burgerReadiness = getRobotReadiness("tb3_burger");
        const waffleReadiness = getRobotReadiness("tb3_waffle");

        expect(burgerReadiness.TF).toBe(true);
        expect(burgerReadiness.SLAM).toBe(true);
        expect(burgerReadiness.CAM).toBe(false); // burger has no camera
        expect(burgerReadiness.DOCK).toBe(false); // pending

        expect(waffleReadiness.CAM).toBe(true); // waffle has camera
        expect(waffleReadiness.DOCK).toBe(false); // pending
    });

    it("locks camera games for tb3_burger and unlocks them for tb3_waffle", () => {
        const burgerColorFinder = isGameUnlocked("color_finder", "tb3_burger", ["CAM"]);
        const waffleColorFinder = isGameUnlocked("color_finder", "tb3_waffle", ["CAM"]);

        expect(burgerColorFinder.unlocked).toBe(false);
        expect(burgerColorFinder.missingCheck).toBe("CAM");

        expect(waffleColorFinder.unlocked).toBe(true);
        expect(waffleColorFinder.missingCheck).toBeNull();
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
