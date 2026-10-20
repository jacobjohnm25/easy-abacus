// Renders the SVG icons to the PNG sizes the manifest lists. Run: node scripts/render-icons.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const jobs = [["icon.svg", 192, "icon-192.png"], ["icon.svg", 512, "icon-512.png"], ["icon-maskable.svg", 512, "icon-maskable-512.png"]];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, size, out] of jobs) {
  const svg = readFileSync(new URL(`../icons/${src}`, import.meta.url), "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: new URL(`../icons/${out}`, import.meta.url).pathname, omitBackground: true });
}
await browser.close();
