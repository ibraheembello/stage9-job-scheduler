// Capture UI screenshots with the installed Chrome via puppeteer-core.
// Usage: node scripts/capture.mjs [url] [outPath] [waitSelector]
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const URL = process.argv[2] || 'http://localhost:4173/';
const OUT = process.argv[3] || 'docs/screenshots/dashboard.png';
const WAIT = process.argv[4] || '.stat-card';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  userDataDir: `C:\\Users\\bello\\AppData\\Local\\Temp\\pptr-${Date.now()}`,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
// SSE keeps a connection open, so 'networkidle' never fires — wait on DOM.
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector(WAIT, { timeout: 15000 });
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log('Saved', OUT);
