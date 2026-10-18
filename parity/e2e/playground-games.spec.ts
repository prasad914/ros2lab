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
        expect(evaluation.waffleCFUnlocked).toBe(false); // placeholder mission game: "Not yet validated" (must-fix 2)
        expect(evaluation.dockGameUnlocked).toBe(false); // DOCK is PENDING -> locked
    });

    test("locked games show locking reason and stage message", async ({ page }) => {
        await page.goto("/playground.html#color_finder");
        // Since default robot context is burger, colour_finder should show locked stage message
        await page.waitForSelector("#stage");
        const stageText = await page.locator("#stage").innerText();
        expect(stageText).toMatch(/Locked|missing check|Camera works/i);
    });

    // expert_review_2026-10-18 must-fix 2: the robot mission games are placeholders (no real game yet), so they are
    // locked as "Not yet validated" for every robot and never load the cd folder game or award a badge
    test("robot mission games are locked as Not yet validated", async ({ page }) => {
        await page.goto("/playground.html");
        const r = await page.evaluate(async () => {
            const { GAMES, getGamesForRobot } = await import("./js/games/registry.js");
            const missions = GAMES.filter((g: any) => g.track === "robots");
            const per = ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"].flatMap((id) => getGamesForRobot(id).filter((g: any) => g.track === "robots").map((g: any) => ({ id: g.id, robot: id, unlocked: g.unlocked, why: g.lockReason })));
            return { n: missions.length, loaders: missions.filter((g: any) => g.load).map((g: any) => g.id), per };
        });
        expect(r.n).toBe(15);
        expect(r.loaders).toEqual([]);
        for (const g of r.per) { expect(g.unlocked, `${g.robot} ${g.id}`).toBe(false); expect(g.why).toBe("Not yet validated"); }
        for (const id of ["tf_detective", "mapping_race", "kidnapped_robot", "teleop_trial"]) {
            await page.goto(`/playground.html#${id}`);
            await expect(page.locator("#stage")).toContainText("Not yet validated");
            await expect(page.locator("#stage")).not.toContainText("cd command");
        }
        await expect(page.locator(".pg-intro")).toContainText("15 robot missions after them are locked");
        const tile = page.locator('.pg-tile[href="#tf_detective"]');
        await expect(tile).toContainText("Not yet validated");
    });
});
