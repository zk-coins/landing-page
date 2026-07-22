# Contributing

Thanks for thinking about contributing to `zkcoins.com`.

This repo is a **static multilingual landing page**: one home page per language (`index.html`, `de/`, `fr/`, `it/`, `es/`), shared `/styles.css`, no runtime JavaScript, no build step for the deployed site. Keep it that way unless you have a very good reason.

Locale pages are generated from `scripts/i18n/` (`page.template` + `strings/*.json`). After editing strings, run:

```bash
python3 scripts/i18n/generate.py
```

Do not hand-edit only one locale copy — edit the string sources and regenerate so languages cannot drift.

Character references the author wrote expecting a parser to resolve them are rejected in every key listed in the `ATTR_KEYS` frozenset in `scripts/i18n/generate.py`, every key starting with `jsonld_`, and every `faq_q{n}` / `faq_a{n}` / `faq_a{n}_json` key — type the literal character instead (a no-break space is the literal U+00A0 character; it is invisible in a diff, so be deliberate about it). That includes semicolon-terminated forms (`&nbsp;`, `&mdash;`, `&#160;`, `&#x00a0;`) and semicolon-less legacy forms that are keys in the HTML5 named-character-reference table (`html.entities.html5`) — e.g. `&nbsp`, `&copy`, `&not`, `&amp` (no trailing semicolon). Numeric references (`&#160`, `&#160;`, `&#xa0`, …) are always rejected, with or without the trailing semicolon. A named form is flagged only when the matched token itself (the full alphanumeric run after `&`, with or without the semicolon, exactly as matched) is a key in that table — so `&mdash` (no semicolon) is accepted, while `&mdash;` is not, and tokens whose matched run is outside the table (`?tab=1&notes=2`, `?tab=1&notes`, `see ?tab=1&section.`, `AT&T`, `Q&A`, `100% & rising`, `R&D;`, `&bogus;`) are not flagged. Those untable ampersand strings are safe in every guarded key specifically because the generator escapes the ampersand at whichever sink needs it (HTML attributes via `html_attr()` and FAQ body copy via the `&` → `&amp;` pass in `main()` escape the ampersand; JSON-LD needs no escaping — `json.dumps` emits the ampersand verbatim, but it lands inside a `<script type="application/ld+json">` HTML raw-text element where a literal `&` is never parsed as a character reference) — not because a parser would leave them alone (a browser may still partially resolve some of them in raw body text, e.g. `?tab=1&notes=2` → `?tab=1¬es=2`). The guard is an exact table lookup on the matched name (plus the always-flag numeric rule); it is an authoring-intent check, not a security boundary — the sink escaping above is what keeps the page safe. A literal ampersand is fine in a guarded key unless the run of alphanumeric characters immediately following it (with or without a trailing semicolon) happens to be a name in the HTML5 table (`copy`, `not`, `sect`, `amp`, `nbsp`, and others) — e.g. `meta_description = "... see the terms &sect 4 ..."` and `og_description = "&copy 2026 zkCoins"` both fail the guard and the author must insert a space, rephrase, or otherwise break up the adjacency. FAQ answer keys are guarded unconditionally, even when a `_json` variant exists and makes that answer effectively body-only today (so the rule still holds if the variant is later removed). All other body-only keys may still use character references freely. If you add a new placeholder that ends up inside an HTML attribute in `page.template`, you must also add its key to `ATTR_KEYS`, or it gets neither HTML-escaping nor this character-reference guard. If you add a new string wired into `build_json_ld`, name it `jsonld_*` — `build_json_ld` cannot read locale strings directly; every read goes through a guarded accessor that hard-fails on any key `is_unsafe_sink_key` does not cover.

A visible FAQ answer (`faq_a{n}`) that contains HTML markup requires a matching markup-free `faq_a{n}_json` variant key for the FAQPage structured data; the generator hard-fails if markup is present without a variant. Every value that reaches the JSON-LD payload (including `jsonld_*`, `faq_q{n}`, and the effective FAQ answer) must be non-empty and free of `<`.

## Branching model

| Branch | Role | Protection | Deploys to |
|---|---|---|---|
| `develop` | active branch | required status checks must pass; direct pushes allowed | `dev.zkcoins.com` (preview) |
| `main` | release branch | review required; merges via the auto-created release PR | `zkcoins.com` (production) |

All real work happens on `develop`. `main` is fed by an automatic `develop -> main` release PR opened by `.github/workflows/auto-release-pr.yaml`.

## Local development

```bash
git clone https://github.com/zk-coins/landing-page.git
cd landing-page
npm ci
npm run serve   # http://127.0.0.1:4173 — Cloudflare-like routing for /de/ etc.
```

Edit `scripts/i18n/strings/<lang>.json` (and the template if structure changes), then regenerate. The deployed site has no npm runtime.

## Before you push

CI runs on every push and PR:

- **HTML Validate** — HTML5 validator (`.github/workflows/ci.yaml`)
- **Link Check** — lychee dead-link scanner (`ci.yaml`)
- **Workflow Lint** — actionlint on `.github/workflows/` (`ci.yaml`)
- **Workflow Security** — zizmor static analysis, SARIF uploaded to the Security tab (`ci.yaml`)
- **Quality** — prettier, site-completeness gate, unit tests at 100% coverage (`quality.yaml`)
- **Visual regression** — Playwright screenshots compared byte-for-byte against the committed baselines (`visual.yaml`)

If any check fails, fix the underlying problem rather than disabling the check.

Reproduce everything except the screenshots locally with:

```bash
npm ci
npm run check   # prettier + html-validate + i18n:check + check:site + unit coverage
```

## Testing

The **deployed site stays plain HTML + shared `/styles.css` with no build step and
no runtime JavaScript** (see the style invariants above). Everything under this
section is *dev-only tooling*: it lives in `devDependencies`, never ships, and is
kept off the public CDN by `.assetsignore`. It exists so a whitespace slip, a
dead internal link, a broken structured-data block or an unintended visual change
can't reach production unnoticed.

| Script | What it does |
|---|---|
| `npm run serve` | Serve the site on `http://127.0.0.1:4173` (same routing the tests use) |
| `npm run format` / `format:check` | Prettier over the tooling sources (the page + content files are left as authored) |
| `npm run validate:html` | `html-validate` over every locale page |
| `npm run i18n:generate` | Rebuild every locale home + sitemap from `scripts/i18n/` |
| `npm run i18n:check` | Regenerate and fail if committed HTML/sitemap drifted from the sources |
| `npm run check:site` | Static-completeness gate (see below) |
| `npm run test` / `test:coverage` | Vitest unit tests / with the enforced 100% coverage gate |
| `npm run test:e2e` | Playwright visual + smoke suite against local browsers |
| `npm run e2e:docker` | Playwright inside the pinned container — compare against baselines |
| `npm run e2e:docker:update` | Regenerate the screenshot baselines in the pinned container |

**Single source of truth.** The dev-server port, the pages under test, the
viewports and the visual matrix are declared once in
`scripts/lib/pages.mjs` and imported everywhere.

**Static completeness (`check:site`).** Fails closed on invalid JSON / JSON-LD, a
non-hex NIP-05 pubkey in `.well-known/nostr.json`, a same-page `#anchor` with no
target, an internal link/asset that does not resolve, a sitemap `<loc>` that is
off-origin or does not resolve (or a public page missing from the sitemap), a
missing/foreign/insecure canonical or `og:url`/`og:image`, a missing or malformed
`<html lang>`, a bad `robots.txt` `Sitemap:` line, drift between the visible FAQ
`<details>` and the `FAQPage` JSON-LD, missing locale pages, incomplete
`hreflang` / language switcher, or structural drift across languages.

**Unit coverage.** The site ships no product JavaScript, so the 100% coverage gate
targets the *pure logic behind the tooling* in `scripts/lib/**` (URL/reference
parsing, the visual matrix, MIME lookup). `all: true` means a new, untested
`scripts/lib/*.mjs` drops coverage below 100% and fails CI. The side-effecting
scripts (`dev-server`, `check-site`, `check-visual`) are exercised by CI running
them against the real site.

**Screenshot baselines.** The visual suite renders every view in the matrix
(default load + FAQ expanded) across three viewports (`desktop-chromium`,
`tablet-chromium`, `mobile-safari`) and compares byte-for-byte
(`maxDiffPixelRatio: 0`). Baselines live in `tests/__screenshots__/` and **must be
generated in the pinned Playwright container** so they match CI exactly:

```bash
npm run e2e:docker:update   # regenerate after any intended visual change
git add tests/__screenshots__
```

Without Docker, use **Actions → Update visual baselines → Run workflow** on your
feature branch (`.github/workflows/update-baselines.yaml`). It regenerates inside
the same pinned container CI uses and commits the PNGs back to the branch.

`scripts/check-visual.mjs` then guarantees the matrix is complete: every
view × viewport has a baseline, there are no orphans, and every visual test
passed. When you bump `@playwright/test`, bump the image tag in `visual.yaml`
and `update-baselines.yaml` together, then regenerate the baselines.

## Style invariants

These follow the **zkCoins Brand Guide v1.0** and must not change without an explicit brand decision:

- Ground `#0a0a0a`, accent `#f7931a` (Bitcoin orange); headings and the mark `#ffffff`, body text `#ece9e4`; warm-biased neutrals (never a dead grey). The espresso field `radial-gradient(120% 120% at 50% 26%, #a86a1f, #1a1005)` is the signature surface.
- The mark is the canonical **pixel-art Z monogram** (12×12 grid, `shape-rendering:crispEdges`, monochrome via `currentColor`) — never the old orange "zk" tile, never recoloured, skewed, or anti-aliased.
- Display name **zkCoins** (always capital C); lowercase `zkcoins` only in domains and handles.
- Tagline: *Private Bitcoin transactions via Shielded CSV*
- Type: **IBM Plex Mono** (wordmark, labels, data, numbers) + **IBM Plex Sans** (headings, body), each with a system fallback stack — no Google Fonts, no remote font CDN.
- Accent buttons are **black text on orange** (white on orange is misuse).
- Headings never end with a full stop.
- No JavaScript **except inert structured data** (`<script type="application/ld+json">` for SEO/AEO). No analytics pixel, no remote font CDN, no third-party iframe. Language switching is pure HTML/CSS (`<details class="lang">`) — no auto-redirect script.
- Languages: English at `/` (default, `x-default`), plus `de/`, `fr/`, `it/`, `es/`. Every locale must ship the same section structure, a complete hreflang set, and a language switcher linking all homes.
- Shared stylesheet is `/styles.css` (root-absolute on every page). Do not re-inline a divergent copy.
- The Shielded CSV paper (ePrint 2025/068) stays a prominent element of the page.

## Adding a language

A new locale needs the code added to `LANGS` in **both** `scripts/lib/i18n.mjs`
and `scripts/i18n/generate.py`, a translated `scripts/i18n/strings/<code>.json`,
**and** the new path added to the `i18n:check` and `validate:html` globs in
`package.json`. Miss those `package.json` lists and the drift gate silently stops
covering the new locale. In the string file, use literal characters (not HTML
character references) in `ATTR_KEYS`, `jsonld_*`, and FAQ (`faq_q{n}` /
`faq_a{n}` / `faq_a{n}_json`) keys — including FAQ answers that have a `_json`
variant — and include a `faq_a{n}_json` variant for any FAQ answer that
contains markup.

## Adding a new section

Prefer extending the i18n template (`scripts/i18n/page.template`) and every
`strings/*.json` over adding a new file. A second page should only exist if it
cannot reasonably live inline.

If a second page is added, it must:

- Exist in every supported language (parity)
- Reuse `/styles.css` and the same component classes
- Carry a complete hreflang set and language switcher for that page
- Be linked from the navigation/footer of every locale home
- Pass the same CI checks

## Reporting a security issue

Please report security issues privately via [GitHub Security Advisories](https://github.com/zk-coins/landing-page/security/advisories/new) rather than opening a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree your contribution is licensed under MIT (same as the repo).
