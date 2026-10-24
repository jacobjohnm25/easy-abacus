// Renders an app's SVG icons to the PNG sizes its manifest lists.
// Run: node scripts/render-icons.mjs [app folder]   (default: the main calculator, "." )
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve(new URL("..", import.meta.url).pathname, process.argv[2] || ".", "icons");
const jobs = [["icon.svg", 192, "icon-192.png"], ["icon.svg", 512, "icon-512.png"], ["icon-maskable.svg", 512, "icon-maskable-512.png"]];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, size, out] of jobs) {
  const svg = readFileSync(`${dir}/${src}`, "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: `${dir}/${out}`, omitBackground: true });
}
await browser.close();
