// Repère les nouvelles versions des PNDS déjà présents : pour chaque fiche ayant une page HAS,
// on suit le lien « PNDS » de cette page jusqu'au PDF actuel et on le compare au nôtre.
// Avec APPLY=1, met à jour index.html (nouveau PDF + date « mis à jour »).
// Écrit la liste des changements dans updates.json.
import { readFileSync, writeFileSync } from "node:fs";
import { J, D, UA } from "./data.mjs";

const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    return r.ok ? await r.text() : null;
  } catch { return null; } finally { await sleep(1000); }
}

// Sur une page HAS, l'identifiant du document « PNDS » (ni synthèse, ni argumentaire, ni version anglaise).
export function pndsDocId(html) {
  for (const [, id, title] of html.matchAll(/<a [^>]*href="jcms\/([pc]_\d+)\/[^"]*"[^>]*title="([^"]*)"/g)) {
    const t = norm(title.replace(/&#39;|&rsquo;/g, "'"));
    if (/\bpnds\b|protocole national/.test(t) && !/synthese|argumentaire|medecin traitant|\b(and|of|the)\b/.test(t)) return id;
  }
  return null;
}
// Sur la page du document, le chemin du PDF (après « upload/docs/application/pdf/ »).
export const pdfPath = html => html.match(/upload\/docs\/application\/pdf\/([^"' ]+?\.pdf)/)?.[1] || null;

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = new URL("../index.html", import.meta.url);
  let html = readFileSync(file, "utf8");
  const updates = [];
  for (const e of D) {
    const [t, , y, pdf, page] = e;
    if (!page) continue;
    const p = await get(J + page), doc = p && pndsDocId(p);
    const cur = doc && pdfPath(await get(J + doc) || "");
    console.log(cur ? (cur === pdf ? "=" : "≠") : "?", t, cur || "(PDF introuvable sur la page HAS)");
    if (!cur || cur === pdf) continue;
    const line = JSON.stringify(e);
    if (!html.includes(line)) { console.log("  ligne introuvable dans index.html, ignorée"); continue; }
    const month = cur.slice(0, 7), year = +month.slice(0, 4);
    const next = [t, e[1], Math.max(y ?? 0, year) || null, cur, page, month];
    html = html.replace(line, JSON.stringify(next));
    updates.push({ t, old: pdf, new: cur });
  }
  writeFileSync("updates.json", JSON.stringify(updates, null, 2));
  if (process.env.APPLY === "1" && updates.length) writeFileSync(file, html);
  console.log(`\n${updates.length} nouvelle(s) version(s).`);
}
