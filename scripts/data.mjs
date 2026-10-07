// Lit les données des PNDS déclarées entre DATA-START et DATA-END dans index.html.
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = html.split("// DATA-START")[1].split("// DATA-END")[0];
export const { H, J, D, P, DOI, R, RM } = new Function(block + "; return { H, J, D, P, DOI, R, RM };")();
export const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
