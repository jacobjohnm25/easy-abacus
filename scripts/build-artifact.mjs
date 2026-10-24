// Builds the claude.ai preview page of an app from its index.html. The preview host adds its own
// <!doctype>, <html>, <head> and <body>, so those wrappers (and the charset/viewport metas) are removed.
// Run: node scripts/build-artifact.mjs            -> calculator.html
//      node scripts/build-artifact.mjs job-site   -> job-site/job-site-calculator.html
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const OUT = { ".": "calculator.html", "job-site": "job-site-calculator.html" };
const app = process.argv[2] || ".";
const dir = resolve(new URL("..", import.meta.url).pathname, app);
const src = readFileSync(`${dir}/index.html`, "utf8");
const out = src
  .replace(/<!doctype html>\s*/i, "")
  .replace(/<\/?html[^>]*>\s*/gi, "")
  .replace(/<\/?head>\s*/gi, "")
  .replace(/<\/?body>\s*/gi, "")
  .replace(/<meta charset[^>]*>\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "")
  .replace(/(["'])\.\.\/shared\//g, "$1shared/");   // the preview publishes shared/ next to the page
writeFileSync(`${dir}/${OUT[app] || "preview.html"}`, out);
console.log(`wrote ${app}/${OUT[app] || "preview.html"}`);
