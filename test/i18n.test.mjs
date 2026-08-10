import { describe, expect, test } from 'vitest';
import {
  DEFAULT_LANG,
  LANGS,
  LANG_CODES,
  expectedHreflangMap,
  expectedSwitcherPaths,
  extractHreflangMap,
  extractSwitcherHrefs,
  fileForLang,
  pathForLang,
  structuralFingerprint,
  urlForLang,
} from '../scripts/lib/i18n.mjs';

describe('LANGS', () => {
  test('includes en as default and four localised codes', () => {
    expect(DEFAULT_LANG).toBe('en');
    expect(LANG_CODES).toEqual(['en', 'de', 'fr', 'it', 'es']);
    expect(LANGS).toHaveLength(5);
  });
});

describe('pathForLang / fileForLang / urlForLang', () => {
  test('maps en to the site root', () => {
    expect(pathForLang('en')).toBe('/');
    expect(fileForLang('en')).toBe('index.html');
    expect(urlForLang('https://zkcoins.com', 'en')).toBe('https://zkcoins.com/');
  });

  test('maps non-default languages to a trailing-slash directory', () => {
    expect(pathForLang('de')).toBe('/de/');
    expect(fileForLang('de')).toBe('de/index.html');
    expect(urlForLang('https://zkcoins.com', 'fr')).toBe('https://zkcoins.com/fr/');
  });

  test('maps a non-empty slug under the language root', () => {
    expect(pathForLang('en', 'zkbtc')).toBe('/zkbtc/');
    expect(pathForLang('de', 'zkbtc')).toBe('/de/zkbtc/');
    expect(fileForLang('en', 'zkbtc')).toBe('zkbtc/index.html');
    expect(fileForLang('de', 'zkbtc')).toBe('de/zkbtc/index.html');
    expect(urlForLang('https://zkcoins.com', 'es', 'zkbtc')).toBe('https://zkcoins.com/es/zkbtc/');
  });

  test('throws on an unknown language code', () => {
    expect(() => pathForLang('pt')).toThrow(/unknown language code/);
    expect(() => fileForLang('pt')).toThrow(/unknown language code/);
    expect(() => pathForLang('pt', 'zkbtc')).toThrow(/unknown language code/);
    expect(() => fileForLang('pt', 'zkbtc')).toThrow(/unknown language code/);
  });
});

describe('hreflang helpers', () => {
  test('expectedHreflangMap covers every language plus x-default', () => {
    const map = expectedHreflangMap('https://zkcoins.com');
    expect(map['x-default']).toBe('https://zkcoins.com/');
    expect(map.en).toBe('https://zkcoins.com/');
    expect(map.de).toBe('https://zkcoins.com/de/');
    expect(Object.keys(map).sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'x-default'].sort());
  });

  test('expectedHreflangMap with a slug points every language at that page', () => {
    const map = expectedHreflangMap('https://zkcoins.com', 'zkbtc');
    expect(map['x-default']).toBe('https://zkcoins.com/zkbtc/');
    expect(map.en).toBe('https://zkcoins.com/zkbtc/');
    expect(map.de).toBe('https://zkcoins.com/de/zkbtc/');
    expect(map.fr).toBe('https://zkcoins.com/fr/zkbtc/');
  });

  test('extractHreflangMap reads alternate links and ignores others', () => {
    const html = `
      <link rel="alternate" hreflang="en" href="https://zkcoins.com/" />
      <link rel="alternate" hreflang="de" href="https://zkcoins.com/de/" />
      <link rel="stylesheet" href="/styles.css" />
      <link rel="canonical" href="https://zkcoins.com/" />
    `;
    expect(extractHreflangMap(html)).toEqual({
      en: 'https://zkcoins.com/',
      de: 'https://zkcoins.com/de/',
    });
  });

  test('extractHreflangMap returns {} when none present', () => {
    expect(extractHreflangMap('<html></html>')).toEqual({});
  });
});

describe('switcher helpers', () => {
  test('expectedSwitcherPaths lists every locale home', () => {
    expect(expectedSwitcherPaths()).toEqual(['/', '/de/', '/fr/', '/it/', '/es/']);
  });

  test('expectedSwitcherPaths with a slug lists the same page per language', () => {
    expect(expectedSwitcherPaths('zkbtc')).toEqual([
      '/zkbtc/',
      '/de/zkbtc/',
      '/fr/zkbtc/',
      '/it/zkbtc/',
      '/es/zkbtc/',
    ]);
  });

  test('extractSwitcherHrefs reads the lang menu', () => {
    const html = `
      <div class="lang__menu">
        <a href="/" lang="en" hreflang="en">English <span>EN</span></a>
        <a href="/de/" lang="de" hreflang="de" aria-current="page">Deutsch <span>DE</span></a>
      </div>
    `;
    expect(extractSwitcherHrefs(html)).toEqual(['/', '/de/']);
  });

  test('extractSwitcherHrefs returns [] when the menu is missing', () => {
    expect(extractSwitcherHrefs('<nav></nav>')).toEqual([]);
  });
});

describe('structuralFingerprint', () => {
  test('counts sections, ids and hash anchors', () => {
    const html = `
      <section id="paper"></section>
      <section class="band"></section>
      <section id="faq"></section>
      <a href="#paper">p</a>
      <a href="#faq">f</a>
      <a href="https://example.com">ext</a>
    `;
    expect(structuralFingerprint(html)).toEqual({
      sections: 3,
      sectionIds: 'paper,,faq',
      anchors: 2,
    });
  });
});
