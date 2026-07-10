import { describe, expect, test } from 'vitest';
import {
  classifyReference,
  collapseWs,
  decodeEntities,
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
  stripTags,
} from '../scripts/lib/site-checks.mjs';
import { DEFAULT_MIME, mimeFor } from '../scripts/lib/mime.mjs';

const ORIGIN = 'https://zkcoins.com';

describe('string utilities', () => {
  test('stripTags removes tags', () => {
    expect(stripTags('a <b>bold</b> <br/>word')).toBe('a bold word');
  });

  test('collapseWs collapses runs of whitespace and trims', () => {
    expect(collapseWs('  a\n  b   c  ')).toBe('a b c');
  });
});

describe('decodeEntities', () => {
  test('decodes named entities and leaves unknown ones verbatim', () => {
    expect(decodeEntities('a &amp; b, &lt;tag&gt; &mdash; &bogus;')).toBe('a & b, <tag> — &bogus;');
  });

  test('decodes decimal and hex numeric entities', () => {
    expect(decodeEntities('&#39;quote&#39; dash&#x2014;end')).toBe("'quote' dash—end");
  });

  test('leaves malformed or out-of-range numeric entities verbatim', () => {
    expect(decodeEntities('&#abc;')).toBe('&#abc;');
    expect(decodeEntities('&#999999999;')).toBe('&#999999999;');
  });
});

describe('head extraction', () => {
  test('extractCanonical reads the href', () => {
    expect(extractCanonical('<link rel="canonical" href="https://zkcoins.com/" />')).toBe(
      'https://zkcoins.com/',
    );
  });

  test('extractCanonical returns null when absent', () => {
    expect(extractCanonical('<link rel="icon" href="/favicon.png">')).toBeNull();
  });

  test('extractCanonical returns null when the tag has no href', () => {
    expect(extractCanonical('<link rel="canonical">')).toBeNull();
  });

  test('extractOgUrl reads the content', () => {
    expect(extractOgUrl('<meta property="og:url" content="https://zkcoins.com" />')).toBe(
      'https://zkcoins.com',
    );
  });

  test('extractOgUrl returns null when absent', () => {
    expect(extractOgUrl('<meta property="og:title" content="x">')).toBeNull();
  });

  test('extractOgUrl returns null when the tag has no content', () => {
    expect(extractOgUrl('<meta property="og:url">')).toBeNull();
  });

  test('extractOgImage reads the content and returns null otherwise', () => {
    expect(
      extractOgImage('<meta property="og:image" content="https://zkcoins.com/favicon.png">'),
    ).toBe('https://zkcoins.com/favicon.png');
    expect(extractOgImage('<meta property="og:image">')).toBeNull();
    expect(extractOgImage('<meta name="theme-color" content="#000">')).toBeNull();
  });

  test('extractHtmlLang reads the lang and returns null otherwise', () => {
    expect(extractHtmlLang('<html lang="en">')).toBe('en');
    expect(extractHtmlLang('<html>')).toBeNull();
  });
});

describe('structured content extraction', () => {
  test('extractJsonLdBlocks returns each block body, or an empty list', () => {
    const html =
      '<script type="application/ld+json">{"a":1}</script>' +
      '<script type="application/ld+json"> {"b":2} </script>';
    expect(extractJsonLdBlocks(html)).toEqual(['{"a":1}', '{"b":2}']);
    expect(extractJsonLdBlocks('<p>no ld here</p>')).toEqual([]);
  });

  test('extractIds collects every id', () => {
    const ids = extractIds('<a id="main"></a><section id="faq"></section>');
    expect([...ids].sort()).toEqual(['faq', 'main']);
  });

  test('extractReferences collects href and src values', () => {
    const refs = extractReferences('<a href="#x"></a><img src="/favicon.png">');
    expect(refs).toEqual(['#x', '/favicon.png']);
  });

  test('extractSitemapLocs reads and trims <loc> entries', () => {
    expect(
      extractSitemapLocs('<loc> https://zkcoins.com/ </loc><loc>https://zkcoins.com/a</loc>'),
    ).toEqual(['https://zkcoins.com/', 'https://zkcoins.com/a']);
  });

  test('extractDetailsFaq merges answer <p>s, decodes entities, skips summary-less blocks', () => {
    const html =
      '<details><summary>What is <b>zkCoins</b>?</summary><p>A wallet.</p></details>' +
      '<details open><summary>Fast &amp; private?</summary><p>Yes.</p>\n<p>Very.</p></details>' +
      '<details><p>orphan paragraph, no summary</p></details>';
    expect(extractDetailsFaq(html)).toEqual([
      { question: 'What is zkCoins?', answer: 'A wallet.' },
      { question: 'Fast & private?', answer: 'Yes. Very.' },
    ]);
  });
});

describe('faqFromJsonLd', () => {
  test('reads FAQPage entries from a @graph', () => {
    const parsed = {
      '@graph': [
        { '@type': 'WebSite' },
        {
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: 'Q1', acceptedAnswer: { '@type': 'Answer', text: 'A1' } },
          ],
        },
      ],
    };
    expect(faqFromJsonLd(parsed)).toEqual([{ question: 'Q1', answer: 'A1' }]);
  });

  test('reads a single-node FAQPage (no @graph)', () => {
    const parsed = {
      '@type': 'FAQPage',
      mainEntity: [{ name: 'Q', acceptedAnswer: { text: 'A' } }],
    };
    expect(faqFromJsonLd(parsed)).toEqual([{ question: 'Q', answer: 'A' }]);
  });

  test('skips null nodes, non-FAQPage nodes and nodes without a mainEntity array', () => {
    expect(faqFromJsonLd({ '@graph': [null] })).toEqual([]);
    expect(faqFromJsonLd({ '@graph': [{ '@type': 'Organization' }] })).toEqual([]);
    expect(faqFromJsonLd({ '@type': 'FAQPage', mainEntity: 'nope' })).toEqual([]);
  });

  test('skips null / non-string-name questions and defaults a missing or non-string answer to ""', () => {
    const parsed = {
      '@type': 'FAQPage',
      mainEntity: [
        null,
        { name: 123, acceptedAnswer: { text: 'ignored' } },
        { name: 'NoAnswer' },
        { name: 'StrAnswer', acceptedAnswer: 'not-an-object' },
        { name: 'ObjNoStringText', acceptedAnswer: { text: 123 } },
      ],
    };
    expect(faqFromJsonLd(parsed)).toEqual([
      { question: 'NoAnswer', answer: '' },
      { question: 'StrAnswer', answer: '' },
      { question: 'ObjNoStringText', answer: '' },
    ]);
  });
});

describe('classifyReference', () => {
  test('skips empty, mailto, tel, javascript, data and protocol-relative', () => {
    for (const raw of [
      '',
      '   ',
      'mailto:a@b.c',
      'tel:+1',
      'javascript:void(0)',
      'data:x',
      '//cdn/x.js',
    ]) {
      expect(classifyReference(raw, ORIGIN).kind).toBe('skip');
    }
  });

  test('recognises a same-page anchor', () => {
    expect(classifyReference('#faq', ORIGIN)).toEqual({ kind: 'anchor', id: 'faq' });
  });

  test('flags an absolute URL on another origin as external', () => {
    expect(classifyReference('https://eprint.iacr.org/2025/068', ORIGIN).kind).toBe('external');
  });

  test('treats a same-origin absolute URL as internal with its pathname', () => {
    expect(classifyReference('https://zkcoins.com/favicon.svg', ORIGIN)).toEqual({
      kind: 'internal',
      pathname: '/favicon.svg',
    });
  });

  test('flags an unparsable absolute URL as invalid', () => {
    expect(classifyReference('https://', ORIGIN).kind).toBe('invalid');
  });

  test('treats a relative reference as internal and strips query/hash', () => {
    expect(classifyReference('./favicon.png?x=1#y', ORIGIN)).toEqual({
      kind: 'internal',
      pathname: '/favicon.png',
    });
  });
});

describe('pathnameToRelFile', () => {
  test('maps the root to index.html', () => {
    expect(pathnameToRelFile('/')).toBe('index.html');
  });

  test('maps a file path to its relative path, dropping query/hash', () => {
    expect(pathnameToRelFile('/favicon.png?v=2#a')).toBe('favicon.png');
  });

  test('maps a directory path to its index.html', () => {
    expect(pathnameToRelFile('/brand/')).toBe('brand/index.html');
  });

  test('rejects a path that escapes the root', () => {
    expect(pathnameToRelFile('/../secret')).toBeNull();
  });

  test('rejects a traversal segment written with a backslash', () => {
    expect(pathnameToRelFile('/..\\secret')).toBeNull();
  });

  test('rejects a path that does not decode', () => {
    expect(pathnameToRelFile('/%')).toBeNull();
  });
});

describe('mimeFor', () => {
  test('resolves a known extension from a bare extension or a path', () => {
    expect(mimeFor('.svg')).toBe('image/svg+xml');
    expect(mimeFor('a/b/favicon.png')).toBe('image/png');
  });

  test('is case-insensitive', () => {
    expect(mimeFor('LOGO.PNG')).toBe('image/png');
  });

  test('falls back to the default for unknown or extensionless names', () => {
    expect(mimeFor('.zzz')).toBe(DEFAULT_MIME);
    expect(mimeFor('README')).toBe(DEFAULT_MIME);
  });
});
