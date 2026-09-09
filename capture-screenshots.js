import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Mobile screenshot (390x844)
  console.log('Capturing mobile view at 390x844...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('https://www.thedigitalgifter.com/christmas', {
    waitUntil: 'networkidle'
  });
  await page.screenshot({ path: '/workspace/mobile-390x844-first-viewport.png', fullPage: false });
  console.log('Saved: /workspace/mobile-390x844-first-viewport.png');
  
  // Desktop screenshot (1440x900)
  console.log('Capturing desktop view at 1440x900...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://www.thedigitalgifter.com/christmas', {
    waitUntil: 'networkidle'
  });
  await page.screenshot({ path: '/workspace/desktop-1440x900-first-viewport.png', fullPage: false });
  console.log('Saved: /workspace/desktop-1440x900-first-viewport.png');
  
  await browser.close();
  console.log('Done!');
})();
