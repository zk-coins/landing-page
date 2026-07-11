# zkCoins — Landing Page (zkcoins.com)

[![CI](https://github.com/zk-coins/landing-page/actions/workflows/ci.yaml/badge.svg?branch=develop)](https://github.com/zk-coins/landing-page/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Static landing page for [zkcoins.com](https://zkcoins.com). Whitepaper-centric entry point for the Shielded CSV protocol that zkCoins is built on.

## Stack

- Plain HTML + shared CSS (`/styles.css`) — **no site build step**
- No runtime JavaScript (only inert `application/ld+json` structured data)
- Five languages: English (default), Deutsch, Français, Italiano, Español
- System / IBM Plex font stacks (no remote font CDN)
- Dev-only test tooling (Playwright + Vitest) — never shipped, kept off the CDN by `.assetsignore`

## Structure

```
.
├── index.html            — English home (default, x-default)
├── de/ fr/ it/ es/       — Localised homes
├── styles.css            — Shared stylesheet
├── favicon.svg / .png    — zkCoins mark
├── robots.txt            — crawler policy (AI answer engines welcome)
├── sitemap.xml           — all locales + xhtml:link alternates
├── llms.txt              — LLM-oriented site summary
├── .well-known/nostr.json — NIP-05 identity
├── brand/                — brand kit (logos, tokens)
├── scripts/i18n/         — template + strings + generator (dev-only)
├── scripts/              — dev server + check/test tooling
├── tests/                — Playwright specs + committed screenshot baselines
├── test/                 — Vitest unit tests
└── LICENSE               — MIT
```

## Local preview

```bash
npm ci
npm run serve
# open http://127.0.0.1:4173  (also /de/, /fr/, /it/, /es/)
```

After editing locale strings:

```bash
python3 scripts/i18n/generate.py
```

## Testing

```bash
npm ci
npm run check              # prettier + html-validate + site completeness + 100% unit coverage
npm run e2e:docker         # Playwright screenshots vs. the committed baselines (pinned container)
```

Screenshot baselines: `npm run e2e:docker:update`, or **Actions → Update visual baselines** without Docker. See [CONTRIBUTING.md](CONTRIBUTING.md#testing).

## Deploy — Cloudflare Pages

Production: [zkcoins.com](https://zkcoins.com) · Preview: [dev.zkcoins.com](https://dev.zkcoins.com)

Cloudflare Pages deploys `main` to production (zkcoins.com) and `develop` to the preview (dev.zkcoins.com). `main` is fed by an automatic `develop → main` release PR (`.github/workflows/auto-release-pr.yaml`).

### Setup (one-time)

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** → `zk-coins/landing-page`
2. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
   - **Production branch:** `main`
3. Custom domain: `zkcoins.com` (PRD) and `dev.zkcoins.com` (preview)

### Alternative — Wrangler CLI

```bash
npx wrangler pages deploy . --project-name=zkcoins-com --branch=main
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching model, local development, CI checks, and style invariants.

Security issues: see [SECURITY.md](SECURITY.md).

## Brand

Follows the zkCoins brand kit. Key invariants:

- Background `#0a0a0a`, accent `#f7931a` (Bitcoin orange), body `#ece9e4`, headings/mark `#ffffff`
- Display name **zkCoins** (always capital C)
- Tagline: *Private Bitcoin transactions via Shielded CSV*

## Related

| Domain | Purpose | Repo |
|---|---|---|
| zkcoins.com | Whitepaper landing | this repo |
| zkcoins.info | Brand hub | — |
| zkcoins.app | Wallet (PWA) | [zk-coins/app](https://github.com/zk-coins/app) |
| zkcoins.exchange | Trading venue | — |
| zkcoins.space | Explorer | — |
| docs.zkcoins.app | Documentation | [zk-coins/docs](https://github.com/zk-coins/docs) |

## License

MIT
