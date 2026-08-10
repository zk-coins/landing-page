import { describe, expect, test } from 'vitest';
import {
  PAGES,
  PORT,
  PROJECTS,
  SITE_PAGES,
  VIEWS,
  pathsFromSitePages,
  projectsForView,
  screenshotName,
  slugFor,
  visualMatrix,
} from '../scripts/lib/pages.mjs';

describe('constants', () => {
  test('PORT is a number and PAGES/PROJECTS cover the locale matrix', () => {
    expect(typeof PORT).toBe('number');
    expect(SITE_PAGES).toEqual([
      { slug: '', hasFaq: true },
      { slug: 'zkbtc', hasFaq: true },
    ]);
    expect(PAGES).toEqual([
      '/',
      '/de/',
      '/fr/',
      '/it/',
      '/es/',
      '/zkbtc/',
      '/de/zkbtc/',
      '/fr/zkbtc/',
      '/it/zkbtc/',
      '/es/zkbtc/',
    ]);
    expect(PROJECTS).toEqual(['desktop-chromium', 'tablet-chromium', 'mobile-safari']);
  });
});

describe('pathsFromSitePages', () => {
  test('expands every page × language when requireFaq is false', () => {
    expect(
      pathsFromSitePages([
        { slug: '', hasFaq: true },
        { slug: 'zkbtc', hasFaq: false },
      ]),
    ).toEqual([
      '/',
      '/de/',
      '/fr/',
      '/it/',
      '/es/',
      '/zkbtc/',
      '/de/zkbtc/',
      '/fr/zkbtc/',
      '/it/zkbtc/',
      '/es/zkbtc/',
    ]);
  });

  test('with requireFaq only keeps pages that declare hasFaq', () => {
    expect(
      pathsFromSitePages(
        [
          { slug: '', hasFaq: true },
          { slug: 'zkbtc', hasFaq: false },
        ],
        { requireFaq: true },
      ),
    ).toEqual(['/', '/de/', '/fr/', '/it/', '/es/']);
    expect(pathsFromSitePages([{ slug: 'zkbtc', hasFaq: false }], { requireFaq: true })).toEqual(
      [],
    );
  });
});

describe('screenshotName', () => {
  test('maps the English home path to "home.png"', () => {
    expect(screenshotName('/')).toBe('home.png');
  });

  test('maps locale homes to home-<code>.png', () => {
    expect(screenshotName('/de/')).toBe('home-de.png');
    expect(screenshotName('/fr/')).toBe('home-fr.png');
  });

  test('strips the leading slash and .html extension', () => {
    expect(screenshotName('/faq.html')).toBe('faq.png');
  });

  test('replaces nested slashes with dashes', () => {
    expect(screenshotName('/a/b.html')).toBe('a-b.png');
  });

  test('falls back to home.png when the path collapses to an empty slug', () => {
    expect(screenshotName('/.html')).toBe('home.png');
  });
});

describe('slugFor', () => {
  test('drops the .png extension', () => {
    expect(slugFor('/')).toBe('home');
    expect(slugFor('/de/')).toBe('home-de');
    expect(slugFor('/faq.html')).toBe('faq');
  });
});

describe('VIEWS', () => {
  test('has a unique slug per view and includes FAQ-open for every locale', () => {
    const slugs = VIEWS.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('home');
    expect(slugs).toContain('home-de');
    expect(slugs).toContain('home-faq-open');
    expect(slugs).toContain('home-de-faq-open');
    // default load + faq-open for each page × locale with hasFaq
    // 2 pages × 5 locales × 2 states = 20
    expect(VIEWS).toHaveLength(20);
    expect(slugs).toContain('zkbtc');
    expect(slugs).toContain('de-zkbtc');
    expect(slugs).toContain('zkbtc-faq-open');
  });

  test('faq-open views only cover SITE_PAGES with hasFaq', () => {
    const faqOpen = VIEWS.filter((v) => v.state === 'faqOpen');
    const faqPages = SITE_PAGES.filter((p) => p.hasFaq);
    expect(faqOpen).toHaveLength(faqPages.length * 5);
  });
});

describe('projectsForView', () => {
  test('defaults to every project when a view declares no subset', () => {
    expect(projectsForView({ slug: 'home', path: '/' })).toEqual(PROJECTS);
  });

  test('honours an explicit project subset', () => {
    const subset = ['mobile-safari'];
    expect(projectsForView({ slug: 'x', path: '/', projects: subset })).toBe(subset);
  });
});

describe('visualMatrix', () => {
  test('produces one pair per view × applicable project', () => {
    const matrix = visualMatrix();
    const expected = VIEWS.reduce((sum, v) => sum + projectsForView(v).length, 0);
    expect(matrix).toHaveLength(expected);
    for (const pair of matrix) {
      expect(pair).toHaveProperty('view');
      expect(PROJECTS).toContain(pair.project);
    }
  });
});
