// Cherche sur le site de la HAS des PNDS de médecine interne absents de index.html.
// Écrit les candidats dans new-pnds.json (tableau de { title, url }).
import { writeFileSync } from "node:fs";
import { D, UA } from "./data.mjs";

const KEYWORDS = [
  "lupus", "sjogren", "sclerodermie", "anti-phospholipides", "myosite", "dermatomyosite",
  "vascularite", "arterite", "takayasu", "behcet", "cogan", "cryoglobulinemie", "still",
  "auto-inflammatoire", "fievre mediterraneenne", "amylose", "polychondrite", "uveite",
  "sarcoidose", "purpura", "anemie hemolytique", "microangiopathie", "hypereosinophil",
  "angioedeme", "igg4", "castleman", "histiocytose", "erdheim", "kawasaki", "fabry", "gaucher",
  "aplasie", "deficit immunitaire", "lymphohistiocytose", "connectivite", "mastocytose",
];
const SEARCH = "https://www.has-sante.fr/jcms/fc_2875171/fr/resultat-de-recherche?text=";
const EXCLUDE = /synthese|argumentaire|avis|decision|commission|recommandation|fiche|evaluation/;

const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const known = new Set(D.flatMap(([, , , pdf, page]) => [pdf && pdf.split("/").pop(), page]).filter(Boolean));

// Extrait les liens vers des pages /jcms/p_… ou /jcms/c_… et des PDF « pnds » d'une page de résultats.
export function extract(html) {
  const out = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const [, href, inner] of html.matchAll(re)) {
    const url = new URL(href.replace(/&amp;/g, "&"), "https://www.has-sante.fr").href.split(/[?#]/)[0];
    const title = inner.replace(/<[^>]+>/g, " ").replace(/&#39;|&rsquo;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const page = url.match(/\/jcms\/([pc]_\d+)\/fr\/[^/]+$/)?.[1];
    const pdf = /\/upload\/docs\/application\/pdf\/.*pnds[^/]*\.pdf$/i.test(url) ? url.split("/").pop() : null;
    const key = page || pdf;
    if (!key || !title || known.has(key)) continue;
    const text = norm(title + " " + url);
    if (EXCLUDE.test(text)) continue;
    if (/^[A-Z0-9][A-Z0-9 \-®]{2,}\s*\(/.test(title)) continue; // pages médicament (ex. « NUCALA (mépolizumab) »)
    if (!KEYWORDS.some(k => text.includes(k))) continue;
    out.push({ key, title, url });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = new Map();
  let ok = 0;
  for (const k of KEYWORDS) {
    try {
      const r = await fetch(SEARCH + encodeURIComponent("PNDS " + k), { headers: { "User-Agent": UA } });
      console.log(r.status, k);
      if (!r.ok) continue;
      ok++;
      for (const c of extract(await r.text())) found.set(c.key, c);
    } catch (e) { console.log("ERR", k, e.cause?.code || e.message); }
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!ok) { console.error("Aucune recherche HAS n'a abouti (site bloqué ou modifié)."); process.exit(2); }
  const list = [...found.values()].map(({ title, url }) => ({ title, url }));
  writeFileSync("new-pnds.json", JSON.stringify(list, null, 2));
  console.log(`\n${list.length} candidat(s).`);
}
