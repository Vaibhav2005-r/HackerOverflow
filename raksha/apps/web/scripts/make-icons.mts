/** Renders the Sakhi-orb app icons to PNG (needs Playwright's Chromium): npx tsx scripts/make-icons.mts */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/", import.meta.url));
const orb = (size: number, scale: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#8E7CFF" stop-opacity=".55"/><stop offset="1" stop-color="#8E7CFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="sphere" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5EEAD4"/><stop offset="1" stop-color="#8E7CFF"/></linearGradient>
    <radialGradient id="light" cx="35%" cy="28%" r="45%"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="#0B0A14"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <circle cx="256" cy="256" r="240" fill="url(#glow)"/>
    <circle cx="256" cy="256" r="140" fill="url(#sphere)"/>
    <circle cx="256" cy="256" r="140" fill="url(#light)"/>
    <circle cx="226" cy="246" r="13" fill="#fff"/><circle cx="286" cy="246" r="13" fill="#fff"/>
  </g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, scale] of [["icon-192.png", 192, 1], ["icon-512.png", 512, 1], ["icon-maskable-512.png", 512, 0.78], ["apple-touch-icon.png", 180, 0.9]] as const) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${orb(size, scale)}</body>`);
  await page.screenshot({ path: OUT + file });
  console.log("wrote", file);
}
await browser.close();
