import { scrapeFx } from "./fx.js";
import { scrapeKo } from "./ko.js";
import { scrapeCs2 } from "./cs2.js";
import { buildKoTrends } from "./trends.js";
import { snapshotCs2History, buildCs2Signals } from "./cs2history.js";
import { scrapeTr } from "./tr.js";
import { writeJson, readJson, log } from "./lib.js";

const what = process.argv[2] || "all";
const meta = readJson("meta.json", {});
const t0 = Date.now();
try {
  if (what === "all" || what === "fx" || what === "ko") { const fx = await scrapeFx(); meta.fx = fx.ts; }
  if (what === "all" || what === "ko") { const ko = await scrapeKo(); meta.ko = ko.ts; }
  if (what === "all" || what === "ko" || what === "trends") { try { buildKoTrends(); } catch (e) { log("ko_trends hata", e.message); } }
  if (what === "all" || what === "cs2") { const cs2 = await scrapeCs2({ steamPages: Number(process.env.STEAM_PAGES ?? 30) }); meta.cs2 = cs2.ts; meta.cs2Counts = cs2.counts; }
  if (what === "all" || what === "cs2" || what === "signals") { try { snapshotCs2History(); buildCs2Signals(); } catch (e) { log("cs2 sinyal hata", e.message); } }
  if (what === "all" || what === "tr") { try { const tr = await scrapeTr(); meta.tr = tr.ts; meta.trCounts = { itemsatis: tr.sources.itemsatis?.matched ?? 0, bynogame: tr.sources.bynogame?.matched ?? 0 }; } catch (e) { log("tr hata", e.message); } }
} finally {
  meta.lastRun = new Date().toISOString(); meta.durationSec = Math.round((Date.now() - t0) / 1000);
  writeJson("meta.json", meta, true);
  log("bitti", meta.durationSec, "sn");
}
