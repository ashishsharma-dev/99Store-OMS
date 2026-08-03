import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';

/**
 * Automatically detects the Google Chrome or Chromium executable path
 * across different operating systems (Windows, Linux, macOS).
 */
function findChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  if (process.platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome-beta'
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }

    try {
      const pathFromWhich = execSync('which google-chrome || which chromium || which chromium-browser', { encoding: 'utf8' }).trim();
      if (pathFromWhich) return pathFromWhich;
    } catch (e) {}
  }

  if (process.platform === 'darwin') {
    const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(macPath)) return macPath;
  }

  throw new Error('Google Chrome/Chromium executable not found. Please install chromium on your VPS or set CHROME_PATH environment variable.');
}

import path from 'path';

/**
 * Renders the order packing slip in a headless browser, takes a screenshot,
 * saves it directly to local disk in the public directory, and returns the URL.
 */
export async function generatePackingSlipImage(orderId: string, baseUrl?: string): Promise<string | null> {
  let browser;
  try {
    const executablePath = findChromePath();
    console.log(`[Screenshot] Launching headless Chrome using path "${executablePath}" for order ${orderId}...`);
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    
    // 4in * 96dpi = 384px wide, set high device scale factor for crystal clear barcodes
    await page.setViewport({
      width: 384,
      height: 600,
      deviceScaleFactor: 2
    });

    const port = process.env.PORT || '3000';
    const targetUrl = `http://localhost:${port}/packing-slip/${orderId}`;
    console.log(`[Screenshot] Navigating to: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Wait for the label element to load
    await page.waitForSelector('.healvita-label', { timeout: 5000 });

    const element = await page.$('.healvita-label');
    if (!element) {
      throw new Error('Healvita shipping label element not found in DOM.');
    }

    console.log(`[Screenshot] Element found, capturing screenshot buffer...`);
    const imageBuffer = await element.screenshot({ type: 'png' }) as Buffer;
    
    await browser.close();
    browser = null;

    // Ensure local directory exists in the public folder
    const slipsDir = path.join(process.cwd(), 'public', 'packing-slips');
    if (!fs.existsSync(slipsDir)) {
      fs.mkdirSync(slipsDir, { recursive: true });
    }

    // Save image file locally to disk
    const filePath = path.join(slipsDir, `${orderId}.png`);
    fs.writeFileSync(filePath, imageBuffer);
    console.log(`[Screenshot] Saved packing slip image locally at "${filePath}"`);

    // Construct public accessibility URL
    const resolvedBase = baseUrl || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`;
    const fileUrl = `${resolvedBase.replace(/\/$/, '')}/packing-slips/${orderId}.png`;
    
    console.log(`[Screenshot] Successfully generated locally and resolved URL: ${fileUrl}`);
    return fileUrl;

  } catch (err) {
    console.error('[Screenshot] Error generating packing slip screenshot:', err);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    return null;
  }
}
