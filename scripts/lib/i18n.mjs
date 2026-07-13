// Single source of truth for supported locales. Imported by pages.mjs and
// check-site so the language matrix cannot drift between tooling layers.
// en is served from the site root; every other code is a directory prefix.

export const DEFAULT_LANG = 'en';

/** @type {readonly { code: string, hreflang: string, ogLocale: string, name: string, nativeName: string, dir: string }[]} */
export const LANGS = Object.freeze([
  {
    code: 'en',
    hreflang: 'en',
    ogLocale: 'en_US',
    name: 'English',
    nativeName: 'English',
    dir: '',
  },
  {
    code: 'de',
    hreflang: 'de',
    ogLocale: 'de_DE',
    name: 'German',
    nativeName: 'Deutsch',
    dir: 'de/',
  },
  {
    code: 'fr',
    hreflang: 'fr',
    ogLocale: 'fr_FR',
    name: 'French',
    nativeName: 'Français',
    dir: 'fr/',
  },
  {
    code: 'it',
    hreflang: 'it',
    ogLocale: 'it_IT',
    name: 'Italian',
    nativeName: 'Italiano',
    dir: 'it/',
  },
  {
    code: 'es',
    hreflang: 'es',
    ogLocale: 'es_ES',
    name: 'Spanish',
    nativeName: 'Español',
    dir: 'es/',
  },
]);

export const LANG_CODES = Object.freeze(LANGS.map((l) => l.code));

/** Public URL path for a language's home page (trailing slash; en is `/`). */
export function pathForLang(code) {
  if (code === DEFAULT_LANG) return '/';
  const lang = LANGS.find((l) => l.code === code);
  if (lang === undefined) {
    throw new Error(`unknown language code: ${code}`);
  }
  return `/${lang.dir}`;
}

/** Repo-relative HTML file for a language home page. */
export function fileForLang(code) {
  if (code === DEFAULT_LANG) return 'index.html';
  const lang = LANGS.find((l) => l.code === code);
  if (lang === undefined) {
    throw new Error(`unknown language code: ${code}`);
  }
  return `${lang.dir}index.html`;
}

/** Absolute site URL for a language home page. */
export function urlForLang(origin, code) {
  return `${origin}${pathForLang(code)}`;
}

/**
 * Extract hreflang → href map from HTML. Returns {} when none present.
 * Only considers link[rel=alternate][hreflang].
 */
export function extractHreflangMap(html) {
  const map = {};
  for (const m of html.matchAll(/<link\b[^>]*\brel=["']alternate["'][^>]*>/gi)) {
    const tag = m[0];
    const hl = tag.match(/\bhreflang=["']([^"']+)["']/i);
    const href = tag.match(/\bhref=["']([^"']+)["']/i);
    if (hl && href) map[hl[1]] = href[1];
  }
  return map;
}

/**
 * Expected hreflang map for any public locale page: every language + x-default
 * pointing at the English root.
 */
export function expectedHreflangMap(origin) {
  const map = { 'x-default': urlForLang(origin, DEFAULT_LANG) };
  for (const lang of LANGS) {
    map[lang.hreflang] = urlForLang(origin, lang.code);
  }
  return map;
}

/**
 * Language-switcher hrefs (root-absolute paths) expected on every page.
 * Same set for the single-page site: each language's home.
 */
export function expectedSwitcherPaths() {
  return LANGS.map((l) => pathForLang(l.code));
}

/**
 * Structural fingerprint used for cross-locale drift detection.
 * sectionIds: space-joined id attributes of <section> elements (empty string for
 * sections without id). anchors: count of a[href^="#"].
 */
export function structuralFingerprint(html) {
  const sectionIds = [];
  for (const m of html.matchAll(/<section\b([^>]*)>/gi)) {
    const id = m[1].match(/\bid=["']([^"']+)["']/i);
    sectionIds.push(id ? id[1] : '');
  }
  const anchors = [...html.matchAll(/<a\b[^>]*\bhref=["']#[^"']*["']/gi)].length;
  return {
    sections: sectionIds.length,
    sectionIds: sectionIds.join(','),
    anchors,
  };
}

/**
 * Extract language-switcher hrefs from .lang__menu a elements.
 * Falls back to empty array if the menu is missing.
 */
export function extractSwitcherHrefs(html) {
  const menu = html.match(
    /<div\b[^>]*\bclass=["'][^"']*\blang__menu\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  if (!menu) return [];
  return [...menu[1].matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)].map((m) => m[1]);
}
