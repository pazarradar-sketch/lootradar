// GitHub Actions secret'larını .env'den yükler: node scripts/gh-secrets.mjs NAME1 NAME2 ...
import fs from "node:fs";
import sodium from "libsodium-wrappers";
const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const { GITHUB_TOKEN: tok, GITHUB_USER: user } = env; const repo = `${user}/pazar-radar`;
const gh = (p, o = {}) => fetch(`https://api.github.com/repos/${repo}${p}`, { ...o, headers: { Authorization: `token ${tok}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", ...(o.headers || {}) } });
await sodium.ready;
const pk = await (await gh("/actions/secrets/public-key")).json();
for (const name of process.argv.slice(2)) {
  const val = env[name]; if (!val) { console.log("atlandı (boş):", name); continue; }
  const enc = sodium.crypto_box_seal(sodium.from_string(val), sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL));
  const r = await gh(`/actions/secrets/${name}`, { method: "PUT", body: JSON.stringify({ encrypted_value: sodium.to_base64(enc, sodium.base64_variants.ORIGINAL), key_id: pk.key_id }) });
  console.log(name, r.status);
}
