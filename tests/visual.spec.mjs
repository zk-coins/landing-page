import { expect, test } from '@playwright/test';
import { VIEWS, projectsForView } from '../scripts/lib/pages.mjs';
import { installVisualDeterminism, settle, openAllFaq } from './helpers.mjs';

const STATE_SETUP = {
  faqOpen: openAllFaq,
};

test.describe('visual regression', () => {
  for (const view of VIEWS) {
    test(`${view.slug}`, async ({ page }, testInfo) => {
      test.skip(
        !projectsForView(view).includes(testInfo.project.name),
        `view "${view.slug}" does not apply to ${testInfo.project.name}`,
      );

      await installVisualDeterminism(page);
      await page.goto(view.path, { waitUntil: 'load' });
      await settle(page);

      if (view.state) {
        await STATE_SETUP[view.state](page);
      }

      // The page has no <video>/<canvas> and no non-deterministic media, so the
      // full-page shot needs no masking.
      await expect(page).toHaveScreenshot(`${view.slug}.png`, { fullPage: true });
    });
  }
});
