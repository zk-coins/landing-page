# zkCoins — Landing Page (zkcoins.com)

[![CI](https://github.com/zk-coins/landing-page/actions/workflows/ci.yaml/badge.svg?branch=develop)](https://github.com/zk-coins/landing-page/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Static landing page for [zkcoins.com](https://zkcoins.com). Whitepaper-centric entry point for the Shielded CSV protocol that zkCoins is built on.

## Stack

- Plain HTML + inline CSS — the **deployed page** has no build step and no runtime dependencies
- No runtime JavaScript (only inert `application/ld+json` structured data)
- System font stack (no external font load)
- Dev-only test tooling (Playwright + Vitest) — never shipped, kept off the CDN by `.assetsignore`

## Structure

```
.
├── index.html            — Single-page whitepaper landing (HTML + inline CSS)
├── favicon.svg / .png    — zkCoins mark
├── robots.txt            — crawler policy (AI answer engines welcome)
├── sitemap.xml           — single-URL sitemap
├── llms.txt              — LLM-oriented site summary
├── .well-known/nostr.json — NIP-05 identity
├── brand/                — brand kit (logos, tokens)
├── scripts/              — dev server + check/test tooling (scripts/lib/** is unit-tested)
├── tests/                — Playwright specs + committed screenshot baselines
├── test/                 — Vitest unit tests
└── LICENSE               — MIT
```

## Local preview

```bash
python3 -m http.server 8080        # or: npm run serve   (http://127.0.0.1:4173)
# open http://localhost:8080
```

## Testing

```bash
npm ci
npm run check              # prettier + html-validate + site completeness + 100% unit coverage
npm run e2e:docker         # Playwright screenshots vs. the committed baselines (pinned container)
```

Screenshot baselines are regenerated with `npm run e2e:docker:update`. See
[CONTRIBUTING.md](CONTRIBUTING.md#testing) for the full rig (what each gate covers,
how the baselines stay reproducible, and the 100% coverage rule).

## Deploy — Cloudflare Pages

Production: [zkcoins.com](https://zkcoins.com) · Preview: [dev.zkcoins.com](https://dev.zkcoins.com)

Cloudflare Pages auto-deploys on push to `develop`.

### Setup (one-time)

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** → `zk-coins/landing-page`
2. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
   - **Production branch:** `develop`
3. Custom domain: `zkcoins.com` (PRD) and `dev.zkcoins.com` (preview)

### Alternative — Wrangler CLI

```bash
npx wrangler pages deploy . --project-name=zkcoins-com --branch=production
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching model, local development, CI checks, and style invariants.

Security issues: see [SECURITY.md](SECURITY.md).

## Brand

Follows the zkCoins brand kit. Key invariants:

- Background `#0a0a0a`, accent `#f7931a` (Bitcoin orange), foreground `#ffffff`
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
