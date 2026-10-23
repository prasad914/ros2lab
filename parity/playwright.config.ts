import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "on-first-retry",
    headless: true,
    // the specs also exercise robots that are under test on the site (public/robots/index.json "status"): open
    // their simulation (robot-info.js underTestOpen). parity/e2e/under-test.spec.ts clears this to test the lock.
    storageState: { cookies: [], origins: ["http://127.0.0.1:8000", "http://localhost:8000", "http://localhost:8080"].map((origin) => ({ origin, localStorage: [{ name: "ros2lab.dev.underTest", value: "open" }] })) },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: true,
    timeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
