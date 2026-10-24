// Génère qr/<empreinte>.gif pour chaque lien copiable (PNDS, documents patients, recos) et supprime les QR codes devenus inutiles.
// Word n'affiche pas les images intégrées (data:) au collage : il télécharge les images depuis le site, d'où ces fichiers.
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { H, J, D, P, DOI, R } from "./data.mjs";

const qrcode = createRequire(import.meta.url)("./qrcode.cjs");
// Même empreinte (FNV-1a 32 bits) que qrName() dans index.html.
const qrName = u => { let h = 0x811c9dc5; for (const c of new TextEncoder().encode(u)) h = Math.imul(h ^ c, 16777619) >>> 0; return h.toString(16).padStart(8, "0") + ".gif"; };
const urls = [...D.map(([, , , pdf, page]) => pdf ? H + pdf : J + page), ...P.map(p => p[4]), ...R.map(r => DOI + r[4])];
const dir = new URL("../qr/", import.meta.url), keep = new Set();
mkdirSync(dir, { recursive: true });
for (const u of urls) {
  const c = qrcode(0, "M"); c.addData(u); c.make();
  const f = qrName(u); keep.add(f);
  writeFileSync(new URL(f, dir), Buffer.from(c.createDataURL(6, 0).split(",")[1], "base64"));
}
for (const f of readdirSync(dir)) if (!keep.has(f)) unlinkSync(new URL(f, dir));
console.log(`${keep.size} QR codes`);
