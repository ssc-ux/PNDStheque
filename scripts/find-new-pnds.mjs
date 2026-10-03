// Cherche dans les flux RSS de la HAS les PNDS de médecine interne absents de index.html.
// (Le moteur de recherche HAS est interdit aux robots par son robots.txt : on n'utilise que les flux.)
// Écrit les candidats dans new-pnds.json (tableau de { title, url }).
import { writeFileSync } from "node:fs";
import { D, UA } from "./data.mjs";

// strict : exiger la mention « PNDS » (sinon un mot-clé médical suffit, le flux ne contenant que des guides).
const FEEDS = [
  { url: "https://www.has-sante.fr/feed/Rss2.jsp?id=p_3081452", strict: false }, // Recommandations et guides (dont les PNDS)
  { url: "https://www.has-sante.fr/feed/Rss2.jsp?id=p_3081656", strict: true },  // Actualité
];
const KEYWORDS = [
  "lupus", "sjogren", "sclerodermie", "anti-phospholipides", "myosite", "dermatomyosite",
  "vascularite", "arterite", "takayasu", "behcet", "cogan", "cryoglobulinemie", "still",
  "auto-inflammatoire", "fievre mediterraneenne", "amylose", "polychondrite", "uveite",
  "sarcoidose", "purpura", "anemie hemolytique", "microangiopathie", "hypereosinophil",
  "angioedeme", "igg4", "castleman", "histiocytose", "erdheim", "kawasaki", "fabry", "gaucher",
  "aplasie", "deficit immunitaire", "lymphohistiocytose", "connectivite", "mastocytose",
  "neutropenie", "hemophilie", "willebrand", "uremique",
];
const PNDS = /\bpnds\b|protocole national de diagnostic/;
// Publications qui ne sont jamais des PNDS (évaluations, notes de cadrage, avis, alertes…).
const EXCLUDE = /rapport|evaluation|note de cadrage|cadrage|\blabel\b|flash securite|\bavis\b|decision|vaccin|depistage/;
const KW = KEYWORDS.map(k => new RegExp("\\b" + k)); // début de mot : « still » ne matche pas « instillations »

const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
  .replace(/&apos;|&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const known = new Set(D.flatMap(([, , , pdf, page]) => [pdf && pdf.split("/").pop(), page]).filter(Boolean));

// Extrait d'un flux RSS les éléments qui ressemblent à un PNDS de médecine interne inconnu.
export function candidates(xml, strict = true) {
  const out = [];
  for (const [, item] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const tag = t => decode(item.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`))?.[1] || "");
    const title = tag("title"), url = tag("link"), text = norm(title + " " + tag("description") + " " + url);
    const id = url.match(/\/jcms\/([pc]_\d+)/)?.[1] || url.split("/").pop();
    if (!url || known.has(id) || EXCLUDE.test(norm(title)) || (strict && !PNDS.test(text)) || !KW.some(k => k.test(norm(title)))) continue;
    out.push({ title, url });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = new Map();
  let ok = 0;
  for (const { url: f, strict } of FEEDS) {
    try {
      const r = await fetch(f, { headers: { "User-Agent": UA } });
      const xml = r.ok ? await r.text() : "";
      const n = (xml.match(/<item\b/g) || []).length;
      console.log(r.status, n, "éléments", f);
      if (n) ok++;
      for (const c of candidates(xml, strict)) found.set(c.url, c);
    } catch (e) { console.log("ERR", f, e.cause?.code || e.message); }
  }
  if (!ok) { console.error("Aucun flux HAS lisible (site bloqué ou modifié)."); process.exit(2); }
  const list = [...found.values()];
  writeFileSync("new-pnds.json", JSON.stringify(list, null, 2));
  console.log(`\n${list.length} candidat(s).`, list);
}
