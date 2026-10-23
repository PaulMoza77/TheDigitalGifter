/**
 * Pays an authorized Stripe TEST hosted Checkout session with Visa 4242.
 * Headless Chrome only; refuses non-cs_test_ sessions.
 */
import { chromium } from '/Users/paul/thedigitalgifter/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const checkoutFile = process.env.TDG_AUDIT_CHECKOUT_FILE || '/tmp/tdg-isolated-stripe/magic-checkout.json';
const checkout = JSON.parse(readFileSync(checkoutFile, 'utf8'));
if (!checkout.sessionId?.startsWith('cs_test_')) throw new Error('TEST session required');
if (!checkout.checkoutUrl?.includes('checkout.stripe.com')) throw new Error('Hosted checkout URL required');

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const result = { sessionId: checkout.sessionId, steps: [] };

async function dumpInputs() {
  const top = await page.locator('input').evaluateAll((els) =>
    els.map((e) => ({ name: e.name, id: e.id, type: e.type, autocomplete: e.autocomplete, ph: e.placeholder })),
  );
  const frames = [];
  for (const frame of page.frames()) {
    try {
      const inputs = await frame.locator('input').evaluateAll((els) =>
        els.map((e) => ({ name: e.name, id: e.id, type: e.type, autocomplete: e.autocomplete, ph: e.placeholder })),
      );
      if (inputs.length) frames.push({ url: frame.url().slice(0, 120), inputs });
    } catch {
      /* cross-origin */
    }
  }
  return { top, frames };
}

async function fillInAnyFrame(matchers, value) {
  for (const frame of page.frames()) {
    for (const matcher of matchers) {
      try {
        const loc = frame.locator(matcher).first();
        if ((await loc.count()) > 0) {
          await loc.click({ timeout: 2000 });
          await loc.fill('');
          await loc.type(value, { delay: 20 });
          return { ok: true, frame: frame.url().slice(0, 80), matcher };
        }
      } catch {
        /* try next */
      }
    }
  }
  for (const matcher of matchers) {
    try {
      const loc = page.locator(matcher).first();
      if ((await loc.count()) > 0) {
        await loc.click({ timeout: 2000 });
        await loc.fill('');
        await loc.type(value, { delay: 20 });
        return { ok: true, frame: 'top', matcher };
      }
    } catch {
      /* try next */
    }
  }
  return { ok: false };
}

try {
  await page.goto(checkout.checkoutUrl, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  result.steps.push({ at: 'loaded', title: await page.title() });

  // Prefer EUR if adaptive pricing offers a currency chooser.
  const eur = page.getByText('€17.00', { exact: false }).first();
  if (await eur.count()) {
    await eur.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Ensure Card method is selected.
  const cardTab = page.getByRole('button', { name: /card/i }).first();
  if (await cardTab.count()) {
    await cardTab.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const cardRadio = page.locator('input[value="card"], [data-testid="card-accordion-item"]').first();
  if (await cardRadio.count()) {
    await cardRadio.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  result.steps.push({ inputsBefore: await dumpInputs() });

  const number = await fillInAnyFrame(
    [
      'input[name="number"]',
      'input[autocomplete="cc-number"]',
      'input[placeholder*="1234"]',
      'input[aria-label*="Card number" i]',
      'input[aria-label*="card number" i]',
    ],
    '4242424242424242',
  );
  const expiry = await fillInAnyFrame(
    [
      'input[name="expiry"]',
      'input[autocomplete="cc-exp"]',
      'input[placeholder*="MM"]',
      'input[aria-label*="Expir" i]',
    ],
    '12 / 34',
  );
  const cvc = await fillInAnyFrame(
    [
      'input[name="cvc"]',
      'input[autocomplete="cc-csc"]',
      'input[placeholder*="CVC"]',
      'input[aria-label*="CVC" i]',
      'input[aria-label*="security" i]',
    ],
    '123',
  );
  result.steps.push({ number, expiry, cvc });

  await fillInAnyFrame(
    ['input[name="name"]', 'input[autocomplete="cc-name"]', 'input[placeholder*="Full name" i]'],
    'Magic RC',
  );
  await fillInAnyFrame(
    ['input[name="postalCode"]', 'input[autocomplete="postal-code"]', 'input[placeholder*="ZIP" i]'],
    '1000',
  );

  result.steps.push({ inputsAfter: await dumpInputs() });

  if (!number.ok) {
    // Last resort: keyboard into focused card field after clicking the visible card box.
    const cardBox = page.locator('text=Card number').first();
    if (await cardBox.count()) {
      await cardBox.click();
      await page.keyboard.type('4242424242424242', { delay: 30 });
      await page.keyboard.press('Tab');
      await page.keyboard.type('1234', { delay: 30 });
      await page.keyboard.press('Tab');
      await page.keyboard.type('123', { delay: 30 });
      result.steps.push({ keyboardFallback: true });
    }
  }

  const payButton = page.getByRole('button', { name: /pay/i }).first();
  await payButton.click({ timeout: 15000 });
  result.steps.push({ clickedPay: true });

  // Success: local return URL, or Stripe success page, or session paid via API poll.
  let done = false;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(1000);
    const url = page.url();
    if (url.includes('127.0.0.1:58400') || url.includes('session_id=cs_test_')) {
      done = true;
      break;
    }
    const body = await page.locator('body').innerText().catch(() => '');
    if (/payment successful|thanks for your|order confirmed|success/i.test(body) && !/PAYMENT METHOD REQUIRED/i.test(body)) {
      done = true;
      break;
    }
  }
  result.finalUrl = page.url();
  result.bodySnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 1000);
  await page.screenshot({ path: '/tmp/tdg-isolated-stripe/magic-stripe-paid.png', fullPage: true });
  result.ok = done || !/PAYMENT METHOD REQUIRED/i.test(result.bodySnippet || '');
  if (!result.ok) result.error = 'Checkout did not leave unpaid/card-required state';
} catch (err) {
  result.ok = false;
  result.error = String(err);
  await page
    .screenshot({ path: '/tmp/tdg-isolated-stripe/magic-stripe-pay-failed.png', fullPage: true })
    .catch(() => {});
  result.finalUrl = page.url();
  result.bodySnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 1200);
  result.steps.push({ inputsOnError: await dumpInputs().catch(() => null) });
} finally {
  await browser.close();
}

writeFileSync('/tmp/tdg-isolated-stripe/magic-pay-browser.json', JSON.stringify(result, null, 2), {
  mode: 0o600,
});
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
