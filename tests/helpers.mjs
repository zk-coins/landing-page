// Shared helpers for the Playwright suite. Filename has no `spec`/`test` suffix so
// Playwright does not pick it up as a test file.
//
// The zkCoins landing page ships no JavaScript, loads no web fonts and embeds no
// third-party widgets, video or canvas — so making a screenshot deterministic is
// mostly a matter of pinning reduced motion (which the page's own
// `@media (prefers-reduced-motion: reduce)` rule uses to disable every animation
// and transition, including the pulsing active-roadmap node).

// Any request that leaves 127.0.0.1 is external (the page has none by design, but
// a stray one must never stall `networkidle`); fulfill it with an empty 200.
export async function blockExternalNoise(page) {
  await page.route('**/*', (route) => {
    let host = '';
    try {
      host = new URL(route.request().url()).hostname;
    } catch {
      return route.continue();
    }
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });
}

// Runs before any page script (there is none, but keep the shape): pin reduced
// motion so the CSS animations/transitions settle to a single stable end state,
// and neutralise external requests.
export async function installVisualDeterminism(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await blockExternalNoise(page);
}

// Interactive-state setup: expand every FAQ <details> so the shot captures each
// answer (the default-collapsed shot never shows them). Native <details>, no JS —
// set the attribute directly and wait for the answers to become visible.
export async function openAllFaq(page) {
  const count = await page.locator('.faq details').count();
  await page.evaluate(() => {
    document.querySelectorAll('.faq details').forEach((el) => el.setAttribute('open', ''));
  });
  await page.locator('.faq details[open] p').first().waitFor({ state: 'visible' });
  await page.waitForFunction(
    (expected) => document.querySelectorAll('.faq details[open]').length === expected,
    count,
  );
}

// Waits until the page has reached a stable visual state: fonts ready, network
// idle, and any lazy layout settled.
export async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // Nudge every lazy image to eager and scroll the full height once so nothing
  // loads in mid-shot, then return to the top.
  await page.evaluate(async () => {
    document
      .querySelectorAll('img[loading="lazy"]')
      .forEach((image) => image.setAttribute('loading', 'eager'));
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 100));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(200);
}
