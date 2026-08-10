// Single source of truth for the dev-server port, the pages under test, the
// Playwright projects (viewports) and the visual matrix. Imported by
// playwright.config.mjs, scripts/dev-server.mjs, scripts/check-visual.mjs and
// every spec so the matrix is declared exactly once. Pure and side-effect free —
// unit-tested to 100% in test/pages.test.mjs.

import { LANG_CODES, pathForLang } from './i18n.mjs';

export const PORT = 4173;

/**
 * Site page definitions. `slug` is the path segment under the language root
 * ("" = home). Keep in sync with PAGES in scripts/i18n/generate.py.
 * @type {readonly { slug: string, hasFaq: boolean }[]}
 */
export const SITE_PAGES = Object.freeze([
  { slug: '', hasFaq: true },
  { slug: 'zkbtc', hasFaq: true },
]);

/**
 * Expand site-page defs × languages into public URL paths.
 * When `requireFaq` is true, only pages with `hasFaq` are included (for the
 * faqOpen visual state).
 * @param {readonly { slug: string, hasFaq: boolean }[]} pages
 * @param {{ requireFaq?: boolean }} [opts]
 */
export function pathsFromSitePages(pages, { requireFaq = false } = {}) {
  return pages
    .filter((p) => (requireFaq ? p.hasFaq : true))
    .flatMap((page) => LANG_CODES.map((code) => pathForLang(code, page.slug)));
}

// Public, indexed pages — every site page × every supported language.
// Order: page-major (all langs of page 1, then page 2, …), matching generate.py.
export const PAGES = pathsFromSitePages(SITE_PAGES);

// Paths that expose a FAQ section (faqOpen visual state applies only here).
const FAQ_PATHS = pathsFromSitePages(SITE_PAGES, { requireFaq: true });

// Viewports the visual suite renders: desktop (>720px, full layout), a mid width
// that exercises the `@media (max-width: 720px)` and `640px` responsive layers,
// and a phone (<560px). The exact pixel sizes live in playwright.config.mjs.
export const PROJECTS = ['desktop-chromium', 'tablet-chromium', 'mobile-safari'];

// Stable screenshot slug for a page path: '/' -> 'home', '/de/' -> 'home-de',
// '/faq.html' -> 'faq', '/a/b.html' -> 'a-b'.
export function screenshotName(path) {
  if (path === '/') return 'home.png';
  // Locale homes: '/de/' → 'home-de.png'
  const localeHome = path.match(/^\/([a-z]{2})\/$/);
  if (localeHome) return `home-${localeHome[1]}.png`;
  const slug = path
    .replace(/^\//, '')
    .replace(/\.html$/, '')
    .replace(/\/$/, '')
    .replace(/\//g, '-');
  return `${slug || 'home'}.png`;
}

// Same slug without the extension — the baseline filename stem and the Playwright
// test title.
export function slugFor(path) {
  return screenshotName(path).replace(/\.png$/, '');
}

// The visual matrix. Each VIEW is one screenshot scenario:
//   slug     — baseline filename (without extension), unique across the matrix
//   path     — URL to load
//   state    — optional interaction performed before the shot: 'faqOpen'
//   projects — optional subset of PROJECTS this view applies to (default: all)
//
// Coverage = every public page at default load on all three viewports, plus the
// expanded-FAQ state on every page that has a FAQ (native <details>, no JS).
export const VIEWS = [
  // 1) Default load, every public page × every viewport.
  ...PAGES.map((path) => ({ slug: slugFor(path), path })),

  // 2) Expanded FAQ only on pages that declare hasFaq.
  ...FAQ_PATHS.map((path) => ({
    slug: `${slugFor(path)}-faq-open`,
    path,
    state: 'faqOpen',
  })),
];

// Projects a given view applies to.
export function projectsForView(view) {
  return view.projects === undefined ? PROJECTS : view.projects;
}

// Every (view, project) pair that should produce a baseline.
export function visualMatrix() {
  const pairs = [];
  for (const view of VIEWS) {
    for (const project of projectsForView(view)) {
      pairs.push({ view, project });
    }
  }
  return pairs;
}
