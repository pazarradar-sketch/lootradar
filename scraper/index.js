import { scrapeFx } from "./fx.js";
import { scrapeKo } from "./ko.js";
import { scrapeCs2 } from "./cs2.js";
import { writeJson, readJson, log } from "./lib.js";

const what = process.argv[2] || "all";
const meta = readJson("meta.json", {});
const t0 = Date.now();
try {
  if (what === "all" || what === "fx" || what === "ko") { const fx = await scrapeFx(); meta.fx = fx.ts; }
  if (what === "all" || what === "ko") { const ko = await scrapeKo(); meta.ko = ko.ts; }
  if (what === "all" || what === "cs2") { const cs2 = await scrapeCs2({ steamPages: Number(process.env.STEAM_PAGES ?? 30) }); meta.cs2 = cs2.ts; meta.cs2Counts = cs2.counts; }
} finally {
  meta.lastRun = new Date().toISOString(); meta.durationSec = Math.round((Date.now() - t0) / 1000);
  writeJson("meta.json", meta, true);
  log("bitti", meta.durationSec, "sn");
}
