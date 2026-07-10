import { describe, expect, test } from 'vitest';
import {
  PAGES,
  PORT,
  PROJECTS,
  VIEWS,
  projectsForView,
  screenshotName,
  slugFor,
  visualMatrix,
} from '../scripts/lib/pages.mjs';

describe('constants', () => {
  test('PORT is a number and PAGES/PROJECTS are non-empty', () => {
    expect(typeof PORT).toBe('number');
    expect(PAGES.length).toBeGreaterThan(0);
    expect(PROJECTS).toEqual(['desktop-chromium', 'tablet-chromium', 'mobile-safari']);
  });
});

describe('screenshotName', () => {
  test('maps the home path to "home.png"', () => {
    expect(screenshotName('/')).toBe('home.png');
  });

  test('strips the leading slash and .html extension', () => {
    expect(screenshotName('/faq.html')).toBe('faq.png');
  });

  test('replaces nested slashes with dashes', () => {
    expect(screenshotName('/a/b.html')).toBe('a-b.png');
  });
});

describe('slugFor', () => {
  test('drops the .png extension', () => {
    expect(slugFor('/')).toBe('home');
    expect(slugFor('/faq.html')).toBe('faq');
  });
});

describe('VIEWS', () => {
  test('has a unique slug per view and includes the FAQ-open state', () => {
    const slugs = VIEWS.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('home');
    const faqView = VIEWS.find((v) => v.slug === 'home-faq-open');
    expect(faqView).toMatchObject({ path: '/', state: 'faqOpen' });
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
