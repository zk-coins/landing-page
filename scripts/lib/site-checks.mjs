// Pure, side-effect-free helpers for the static-site completeness gate
// (scripts/check-site.mjs). Extracted here so the parsing/classification logic is
// unit-tested to 100% independently of the filesystem (test/site-checks.test.mjs).
// No DOM, no fs — strings, regexes and URLs only.

// --- small string utilities --------------------------------------------------

export function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

export function collapseWs(text) {
  return text.replace(/\s+/g, ' ').trim();
}

const NAMED_ENTITIES = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
  ['mdash', '—'],
  ['ndash', '–'],
  ['hellip', '…'],
  ['times', '×'],
]);

// Decode the HTML entities that can legitimately differ between the markup and
// the JSON-LD representation of the same text (e.g. `&amp;` vs `&`), so the FAQ
// parity check compares meaning, not encoding. An unknown/out-of-range entity is
// left verbatim (a real drift then still surfaces).
export function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body) => {
    if (body[0] === '#') {
      const isHex = body[1].toLowerCase() === 'x';
      const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (Number.isNaN(code) || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    const named = NAMED_ENTITIES.get(body.toLowerCase());
    return named === undefined ? whole : named;
  });
}

// --- <head> extraction -------------------------------------------------------

// Derive the value of <link rel="canonical" href="...">, or null.
export function extractCanonical(html) {
  const link = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i);
  if (!link) return null;
  const href = link[0].match(/\bhref=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

// Derive the value of <meta property="og:url" content="...">, or null.
export function extractOgUrl(html) {
  const meta = html.match(/<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/i);
  if (!meta) return null;
  const content = meta[0].match(/\bcontent=["']([^"']+)["']/i);
  return content ? content[1] : null;
}

// Derive the value of <meta property="og:image" content="...">, or null.
export function extractOgImage(html) {
  const meta = html.match(/<meta\b[^>]*\bproperty=["']og:image["'][^>]*>/i);
  if (!meta) return null;
  const content = meta[0].match(/\bcontent=["']([^"']+)["']/i);
  return content ? content[1] : null;
}

// Derive the <html lang="..."> value, or null.
export function extractHtmlLang(html) {
  const m = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// --- structured / referenced content -----------------------------------------

// All JSON-LD block bodies (raw, trimmed strings) on a page.
export function extractJsonLdBlocks(html) {
  const blocks = [];
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

// Every id="..." declared in the document (the valid targets for same-page
// #anchors).
export function extractIds(html) {
  const ids = new Set();
  for (const m of html.matchAll(/\bid=["']([^"']+)["']/gi)) ids.add(m[1]);
  return ids;
}

// Every href/src reference value on a page.
export function extractReferences(html) {
  const refs = [];
  for (const m of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) refs.push(m[1]);
  return refs;
}

// <loc> entries from a sitemap, trimmed.
export function extractSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

// Visible FAQ, from <details><summary>Q</summary>…answer…</details> blocks
// inside the FAQ region only (so the language-switcher <details class="lang">
// is never counted). Prefer the #faq section; fall back to .faq; fall back to
// every <details> that is not class="lang". The answer is everything after the
// summary (all <p> merged), tag-stripped and entity-decoded so it compares
// equal to the JSON-LD plain text.
export function extractDetailsFaq(html) {
  let scope = html;
  const faqSection = html.match(/<section\b[^>]*\bid=["']faq["'][^>]*>([\s\S]*?)<\/section>/i);
  if (faqSection) {
    scope = faqSection[1];
  } else {
    const faqDiv = html.match(
      /<div\b[^>]*\bclass=["'][^"']*\bfaq\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    );
    if (faqDiv) scope = faqDiv[1];
  }

  const faq = [];
  for (const block of scope.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/gi)) {
    const attrs = block[1];
    // Skip the language switcher (and any other non-FAQ details) when we fell
    // back to the whole document.
    if (/\bclass=["'][^"']*\blang\b/i.test(attrs)) continue;
    const inner = block[2];
    const summary = inner.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    if (!summary) continue;
    const answerHtml = inner.replace(/<summary[^>]*>[\s\S]*?<\/summary>/i, '');
    faq.push({
      question: collapseWs(decodeEntities(stripTags(summary[1]))),
      answer: collapseWs(decodeEntities(stripTags(answerHtml))),
    });
  }
  return faq;
}

// FAQ { question, answer } pairs from a parsed JSON-LD graph's FAQPage node(s).
// A malformed question (no string name) is skipped so the count drops below the
// visible FAQ and the parity check fails loudly rather than inventing text.
export function faqFromJsonLd(parsed) {
  const graph = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
  const out = [];
  for (const node of graph) {
    if (!node || node['@type'] !== 'FAQPage' || !Array.isArray(node.mainEntity)) continue;
    for (const q of node.mainEntity) {
      if (!q || typeof q.name !== 'string') continue;
      const hasText =
        q.acceptedAnswer &&
        typeof q.acceptedAnswer === 'object' &&
        typeof q.acceptedAnswer.text === 'string';
      const answer = hasText ? q.acceptedAnswer.text : '';
      out.push({
        question: collapseWs(decodeEntities(q.name)),
        answer: collapseWs(decodeEntities(answer)),
      });
    }
  }
  return out;
}

// --- link classification -----------------------------------------------------

// Classify a single href/src value against the site origin:
//   { kind: 'skip' }               — mailto/tel/js/data/protocol-relative/empty
//   { kind: 'anchor', id }         — same-page #id (id must exist in the doc)
//   { kind: 'external' }           — absolute URL on a different origin
//   { kind: 'internal', pathname } — same-origin/relative path to resolve to a file
//   { kind: 'invalid', reason }    — an absolute URL that will not parse
export function classifyReference(raw, origin) {
  const value = raw.trim();
  if (value === '') return { kind: 'skip' };
  if (/^(mailto:|tel:|javascript:|data:)/i.test(value)) return { kind: 'skip' };
  if (value.startsWith('//')) return { kind: 'skip' }; // protocol-relative → external CDN
  if (value.startsWith('#')) return { kind: 'anchor', id: value.slice(1) };

  if (/^https?:\/\//i.test(value)) {
    let url;
    try {
      url = new URL(value);
    } catch {
      return { kind: 'invalid', reason: `unparsable URL "${raw}"` };
    }
    if (url.origin !== origin) return { kind: 'external' };
    return { kind: 'internal', pathname: url.pathname };
  }

  const pathname = ('/' + value.replace(/^\.?\//, '')).split('#')[0].split('?')[0];
  return { kind: 'internal', pathname };
}

// Map a URL pathname to the repo-relative file it must resolve to (mirrors the
// dev server / Cloudflare Pages: '/' -> 'index.html', '/dir/' -> 'dir/index.html').
// Returns null for a path that decodes badly or escapes the root — a caller then
// fails it rather than serving something outside the site.
export function pathnameToRelFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.split('#')[0].split('?')[0]);
  } catch {
    return null;
  }
  let rel = decoded.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  // Reject a traversal segment on either separator (defensive; the deploy target
  // is POSIX, but a bare '\' must never sneak a '..' past this).
  if (rel.split(/[\\/]/).includes('..')) return null;
  if (rel.endsWith('/')) rel += 'index.html';
  return rel;
}
