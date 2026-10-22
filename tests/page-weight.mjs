// First-load weight of a page: every byte transferred with a cold cache (CDP encodedDataLength), at 1440x900.
// Usage: node tests/page-weight.mjs [page=index.html] [waitMs=6000]   BASE=http://localhost:8080
// Counts what loads before "load" + waitMs (lazy images below the fold stay unloaded unless the page loads them).
import { chromium } from "@playwright/test";
const BASE = process.env.BASE || "http://localhost:8080";
const PAGE = process.argv[2] || "index.html", WAIT = Number(process.argv[3] || 6000);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
const reqs = new Map(); let total = 0;
cdp.on("Network.responseReceived", (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type }));
cdp.on("Network.loadingFinished", (e) => { total += e.encodedDataLength; const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
await page.goto(`${BASE}/${PAGE}`, { waitUntil: "load" });
await page.waitForTimeout(WAIT);
const rows = [...reqs.values()].filter((r) => r.bytes != null);
const byType = {};
for (const r of rows) byType[r.type] = (byType[r.type] || 0) + r.bytes;
console.log(`${PAGE}: ${rows.length} requests, ${(total / 1024).toFixed(1)} KiB (${total} bytes) transferred`);
for (const [t, b] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(12)} ${(b / 1024).toFixed(1)} KiB`);
if (process.env.LIST) for (const r of rows.sort((a, b) => b.bytes - a.bytes)) console.log(`  ${String(r.bytes).padStart(9)}  ${r.url.replace(BASE, "")}`);
await browser.close();
