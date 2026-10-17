import { test, expect } from "@playwright/test";

test.describe("Playground Readiness and Robot Mission Games (Prompt P12)", () => {
    test("playground page loads and renders game selection and tiles", async ({ page }) => {
        await page.goto("/playground.html");
        await expect(page.locator("h1", { hasText: "Playground" })).toBeVisible();
        const tiles = page.locator(".pg-tile");
        const count = await tiles.count();
        expect(count).toBeGreaterThan(6); // basics + robot missions
    });

    test("readiness and game locking logic in readiness.js and registry.js", async ({ page }) => {
        await page.goto("/playground.html");
        const evaluation = await page.evaluate(async () => {
            const { getRobotReadiness, isGameUnlocked } = await import("./js/games/readiness.js");
            const { getGamesForRobot } = await import("./js/games/registry.js");
            const { FIXTURE_STATUS } = await import("./js/games/fixture-status.js");

            const burgerReady = getRobotReadiness("tb3_burger");
            const waffleReady = getRobotReadiness("tb3_waffle");

            const burgerColorFinder = isGameUnlocked("color_finder", "tb3_burger", ["CAM"]);
            const waffleColorFinder = isGameUnlocked("color_finder", "tb3_waffle", ["CAM"]);
            const dockCheck = isGameUnlocked("dock_it", "tb3_waffle", ["DOCK"]);

            const burgerGames = getGamesForRobot("tb3_burger");
            const waffleGames = getGamesForRobot("tb3_waffle");

            const burgerCF = burgerGames.find(g => g.id === "color_finder");
            const waffleCF = waffleGames.find(g => g.id === "color_finder");
            const dockGame = waffleGames.find(g => g.id === "dock_it");

            return {
                waffleCamFixture: !!FIXTURE_STATUS.robots.tb3_waffle?.CAM?.pass,
                burgerCam: burgerReady.CAM,
                waffleCam: waffleReady.CAM,
                burgerColorFinderUnlocked: burgerColorFinder.unlocked,
                waffleColorFinderUnlocked: waffleColorFinder.unlocked,
                dockUnlocked: dockCheck.unlocked,
                burgerCFUnlocked: burgerCF?.unlocked,
                waffleCFUnlocked: waffleCF?.unlocked,
                dockGameUnlocked: dockGame?.unlocked,
            };
        });

        expect(evaluation.burgerCam).toBe(false);
        // step G: CAM follows the fixture parity tests (fixture-status.js); locked until they all pass
        expect(evaluation.waffleCam).toBe(evaluation.waffleCamFixture);
        expect(evaluation.burgerColorFinderUnlocked).toBe(false);
        expect(evaluation.waffleColorFinderUnlocked).toBe(evaluation.waffleCamFixture);
        expect(evaluation.dockUnlocked).toBe(false);
        expect(evaluation.burgerCFUnlocked).toBe(false);
        expect(evaluation.waffleCFUnlocked).toBe(evaluation.waffleCamFixture);
        expect(evaluation.dockGameUnlocked).toBe(false); // DOCK is PENDING -> locked
    });

    test("locked games show locking reason and stage message", async ({ page }) => {
        await page.goto("/playground.html#color_finder");
        // Since default robot context is burger, colour_finder should show locked stage message
        await page.waitForSelector("#stage");
        const stageText = await page.locator("#stage").innerText();
        expect(stageText).toMatch(/Locked|missing check|Camera works/i);
    });
});
