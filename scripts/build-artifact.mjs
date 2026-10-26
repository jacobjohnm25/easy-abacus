// Builds the claude.ai preview page of an app from its index.html. The preview host adds its own
// <!doctype>, <html>, <head> and <body>, so those wrappers (and the charset/viewport metas) are removed,
// and relative paths are flattened because a preview publishes its files next to the page.
// Run: node scripts/build-artifact.mjs                     -> calculator.html
//      node scripts/build-artifact.mjs job-site            -> job-site/job-site-calculator.html
//      node scripts/build-artifact.mjs job-site/estimator  -> job-site/estimator/estimator-preview.html
// Links between previews: PREVIEW_ESTIMATOR_URL and PREVIEW_JOB_SITE_URL (claude.ai artifact links).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const OUT = { ".": "calculator.html", "job-site": "job-site-calculator.html", "job-site/estimator": "estimator-preview.html" };
const app = (process.argv[2] || ".").replace(/\/$/, "");
const dir = resolve(new URL("..", import.meta.url).pathname, app);
let out = readFileSync(`${dir}/index.html`, "utf8")
  .replace(/<!doctype html>\s*/i, "")
  .replace(/<\/?html[^>]*>\s*/gi, "")
  .replace(/<\/?head>\s*/gi, "")
  .replace(/<\/?body>\s*/gi, "")
  .replace(/<meta charset[^>]*>\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "");
if (process.env.PREVIEW_ESTIMATOR_URL) out = out.replace('<meta name="estimator-url" content="estimator/">', `<meta name="estimator-url" content="${process.env.PREVIEW_ESTIMATOR_URL}">`);
if (process.env.PREVIEW_JOB_SITE_URL) out = out.replace('href="../" id="backLink"', `href="${process.env.PREVIEW_JOB_SITE_URL}" id="backLink"`);
out = out
  .replace(/(["'])(?:\.\.\/)+shared\//g, "$1shared/")   // shared/ is published next to the page
  .replace(/(["'])\.\.\/(?=[\w-]+\.[a-z]+["']|icons\/)/g, "$1");   // parent files (theme-config.js, styles.css, icons) too
writeFileSync(`${dir}/${OUT[app] || "preview.html"}`, out);
console.log(`wrote ${app}/${OUT[app] || "preview.html"}`);
