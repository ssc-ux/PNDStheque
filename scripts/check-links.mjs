// Vérifie tous les liens (PDF + pages HAS) déclarés entre DATA-START et DATA-END dans index.html.
// Écrit la liste des liens cassés dans broken.md et sort en code 1 s'il y en a.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const data = html.split("// DATA-START")[1].split("// DATA-END")[0];
const { H, J, D } = new Function(data + "; return { H, J, D };")();

const links = D.flatMap(([t, , , pdf, page]) => [
  pdf && { t, kind: "PDF", url: H + pdf },
  page && { t, kind: "page HAS", url: J + page },
]).filter(Boolean);

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
async function status(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, redirect: "follow", headers: { "User-Agent": UA } });
      if (r.ok || method === "GET") return r.status;
    } catch (e) { if (method === "GET") return String(e.cause?.code || e.message); }
  }
}

const broken = [];
for (const l of links) {
  const s = await status(l.url);
  console.log(s, l.url);
  if (s !== 200) broken.push(`- **${l.t}** (${l.kind}) → \`${s}\` ${l.url}`);
}
writeFileSync("broken.md", broken.join("\n"));
console.log(`\n${links.length} liens vérifiés, ${broken.length} cassé(s).`);
process.exit(broken.length ? 1 : 0);
