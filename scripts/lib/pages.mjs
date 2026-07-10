// Single source of truth for the dev-server port, the pages under test, the
// Playwright projects (viewports) and the visual matrix. Imported by
// playwright.config.mjs, scripts/dev-server.mjs, scripts/check-visual.mjs and
// every spec so the matrix is declared exactly once. Pure and side-effect free —
// unit-tested to 100% in test/pages.test.mjs.

export const PORT = 4173;

// Public, indexed pages. The site is a single static page today; keeping this an
// array means a second page only needs one more entry here for the smoke and
// visual suites to pick it up.
export const PAGES = ['/'];

// Viewports the visual suite renders: desktop, a real tablet width (exercises the
// `@media (max-width: 720px/560px)` layers around the breakpoint), and a phone.
export const PROJECTS = ['desktop-chromium', 'tablet-chromium', 'mobile-safari'];

// Stable screenshot slug for a page path: '/' -> 'home', '/faq.html' -> 'faq',
// '/a/b.html' -> 'a-b'.
export function screenshotName(path) {
  const slug =
    path === '/'
      ? 'home'
      : path
          .replace(/^\//, '')
          .replace(/\.html$/, '')
          .replace(/\//g, '-');
  return `${slug}.png`;
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
// one interactive state a default-load shot can never capture: every FAQ
// <details> expanded.
export const VIEWS = [
  // 1) Default load, every page × every viewport.
  ...PAGES.map((path) => ({ slug: slugFor(path), path })),

  // 2) The expanded-FAQ state (native <details>, no JS) on every viewport.
  { slug: 'home-faq-open', path: '/', state: 'faqOpen' },
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
