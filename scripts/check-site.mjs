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
 *
 * The parsing/classification logic lives in scripts/lib/site-checks.mjs and is
 * unit-tested to 100%; this file wires it to the filesystem.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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

const index = read('index.html');
const ids = extractIds(index);

// --- origin ------------------------------------------------------------------
// Derive the canonical origin from index.html rather than hard-coding it, so the
// gate follows the site if the domain ever moves.
const canonicalHref = extractCanonical(index);
const ogUrlHref = extractOgUrl(index);
const originSource = canonicalHref !== null ? canonicalHref : ogUrlHref;
if (originSource === null) {
  fail('index.html: no canonical or og:url to derive the site origin from');
}
const ORIGIN = originSource !== null ? new URL(originSource).origin : null;

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
  try {
    nostr = JSON.parse(read(NOSTR_FILE));
  } catch (error) {
    fail(`${NOSTR_FILE}: invalid JSON — ${error.message}`);
  }
  if (nostr) {
    if (!nostr.names || typeof nostr.names !== 'object') {
      fail(`${NOSTR_FILE}: no "names" object`);
    } else {
      const entries = Object.entries(nostr.names);
      if (entries.length === 0) fail(`${NOSTR_FILE}: "names" is empty`);
      for (const [name, pubkey] of entries) {
        if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/.test(pubkey)) {
          fail(`${NOSTR_FILE}: name "${name}" does not map to a 64-char hex pubkey`);
        }
      }
    }
  }
}

// --- 2. JSON-LD validity -----------------------------------------------------
const jsonLdBlocks = extractJsonLdBlocks(index);
if (jsonLdBlocks.length === 0) fail('index.html: no JSON-LD structured data found');
const parsedJsonLd = [];
for (const block of jsonLdBlocks) {
  try {
    parsedJsonLd.push(JSON.parse(block));
  } catch (error) {
    fail(`index.html: invalid JSON-LD — ${error.message}`);
  }
}

// --- 3. references (anchors + internal links resolve) ------------------------
for (const raw of extractReferences(index)) {
  const ref = classifyReference(raw, ORIGIN);
  if (ref.kind === 'anchor') {
    if (!ids.has(ref.id)) fail(`index.html: same-page anchor "#${ref.id}" has no matching id`);
  } else if (ref.kind === 'internal') {
    if (!resolvesToFile(ref.pathname)) {
      fail(`index.html: internal reference does not resolve — "${raw}"`);
    }
  } else if (ref.kind === 'invalid') {
    fail(`index.html: ${ref.reason}`);
  }
}

// --- 4. FAQ parity (visible <details> ↔ FAQPage JSON-LD) ---------------------
const visibleFaq = extractDetailsFaq(index);
const jsonLdFaq = parsedJsonLd.flatMap((doc) => faqFromJsonLd(doc));
if (visibleFaq.length === 0) {
  fail('index.html: no visible FAQ <details> found');
} else if (jsonLdFaq.length !== visibleFaq.length) {
  fail(
    `FAQ parity: ${visibleFaq.length} visible <details> but ${jsonLdFaq.length} FAQPage entries in JSON-LD`,
  );
} else {
  for (let i = 0; i < visibleFaq.length; i += 1) {
    if (visibleFaq[i].question !== jsonLdFaq[i].question) {
      fail(
        `FAQ parity: question ${i + 1} differs — visible "${visibleFaq[i].question}" vs JSON-LD "${jsonLdFaq[i].question}"`,
      );
    }
    if (visibleFaq[i].answer !== jsonLdFaq[i].answer) {
      fail(
        `FAQ parity: answer for "${visibleFaq[i].question}" differs between the page and JSON-LD`,
      );
    }
  }
}

// --- 5. sitemap consistency --------------------------------------------------
const sitemap = read('sitemap.xml');
const sitemapLocs = extractSitemapLocs(sitemap);
if (sitemapLocs.length === 0) fail('sitemap.xml: no <loc> entries');
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
  const expected = page === '/' ? '/' : page;
  if (!sitemapPathnames.has(expected)) {
    fail(`sitemap.xml: public page "${page}" is not listed`);
  }
}

// --- 6. canonical / og:url / og:image / <html lang> --------------------------
if (canonicalHref === null) {
  fail('index.html: missing <link rel="canonical">');
} else {
  checkSameOriginHttps('index.html: canonical', canonicalHref);
}
if (ogUrlHref !== null) checkSameOriginHttps('index.html: og:url', ogUrlHref);

const ogImage = extractOgImage(index);
if (ogImage !== null) {
  checkSameOriginHttps('index.html: og:image', ogImage);
  const ref = classifyReference(ogImage, ORIGIN);
  if (ref.kind === 'internal' && !resolvesToFile(ref.pathname)) {
    fail(`index.html: og:image "${ogImage}" does not resolve to a file`);
  }
}

const lang = extractHtmlLang(index);
if (lang === null) {
  fail('index.html: <html> has no lang attribute');
} else if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(lang)) {
  fail(`index.html: <html lang="${lang}"> is not a plausible BCP-47 language tag`);
}

// --- 7. robots.txt Sitemap line ---------------------------------------------
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
  `check-site: OK — ${jsonLdBlocks.length} JSON-LD block(s), ${visibleFaq.length} FAQ entries, ` +
    `${sitemapLocs.length} sitemap entr(y/ies), all references resolve.`,
);
