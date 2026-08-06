/**
 * Captures App Store screenshots from the running web build.
 *
 *   1. start the dev server on :8095
 *   2. node scripts/make-screenshots.mjs
 *
 * The Browser pane cannot composite frames when it is hidden, so this drives
 * a headless Chrome directly. Each shot is a real screen of the real app,
 * placed on a captioned backdrop.
 */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:8095';
const OUT = 'store/screenshots';

// Apple asks for a 6.9 inch and a 6.5 inch iPhone size.
const DEVICES = [
  { name: '6.9', width: 1320, height: 2868, css: [440, 956] },
  { name: '6.5', width: 1242, height: 2688, css: [414, 896] },
];

const SHOTS = [
  { id: '1', headline: 'Every code is read back\nbefore you ever use it', scrollTo: 0 },
  { id: '2', headline: 'See exactly why\nit will scan', scrollTo: 520 },
  { id: '3', headline: 'Ten looks.\nAll of them still scan.', scrollTo: 0 },
  { id: '4', headline: 'Wi-Fi, contacts, events —\nfourteen kinds of code', scrollTo: 0 },
  { id: '5', headline: 'Kept on your phone.\nNo account. No ads.', scrollTo: 0 },
];

const BG = '#0A0B0E';
const INK = '#F4F5F8';
const DIM = '#9CA3B4';

function chromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_PATH,
  ].filter(Boolean);
  return candidates[0];
}

function captionSvg(width, headline, sub) {
  const lines = headline.split('\n');
  const size = Math.round(width * 0.062);
  const lead = Math.round(size * 1.22);
  const top = Math.round(width * 0.155);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(width * 0.62)}">
    <rect width="100%" height="100%" fill="${BG}"/>
    ${lines
      .map(
        (l, i) =>
          `<text x="50%" y="${top + i * lead}" text-anchor="middle" fill="${INK}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700" letter-spacing="-1.2">${l
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')}</text>`,
      )
      .join('')}
    <text x="50%" y="${top + lines.length * lead + Math.round(size * 0.55)}" text-anchor="middle" fill="${DIM}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${Math.round(size * 0.42)}" font-weight="500">${sub}</text>
  </svg>`;
}

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: 'new',
  args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
});

try {
  for (const device of DEVICES) {
    const page = await browser.newPage();
    const scale = 3;
    await page.setViewport({
      width: device.css[0],
      height: device.css[1],
      deviceScaleFactor: scale,
      isMobile: true,
      hasTouch: true,
    });

    for (const shot of SHOTS) {
      await page.goto(`${BASE}/?shot=${shot.id}`, { waitUntil: 'networkidle0' });
      // Give the verifier time to finish its debounced pass.
      await new Promise((r) => setTimeout(r, 2200));
      await page.evaluate((y) => {
        const scroller = document.querySelector('[data-testid], div');
        const all = Array.from(document.querySelectorAll('div')).filter(
          (el) => el.scrollHeight > el.clientHeight + 40,
        );
        if (all.length) all[0].scrollTop = y;
        // Chrome paints a focus ring iOS never draws.
        const style = document.createElement('style');
        style.textContent = '*{outline:none !important;}';
        document.head.appendChild(style);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        void scroller;
      }, shot.scrollTo);
      await new Promise((r) => setTimeout(r, 700));

      const appShot = await page.screenshot({ type: 'png' });

      // Compose: caption band on top, the app screen below, on the app's own
      // dark field so the store page reads as one piece.
      const capHeight = Math.round(device.height * 0.215);
      const caption = await sharp(
        Buffer.from(captionSvg(device.width, shot.headline, 'QR Forge — offline, no subscription')),
      )
        .resize(device.width, capHeight, { fit: 'cover', position: 'top' })
        .png()
        .toBuffer();

      const screenWidth = Math.round(device.width * 0.86);
      const screen = await sharp(appShot)
        .resize({ width: screenWidth })
        .png()
        .toBuffer();
      const screenMeta = await sharp(screen).metadata();
      const rounded = await sharp(screen)
        .composite([
          {
            input: Buffer.from(
              `<svg width="${screenMeta.width}" height="${screenMeta.height}"><rect width="${screenMeta.width}" height="${screenMeta.height}" rx="${Math.round(screenMeta.width * 0.075)}" fill="#fff"/></svg>`,
            ),
            blend: 'dest-in',
          },
        ])
        .png()
        .toBuffer();

      const file = `${OUT}/${device.name}-${shot.id}.png`;
      await sharp({
        create: {
          width: device.width,
          height: device.height,
          channels: 4,
          background: BG,
        },
      })
        .composite([
          { input: caption, top: 0, left: 0 },
          {
            input: rounded,
            top: capHeight,
            left: Math.round((device.width - screenWidth) / 2),
          },
        ])
        .flatten({ background: BG })
        .png()
        .toFile(file);
      console.log(`wrote ${file}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
