// Vérifie tous les liens (PDF + pages HAS) déclarés entre DATA-START et DATA-END dans index.html.
// Écrit la liste des liens cassés dans broken.md et sort en code 1 s'il y en a.
import { writeFileSync } from "node:fs";
import { H, J, D, P, UA } from "./data.mjs";

const links = D.flatMap(([t, , , pdf, page]) => [
  pdf && { t, kind: "PDF", url: H + pdf },
  page && { t, kind: "page HAS", url: J + page },
]).filter(Boolean).concat(P.map(([t, , , url]) => ({ t, kind: "PDF", url })));

// Un lien est valide si la réponse est 200 ET du bon type : la HAS renvoie parfois une page d'erreur
// HTML avec un code 200 à la place d'un PDF disparu.
async function check({ kind, url }) {
  try {
    // Referer = notre site : on teste le lien comme un vrai clic depuis la PNDSthèque.
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, Referer: "https://ssc-ux.github.io/PNDStheque/" } });
    const type = r.headers.get("content-type") || "";
    const body = kind === "PDF" ? "" : await r.text();
    await r.body?.cancel?.().catch(() => {});
    if (!r.ok) return `HTTP ${r.status}`;
    if (kind === "PDF" && !type.includes("pdf")) return `pas un PDF (${type.split(";")[0]}) → ${r.url}`;
    if (kind !== "PDF" && /page introuvable|n'existe pas|404/i.test(body.match(/<title>([^<]*)/)?.[1] || "")) return "page introuvable";
    return null;
  } catch (e) { return String(e.cause?.code || e.message); }
}

const broken = [];
for (const l of links) {
  const err = await check(l);
  console.log(err ? "KO" : "OK", l.kind, l.t, err || "");
  if (err) broken.push(`- **${l.t}** (${l.kind}) → ${err} — ${l.url}`);
}
writeFileSync("broken.md", broken.join("\n"));
console.log(`\n${links.length} liens vérifiés, ${broken.length} cassé(s).`);
process.exit(broken.length ? 1 : 0);
