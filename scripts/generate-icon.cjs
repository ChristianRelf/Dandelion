/**
 * Generates the application icon from the Dandelion seed-head mark.
 *
 * Both outputs are committed artifacts — this only needs re-running when the
 * mark changes. It renders through Electron rather than pulling in an image
 * library: Electron is already a dependency, and rasterising the SVG in the
 * same engine that draws the mark in the app keeps the two identical.
 *
 *   npm run icon
 *
 * electron-builder derives the Windows .ico and the Linux icon set from
 * build/icon.png, so a single 1024px source is all it needs.
 *
 * CommonJS on purpose: Electron only supports an ESM main process when the
 * entry comes from a package.json `main`, so a lone .mjs passed on the command
 * line never reaches `app.whenReady()`.
 */
const { writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { app, BrowserWindow, nativeImage } = require('electron');

const SIZE = 1024;
const ACCENT = '#f5c451'; // DEFAULT_ACCENT — the warm dandelion gold.
const PLATE = '#141414';

// The geometry of DandelionMark, at its native 64px viewBox.
const SPOKES = 13;
const CENTER_X = 32;
const CENTER_Y = 26;
const RADIUS = 18;

const root = resolve(__dirname, '..');

function markSvg() {
  const spokes = Array.from({ length: SPOKES }, (_, i) => {
    const angle = (-Math.PI * 5) / 6 + (i / (SPOKES - 1)) * ((Math.PI * 5) / 3);
    return {
      x: (CENTER_X + Math.cos(angle) * RADIUS).toFixed(3),
      y: (CENTER_Y + Math.sin(angle) * RADIUS).toFixed(3),
    };
  });

  const filaments = spokes
    .map(
      (p) =>
        `<line x1="${CENTER_X}" y1="${CENTER_Y}" x2="${p.x}" y2="${p.y}" stroke-width="1.3" opacity="0.9"/>` +
        `<circle cx="${p.x}" cy="${p.y}" r="1.5" fill="${ACCENT}" stroke="none"/>`,
    )
    .join('\n    ');

  // A rounded plate keeps the thin line art legible on any taskbar colour.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${SIZE}" height="${SIZE}">
  <rect x="0" y="0" width="64" height="64" rx="14" fill="${PLATE}"/>
  <g transform="translate(0 1)" stroke="${ACCENT}" fill="none" stroke-linecap="round">
    <path d="M32 26 C 31.5 38, 30 48, 26.5 59" stroke-width="2.2"/>
    <path d="M30 44 C 24 42, 20 44, 18 49 C 24 49, 28 48, 30 44 Z" stroke-width="1.4"/>
    ${filaments}
    <line x1="48" y1="14" x2="53" y2="9" stroke-width="1.1" opacity="0.6"/>
    <circle cx="53" cy="9" r="1.4" fill="${ACCENT}" stroke="none" opacity="0.75"/>
    <line x1="52" y1="22" x2="58" y2="20" stroke-width="1.1" opacity="0.5"/>
    <circle cx="58" cy="20" r="1.2" fill="${ACCENT}" stroke="none" opacity="0.6"/>
    <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="2.4" fill="${ACCENT}" stroke="none"/>
  </g>
</svg>`;
}

async function main() {
  await app.whenReady();

  const svg = markSvg();
  mkdirSync(resolve(root, 'build'), { recursive: true });
  writeFileSync(resolve(root, 'build/icon.svg'), `${svg}\n`);

  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });

  const page = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent;width:${SIZE}px;height:${SIZE}px}
svg{display:block;width:${SIZE}px;height:${SIZE}px}</style>${svg}`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  // Offscreen rendering needs a frame before the surface holds the paint.
  await new Promise((done) => setTimeout(done, 600));

  let image = await win.webContents.capturePage();
  // A HiDPI display captures at the device scale, not the requested size.
  if (image.getSize().width !== SIZE) {
    image = nativeImage.createFromBuffer(image.toPNG()).resize({ width: SIZE, height: SIZE });
  }
  if (image.isEmpty()) throw new Error('captured an empty image');

  writeFileSync(resolve(root, 'build/icon.png'), image.toPNG());
  console.log(`wrote build/icon.png (${image.getSize().width}x${image.getSize().height})`);
  console.log('wrote build/icon.svg');
  app.exit(0);
}

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
