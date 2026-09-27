import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
export const DATA_DIR = path.resolve(process.cwd(), "docs/data");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** HTML/JSON çek; 429'da hemen dur (IP bloğu saatlerce sürebilir). */
export async function get(url, { headers = {}, retries = 2, timeoutMs = 30000, brotli = false } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8", ...(brotli ? { "Accept-Encoding": "br" } : {}), ...headers }, signal: ctl.signal, redirect: "follow" });
      clearTimeout(t);
      if (res.status === 429) throw Object.assign(new Error(`429 ${url}`), { fatal: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // Node fetch (undici) br/gzip'i kendisi açar; açılmamış ham brotli gelirse elle aç.
      try { return zlib.brotliDecompressSync(buf).toString("utf8"); } catch { return buf.toString("utf8"); }
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (e.fatal) throw e;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr;
}

export const getJson = async (url, opts) => JSON.parse(await get(url, opts));

export function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8")); } catch { return fallback; }
}
export function writeJson(name, obj, pretty = false) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, name), pretty ? JSON.stringify(obj, null, 1) : JSON.stringify(obj));
}
export const num = (s) => { if (s == null) return null; const n = Number(String(s).replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : null; };
/** "569,99" veya "569.99" → 569.99 (binlik ayracı yoksa). */
export const numTL = (s) => { if (s == null) return null; let t = String(s).trim().replace(/\s|TL|₺/g, ""); if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", "."); else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); const n = Number(t); return Number.isFinite(n) ? n : null; };
export const nowIso = () => new Date().toISOString();
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
