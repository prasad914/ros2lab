import { open, pick, run, lastScreen } from "./lib.mjs";
const [r, ...cmds] = process.argv.slice(2);
const { b, p, errs } = await open(); if (r !== "-") await pick(p, r);
for (const c of cmds) { await run(p, c, Number(process.env.W || 900)); }
console.log(await lastScreen(p, Number(process.env.N || 60))); if (errs.length) console.log("ERRS", errs);
await b.close();
