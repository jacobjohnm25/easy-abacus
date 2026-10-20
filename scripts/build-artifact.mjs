// Builds calculator.html, the claude.ai preview of index.html. The preview host adds its own
// <!doctype>, <html>, <head> and <body>, so those wrappers (and the charset/viewport metas) are removed.
// Run: node scripts/build-artifact.mjs
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const out = src
  .replace(/<!doctype html>\s*/i, "")
  .replace(/<\/?html[^>]*>\s*/gi, "")
  .replace(/<\/?head>\s*/gi, "")
  .replace(/<\/?body>\s*/gi, "")
  .replace(/<meta charset[^>]*>\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "");
writeFileSync(new URL("../calculator.html", import.meta.url), out);
console.log("wrote calculator.html");
