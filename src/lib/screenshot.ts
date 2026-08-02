import puppeteer from 'puppeteer-core';

/**
 * Renders the order packing slip in a headless browser, takes a screenshot,
 * uploads it to tmpfiles.org, and returns a direct image link.
 */
export async function generatePackingSlipImage(orderId: string): Promise<string | null> {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  let browser;
  try {
    console.log(`[Screenshot] Launching headless Chrome for order ${orderId}...`);
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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

    console.log(`[Screenshot] Uploading image buffer to tmpfiles.org...`);
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, `${orderId}-slip.png`);

    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.status === 'success') {
      const directUrl = data.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
      console.log(`[Screenshot] Successfully generated and uploaded packing slip for ${orderId}: ${directUrl}`);
      return directUrl;
    } else {
      console.error('[Screenshot] Failed to upload screenshot to tmpfiles:', data);
      return null;
    }
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
