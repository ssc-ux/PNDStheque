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

const LANDING = "https://www.has-sante.fr/jcms/c_1340879/fr/protocoles-nationaux-de-diagnostic-et-de-soins-pnds";
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" } });
    console.log(r.status, url);
    return r.ok ? await r.text() : null;
  } catch (e) { console.log("ERR", url, e.cause?.code || e.message); return null; }
  finally { await sleep(2000); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = new Map(), add = html => { for (const c of extract(html)) found.set(c.key, c); };
  let ok = 0;
  // 1. Page « PNDS » de la HAS, puis ses sous-pages de liste (liens contenant « pnds » ou « protocole »).
  const landing = await get(LANDING);
  if (landing) {
    ok++; add(landing);
    const subs = new Set([...landing.matchAll(/href="([^"]*\/jcms\/[^"]*(?:pnds|protocole)[^"]*)"/gi)]
      .map(m => new URL(m[1].replace(/&amp;/g, "&"), LANDING).href).filter(u => !u.startsWith(LANDING)));
    for (const u of [...subs].slice(0, 30)) { const h = await get(u); if (h) { ok++; add(h); } }
  }
  // 2. Moteur de recherche HAS (souvent bloqué pour les serveurs : on s'arrête au premier refus).
  for (const k of KEYWORDS) { const h = await get(SEARCH + encodeURIComponent("PNDS " + k)); if (!h) break; ok++; add(h); }
  if (!ok) { console.error("Aucune page HAS n'a pu être lue (site bloqué ou modifié)."); process.exit(2); }
  const list = [...found.values()].map(({ title, url }) => ({ title, url }));
  writeFileSync("new-pnds.json", JSON.stringify(list, null, 2));
  console.log(`\n${list.length} candidat(s).`);
}
