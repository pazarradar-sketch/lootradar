// Yerel mod: siteyi sun + her saat başı verileri topla (GitHub Actions olmadan da geçmiş birikir).
import { spawn } from "node:child_process";
import "./serve.js";
const EVERY = Number(process.env.EVERY_MIN || 60) * 60e3;
let running = false;
function run() {
  if (running) return; running = true;
  const t0 = Date.now();
  const p = spawn(process.execPath, ["scraper/index.js", "all"], { stdio: "inherit", env: { ...process.env, STEAM_PAGES: process.env.STEAM_PAGES || "30" } });
  p.on("exit", (c) => { running = false; console.log(new Date().toISOString(), "toplama bitti, kod", c, Math.round((Date.now() - t0) / 1000), "sn"); });
}
const first = Number(process.env.FIRST_DELAY_MIN ?? 55) * 60e3; // ilk çalışma
setTimeout(() => { run(); setInterval(run, EVERY); }, first);
console.log(`daemon: her ${EVERY / 60e3} dk toplama, ilk ${first / 60e3} dk sonra`);
