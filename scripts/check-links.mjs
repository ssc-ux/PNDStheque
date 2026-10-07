// Vérifie tous les liens (PDF + pages HAS) déclarés entre DATA-START et DATA-END dans index.html.
// Écrit la liste des liens cassés dans broken.md et sort en code 1 s'il y en a.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { H, J, D, P, DOI, R, UA } from "./data.mjs";

const links = D.flatMap(([t, , , pdf, page]) => [
  pdf && { t, kind: "PDF", url: H + pdf },
  page && { t, kind: "page HAS", url: J + page },
]).filter(Boolean).concat(P.map(([t, , , , url, kind]) => ({ t, kind: kind === "PDF" ? "PDF" : "page", url })))
  .concat(R.map(([t, , soc, , doi]) => ({ t: `${t} (${soc})`, kind: "DOI", url: DOI + doi })));

// Un lien est valide si la réponse est 200 ET du bon type : la HAS renvoie parfois une page d'erreur
// HTML avec un code 200 à la place d'un PDF disparu.
async function check({ kind, url }) {
  // Les éditeurs (Wiley, Elsevier…) bloquent les robots : on vérifie que le DOI existe auprès de Crossref.
  if (kind === "DOI") url = "https://api.crossref.org/works/" + url.slice(DOI.length);
  try {
    // Referer = notre site : on teste le lien comme un vrai clic depuis la PNDSthèque.
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000), headers: { "User-Agent": UA, Referer: "https://ssc-ux.github.io/PNDStheque/" } });
    const type = r.headers.get("content-type") || "";
    const body = kind === "PDF" ? "" : await r.text();
    await r.body?.cancel?.().catch(() => {});
    if (!r.ok) return `HTTP ${r.status}`;
    if (kind === "PDF" && !type.includes("pdf")) return `pas un PDF (${type.split(";")[0]}) → ${r.url}`;
    if (kind !== "PDF" && /page introuvable|n'existe pas|404/i.test(body.match(/<title>([^<]*)/)?.[1] || "")) return "page introuvable";
    return null;
  } catch (e) { return viaCurl({ kind, url }) ?? null; }
}
// Second essai avec curl : certains vieux serveurs (ex. rhumatismes.net) coupent la connexion TLS de Node
// alors qu'ils répondent normalement aux navigateurs et à curl.
function viaCurl({ kind, url }) {
  try {
    const [code, type = ""] = execFileSync("curl", ["-sL", "-A", UA, "-o", "/dev/null", "-w", "%{http_code} %{content_type}", url], { encoding: "utf8", timeout: 30000 }).split(" ");
    if (code !== "200") return `HTTP ${code} (curl)`;
    if (kind === "PDF" && !type.includes("pdf")) return `pas un PDF (${type}) (curl)`;
    return null;
  } catch (e) { return `inaccessible (${e.message.split("\n")[0]})`; }
}

// Sites qui coupent toute connexion venant des serveurs GitHub (pare-feu anti-robots) : impossibles à
// vérifier automatiquement, à contrôler à la main dans un navigateur.
const UNCHECKABLE = ["rhumatismes.net"];
const broken = [];
for (const l of links) {
  if (UNCHECKABLE.some(d => l.url.includes(d))) { console.log("?? ", l.kind, l.t, "(non vérifiable automatiquement)"); continue; }
  const err = await check(l);
  console.log(err ? "KO" : "OK", l.kind, l.t, err || "");
  if (err) broken.push(`- **${l.t}** (${l.kind}) → ${err} — ${l.url}`);
}
writeFileSync("broken.md", broken.join("\n"));
console.log(`\n${links.length} liens vérifiés, ${broken.length} cassé(s).`);
process.exit(broken.length ? 1 : 0);
