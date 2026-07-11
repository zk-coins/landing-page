#!/usr/bin/env node
/**
 * Static-site completeness gate for the zkCoins landing page.
 *
 * Fails closed (exit 1) on any structural defect a contributor could ship without
 * noticing on a no-build static site:
 *   - invalid JSON (.well-known/nostr.json) or invalid JSON-LD
 *   - a NIP-05 name that is not a 64-char hex pubkey
 *   - a same-page #anchor whose target id does not exist
 *   - an internal link / asset reference that does not resolve to a file
 *   - a sitemap <loc> that does not resolve, is off-origin, or a public page
 *     missing from the sitemap
 *   - a missing/foreign/insecure canonical or og:url/og:image, or a missing or
 *     malformed <html lang>
 *   - a robots.txt Sitemap: line that is off-origin or does not resolve
 *   - drift between the visible FAQ and the FAQPage JSON-LD (question or answer)
 *   - i18n: missing locale pages, wrong lang/hreflang/og:url, incomplete
 *     language switcher, or structural drift across locales
 *
 * The parsing/classification logic lives in scripts/lib/site-checks.mjs and
 * scripts/lib/i18n.mjs and is unit-tested to 100%; this file wires it to the
 * filesystem.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_LANG,
  LANGS,
  expectedHreflangMap,
  expectedSwitcherPaths,
  extractHreflangMap,
  extractSwitcherHrefs,
  fileForLang,
  pathForLang,
  structuralFingerprint,
  urlForLang,
} from './lib/i18n.mjs';
import { PAGES } from './lib/pages.mjs';
import {
  classifyReference,
  extractCanonical,
  extractDetailsFaq,
  extractHtmlLang,
  extractIds,
  extractJsonLdBlocks,
  extractOgImage,
  extractOgUrl,
  extractReferences,
  extractSitemapLocs,
  faqFromJsonLd,
  pathnameToRelFile,
} from './lib/site-checks.mjs';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const read = (file) => readFileSync(join(root, file), 'utf8');

if (!existsSync(join(root, 'index.html'))) {
  console.error('error    index.html: missing');
  process.exit(1);
}
if (!existsSync(join(root, 'styles.css'))) {
  fail('styles.css: missing — shared stylesheet required for all locales');
}

const index = read('index.html');

// --- origin ------------------------------------------------------------------
const canonicalHref = extractCanonical(index);
const ogUrlHref = extractOgUrl(index);
const originSource = canonicalHref !== null ? canonicalHref : ogUrlHref;
let ORIGIN = null;
if (originSource === null) {
  fail('index.html: no canonical or og:url to derive the site origin from');
} else {
  try {
    ORIGIN = new URL(originSource).origin;
  } catch {
    fail(`index.html: canonical/og:url "${originSource}" is not an absolute URL`);
  }
}

// --- file resolution ---------------------------------------------------------
function resolvesToFile(pathname) {
  const rel = pathnameToRelFile(pathname);
  if (rel === null) return false;
  let target = join(root, rel);
  if (!target.startsWith(root)) return false;
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, 'index.html');
  }
  return existsSync(target) && statSync(target).isFile();
}

function checkSameOriginHttps(label, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} "${value}" is not an absolute URL`);
    return;
  }
  if (url.protocol !== 'https:') fail(`${label} "${value}" is not https`);
  if (ORIGIN !== null && url.origin !== ORIGIN) fail(`${label} "${value}" is not on ${ORIGIN}`);
}

// --- 1. nostr.json (NIP-05) --------------------------------------------------
const NOSTR_FILE = '.well-known/nostr.json';
if (!existsSync(join(root, NOSTR_FILE))) {
  fail(`${NOSTR_FILE}: missing`);
} else {
  let nostr;
  let parsed = false;
  try {
    nostr = JSON.parse(read(NOSTR_FILE));
    parsed = true;
  } catch (error) {
    fail(`${NOSTR_FILE}: invalid JSON — ${error.message}`);
  }
  if (parsed) {
    const names =
      nostr && typeof nostr === 'object' && !Array.isArray(nostr) ? nostr.names : undefined;
    if (!names || typeof names !== 'object') {
      fail(`${NOSTR_FILE}: no "names" object`);
    } else {
      const entries = Object.entries(names);
      if (entries.length === 0) fail(`${NOSTR_FILE}: "names" is empty`);
      for (const [name, pubkey] of entries) {
        if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/.test(pubkey)) {
          fail(`${NOSTR_FILE}: name "${name}" does not map to a 64-char hex pubkey`);
        }
      }
    }
  }
}

// --- 2. Per-locale page checks -----------------------------------------------
const fingerprints = {};
let totalJsonLd = 0;
let totalFaq = 0;
const expectedHl = ORIGIN !== null ? expectedHreflangMap(ORIGIN) : null;
const expectedSwitcher = expectedSwitcherPaths();

for (const lang of LANGS) {
  const rel = fileForLang(lang.code);
  if (!existsSync(join(root, rel))) {
    fail(`${rel}: missing — every language must ship a home page`);
    continue;
  }
  const html = read(rel);
  const ids = extractIds(html);

  // 2a. html lang
  const htmlLang = extractHtmlLang(html);
  if (htmlLang === null) {
    fail(`${rel}: <html> has no lang attribute`);
  } else if (htmlLang !== lang.code) {
    fail(`${rel}: <html lang="${htmlLang}"> should be "${lang.code}"`);
  } else if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(htmlLang)) {
    fail(`${rel}: <html lang="${htmlLang}"> is not a plausible BCP-47 language tag`);
  }

  // 2b. canonical + og:url
  const canonical = extractCanonical(html);
  const ogUrl = extractOgUrl(html);
  const expectedUrl = ORIGIN !== null ? urlForLang(ORIGIN, lang.code) : null;
  if (canonical === null) {
    fail(`${rel}: missing <link rel="canonical">`);
  } else {
    checkSameOriginHttps(`${rel}: canonical`, canonical);
    if (expectedUrl !== null && canonical !== expectedUrl) {
      fail(`${rel}: canonical should be ${expectedUrl}, got ${canonical}`);
    }
  }
  if (ogUrl === null) {
    fail(`${rel}: missing <meta property="og:url">`);
  } else {
    checkSameOriginHttps(`${rel}: og:url`, ogUrl);
    if (expectedUrl !== null && ogUrl !== expectedUrl) {
      fail(`${rel}: og:url should be ${expectedUrl}, got ${ogUrl}`);
    }
  }

  const ogImage = extractOgImage(html);
  if (ogImage !== null) {
    checkSameOriginHttps(`${rel}: og:image`, ogImage);
    const ref = classifyReference(ogImage, ORIGIN);
    if (ref.kind === 'internal' && !resolvesToFile(ref.pathname)) {
      fail(`${rel}: og:image "${ogImage}" does not resolve to a file`);
    }
  }

  // 2c. hreflang complete + exact
  if (expectedHl !== null) {
    const map = extractHreflangMap(html);
    for (const [hl, href] of Object.entries(expectedHl)) {
      if (map[hl] !== href) {
        fail(`${rel}: hreflang "${hl}" should point to ${href}, got ${map[hl] ?? '(missing)'}`);
      }
    }
    for (const hl of Object.keys(map)) {
      if (!(hl in expectedHl)) fail(`${rel}: unexpected hreflang "${hl}"`);
    }
  }

  // 2d. language switcher
  const switcher = extractSwitcherHrefs(html);
  const missingLinks = expectedSwitcher.filter((p) => !switcher.includes(p));
  if (missingLinks.length) {
    fail(`${rel}: language switcher missing link(s): ${missingLinks.join(', ')}`);
  }
  const extraLinks = switcher.filter((p) => !expectedSwitcher.includes(p));
  if (extraLinks.length) {
    fail(`${rel}: language switcher has unexpected link(s): ${extraLinks.join(', ')}`);
  }

  // 2e. shared stylesheet
  if (!html.includes('href="/styles.css"') && !html.includes("href='/styles.css'")) {
    fail(`${rel}: missing root-absolute /styles.css link`);
  }

  // 2f. JSON-LD + FAQ parity
  const jsonLdBlocks = extractJsonLdBlocks(html);
  if (jsonLdBlocks.length === 0) fail(`${rel}: no JSON-LD structured data found`);
  const parsedJsonLd = [];
  for (const block of jsonLdBlocks) {
    try {
      parsedJsonLd.push(JSON.parse(block));
    } catch (error) {
      fail(`${rel}: invalid JSON-LD — ${error.message}`);
    }
  }
  totalJsonLd += jsonLdBlocks.length;

  const visibleFaq = extractDetailsFaq(html);
  const jsonLdFaq = parsedJsonLd.flatMap((doc) => faqFromJsonLd(doc));
  if (visibleFaq.length === 0) {
    fail(`${rel}: no visible FAQ <details> found`);
  } else if (jsonLdFaq.length !== visibleFaq.length) {
    fail(
      `${rel}: FAQ parity: ${visibleFaq.length} visible <details> but ${jsonLdFaq.length} FAQPage entries in JSON-LD`,
    );
  } else {
    for (let i = 0; i < visibleFaq.length; i += 1) {
      if (visibleFaq[i].question !== jsonLdFaq[i].question) {
        fail(
          `${rel}: FAQ parity: question ${i + 1} differs — visible "${visibleFaq[i].question}" vs JSON-LD "${jsonLdFaq[i].question}"`,
        );
      }
      if (visibleFaq[i].answer !== jsonLdFaq[i].answer) {
        fail(
          `${rel}: FAQ parity: answer for "${visibleFaq[i].question}" differs between the page and JSON-LD`,
        );
      }
    }
  }
  totalFaq += visibleFaq.length;

  // 2g. internal references
  for (const raw of extractReferences(html)) {
    const ref = classifyReference(raw, ORIGIN);
    if (ref.kind === 'anchor') {
      if (!ids.has(ref.id)) fail(`${rel}: same-page anchor "#${ref.id}" has no matching id`);
    } else if (ref.kind === 'internal') {
      if (!resolvesToFile(ref.pathname)) {
        fail(`${rel}: internal reference does not resolve — "${raw}"`);
      }
    } else if (ref.kind === 'invalid') {
      fail(`${rel}: ${ref.reason}`);
    }
  }

  fingerprints[lang.code] = structuralFingerprint(html);
}

// --- 3. Structural parity across languages -----------------------------------
const refFp = fingerprints[DEFAULT_LANG];
if (refFp) {
  for (const lang of LANGS) {
    if (lang.code === DEFAULT_LANG) continue;
    const fp = fingerprints[lang.code];
    if (!fp) continue;
    for (const key of ['sections', 'sectionIds', 'anchors']) {
      if (fp[key] !== refFp[key]) {
        fail(
          `${fileForLang(lang.code)}: structure drift: ${key} = ${fp[key]} but ${DEFAULT_LANG} has ${refFp[key]}`,
        );
      }
    }
  }
}

// --- 4. sitemap consistency --------------------------------------------------
let sitemapLocs = [];
if (!existsSync(join(root, 'sitemap.xml'))) {
  fail('sitemap.xml: missing');
} else {
  const sitemapXml = read('sitemap.xml');
  sitemapLocs = extractSitemapLocs(sitemapXml);
  if (sitemapLocs.length === 0) fail('sitemap.xml: no <loc> entries');

  // xhtml:link alternates must resolve when present
  for (const m of sitemapXml.matchAll(/\bhref=["'](https?:\/\/[^"']+)["']/gi)) {
    const href = m[1];
    let url;
    try {
      url = new URL(href);
    } catch {
      fail(`sitemap.xml: unparsable alternate href "${href}"`);
      continue;
    }
    if (ORIGIN !== null && url.origin !== ORIGIN) {
      fail(`sitemap.xml: alternate "${href}" is not on ${ORIGIN}`);
    } else if (!resolvesToFile(url.pathname)) {
      fail(`sitemap.xml: alternate "${href}" does not resolve to a file`);
    }
  }
}
const sitemapPathnames = new Set();
for (const loc of sitemapLocs) {
  let url;
  try {
    url = new URL(loc);
  } catch {
    fail(`sitemap.xml: unparsable <loc> "${loc}"`);
    continue;
  }
  sitemapPathnames.add(url.pathname);
  if (ORIGIN !== null && url.origin !== ORIGIN) {
    fail(`sitemap.xml: <loc> "${loc}" is not on the site origin ${ORIGIN}`);
    continue;
  }
  if (!resolvesToFile(url.pathname)) fail(`sitemap.xml: <loc> "${loc}" does not resolve to a file`);
}
for (const page of PAGES) {
  if (!sitemapPathnames.has(page)) {
    fail(`sitemap.xml: public page "${page}" is not listed`);
  }
}
// Every language root must be present
if (ORIGIN !== null) {
  for (const lang of LANGS) {
    const p = pathForLang(lang.code);
    if (!sitemapPathnames.has(p)) {
      fail(`sitemap.xml: missing language landing page ${p}`);
    }
  }
}

// --- 5. robots.txt Sitemap line ---------------------------------------------
if (existsSync(join(root, 'robots.txt'))) {
  const robots = read('robots.txt');
  const sitemapLine = robots.match(/^\s*Sitemap:\s*(\S+)\s*$/im);
  if (!sitemapLine) {
    fail('robots.txt: no Sitemap: directive');
  } else {
    let url;
    try {
      url = new URL(sitemapLine[1]);
    } catch {
      fail(`robots.txt: unparsable Sitemap URL "${sitemapLine[1]}"`);
      url = null;
    }
    if (url) {
      if (ORIGIN !== null && url.origin !== ORIGIN) {
        fail(`robots.txt: Sitemap "${sitemapLine[1]}" is not on ${ORIGIN}`);
      } else if (!resolvesToFile(url.pathname)) {
        fail(`robots.txt: Sitemap "${sitemapLine[1]}" does not resolve to a file`);
      }
    }
  }
}

// --- report ------------------------------------------------------------------
if (errors.length > 0) {
  for (const message of errors) console.error(`error    ${message}`);
  console.error(`\ncheck-site: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(
  `check-site: OK — ${LANGS.length} languages, ${totalJsonLd} JSON-LD block(s), ` +
    `${totalFaq} FAQ entries, ${sitemapLocs.length} sitemap entr(y/ies), all references resolve.`,
);
