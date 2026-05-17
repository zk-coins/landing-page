# zkcoins.com — Landing Page

[![CI](https://github.com/zk-coins/landing-page/actions/workflows/ci.yaml/badge.svg?branch=develop)](https://github.com/zk-coins/landing-page/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Static landing page for [zkcoins.com](https://zkcoins.com). Whitepaper-centric entry point for the Shielded CSV protocol that zkCoins is built on.

## Stack

- Plain HTML + inline CSS
- No JavaScript, no build step, no dependencies
- System monospace font stack (no external font load)

## Structure

```
.
├── index.html       — Single-page whitepaper landing
├── favicon.png      — 192×192 zkCoins avatar
└── LICENSE          — MIT
```

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

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
