# Contributing

Thanks for thinking about contributing to `zkcoins.com`.

This repo is a **static multilingual landing page**: one home page per language (`index.html`, `de/`, `fr/`, `it/`, `es/`), shared `/styles.css`, no runtime JavaScript, no build step for the deployed site. Keep it that way unless you have a very good reason.

Locale pages are generated from `scripts/i18n/` (`page.template` + `strings/*.json`). After editing strings, run:

```bash
python3 scripts/i18n/generate.py
```

Do not hand-edit only one locale copy — edit the string sources and regenerate so languages cannot drift.

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
npm run check   # prettier + html-validate + check:site + unit coverage
```

## Testing

The **deployed page stays plain HTML + inline CSS with no build step and no
runtime JavaScript** (see the style invariants above). Everything under this
section is *dev-only tooling*: it lives in `devDependencies`, never ships, and is
kept off the public CDN by `.assetsignore`. It exists so a whitespace slip, a
dead internal link, a broken structured-data block or an unintended visual change
can't reach production unnoticed.

| Script | What it does |
|---|---|
| `npm run serve` | Serve the site on `http://127.0.0.1:4173` (same routing the tests use) |
| `npm run format` / `format:check` | Prettier over the tooling sources (the page + content files are left as authored) |
| `npm run validate:html` | `html-validate` over every locale page |
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
