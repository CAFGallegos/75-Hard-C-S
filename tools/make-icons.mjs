// Renders the S v C icon set with headless Chromium.
// Usage: node tools/make-icons.mjs   (needs playwright)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // set NODE_PATH to a global install if needed
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUE = "#F5B3C4", LOS = "#C08A63", INK = "#0E0D0D", V = "#F6F3F0";

// Graphite tile, split down the middle by a faint tint of each color.
// S in Sue's pink, C in Carlos's brown, a quiet italic v at the seam.
const page = (size, { radius = 0, scale = 1, badge = false } = {}) => `<!doctype html><html><head><style>
@font-face{font-family:A;src:url(file://${root}/fonts/archivo.woff2);font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:A;src:url(file://${root}/fonts/archivo-italic.woff2);font-weight:100 900;font-stretch:62% 125%;font-style:italic}
html,body{margin:0;background:transparent}
.i{width:${size}px;height:${size}px;position:relative;overflow:hidden;border-radius:${radius * size}px;
  ${badge ? "" : `background:
    linear-gradient(90deg, color-mix(in srgb, ${SUE} 13%, ${INK}) 50%, color-mix(in srgb, ${LOS} 15%, ${INK}) 50%);`}}
.i::after{content:"";position:absolute;left:50%;top:22%;bottom:22%;width:${Math.max(1, size * 0.004)}px;margin-left:${-Math.max(1, size * 0.004) / 2}px;
  background:transparent}
.l{position:absolute;top:0;bottom:0;width:50%;display:grid;place-items:center;
  font:800 ${size * 0.54 * scale}px/1 A;font-stretch:62%;letter-spacing:-.02em}
.l span{transform:translateY(${size * 0.03 * scale}px)}
.s{left:0;color:${badge ? "#fff" : SUE};padding-right:${size * 0.11 * scale}px}
.c{right:0;color:${badge ? "#fff" : LOS};padding-left:${size * 0.11 * scale}px}
.v{position:absolute;inset:0;display:grid;place-items:center;z-index:2}
.v span{font:italic 700 ${size * 0.2 * scale}px/1 A;font-stretch:75%;color:${badge ? "#fff" : V};opacity:${badge ? 1 : 0.78};
  transform:translateY(${size * 0.075 * scale}px)}
</style></head><body><div class="i"><div class="l s"><span>S</span></div><div class="l c"><span>C</span></div>
<div class="v"><span>v</span></div></div></body></html>`;

const jobs = [
  ["icons/icon-512.png", 512, {}],
  ["icons/icon-192.png", 192, {}],
  ["icons/apple-touch-icon.png", 180, {}],
  ["icons/icon-maskable-512.png", 512, { scale: 0.78 }],
  ["icons/favicon-64.png", 64, { radius: 0.22 }],
  ["icons/favicon-32.png", 32, { radius: 0.22 }],
  ["icons/badge-96.png", 96, { badge: true }],
  ["icons/preview-1024.png", 1024, { radius: 0.2237 }],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const [out, size, opts] of jobs) {
  await p.setViewportSize({ width: size, height: size });
  const tmp = path.join(root, "tools", ".icon.html");
  fs.writeFileSync(tmp, page(size, opts));
  await p.goto("file://" + tmp);
  await p.evaluate(() => document.fonts.ready);
  await p.locator(".i").screenshot({ path: path.join(root, out), omitBackground: true });
  console.log("wrote", out);
}
await browser.close();
fs.rmSync(path.join(root, "tools", ".icon.html"), { force: true });
