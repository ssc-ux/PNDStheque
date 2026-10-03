// Diagnostic ponctuel : résout le PDF PNDS de pages HAS données en argument.
import { pndsDocId, pdfPath } from "./find-updates.mjs";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const get = async u => (await fetch(u, { headers: { "User-Agent": UA } })).text();
for (const id of process.argv.slice(2)) {
  const doc = pndsDocId(await get("https://www.has-sante.fr/jcms/" + id));
  console.log(id, doc, doc && pdfPath(await get("https://www.has-sante.fr/jcms/" + doc)));
}
