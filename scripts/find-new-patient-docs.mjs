// Repère les nouveaux documents patients publiés par les sources déjà utilisées (CeRéMAIA, France Vascularites,
// FAI²R) et absents de l'onglet « Documents patients ». Écrit les candidats dans new-patient-docs.json.
import { writeFileSync } from "node:fs";
import { P, UA } from "./data.mjs";

const get = async u => { try { const r = await fetch(u, { headers: { "User-Agent": UA } }); return r.ok ? await r.text() : ""; } catch { return ""; } };
const known = new Set(P.map(p => p[4]));
const found = new Map(), add = (url, source) => { if (!known.has(url)) found.set(url, { url, source }); };

// CeRéMAIA (Tenon) : livrets et triptyques patients.
const M = "https://www.maladiesautoinflammatoires.fr";
for (const page of ["/livretspatients", "/tryptiques-patient"])
  for (const [u] of (await get(M + page)).matchAll(/https:\/\/www\.maladiesautoinflammatoires\.fr\/_files\/ugd\/[a-z0-9_]+\.pdf/g)) add(u, "CeRéMAIA");

// France Vascularites : fiches individuelles.
const V = "https://www.association-vascularites.org";
for (const [, h] of (await get(V + "/les-vascularites-c-est-quoi/fiches-individuelles")).matchAll(/href="(\/images\/fiches_individuelles_vascularites\/[^"]+\.pdf)"/g)) add(encodeURI(decodeURI(V + h)), "France Vascularites");

// FAI²R : livrets « 100 questions » et pages « Les réponses à vos questions ».
for (const [u] of (await get("https://www.fai2r.org/vie-quotidienne/ouvrages-100-questions/")).matchAll(/https:\/\/www\.fai2r\.org\/wp-content\/uploads\/[^"']+\.pdf/g)) add(u, "FAI²R");
const maps = [...(await get("https://www.fai2r.org/sitemap_index.xml")).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
for (const m of maps)
  for (const [, u] of (await get(m)).matchAll(/<loc>([^<]*\/questions-patients\/)<\/loc>/g))
    if (!u.includes("/x-autres-")) add(u, "FAI²R"); // les anciennes adresses « x-autres » du plan du site ne répondent plus

const list = [...found.values()];
writeFileSync("new-patient-docs.json", JSON.stringify(list, null, 2));
console.log(`${list.length} document(s) non référencé(s).`, list);
