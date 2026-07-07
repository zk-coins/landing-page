# Contributing

Thanks for thinking about contributing to `zkcoins.com`.

This repo is a **single static page**: one `index.html`, inline CSS, no JavaScript, no build step. Keep it that way unless you have a very good reason.

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
python3 -m http.server 8080
open http://localhost:8080
```

Edit `index.html` directly. No npm, no build.

## Before you push

CI runs on every push and PR (see `.github/workflows/ci.yaml`):

- **HTML Validate** — HTML5 validator
- **Link Check** — lychee dead-link scanner
- **Workflow Lint** — actionlint on `.github/workflows/`
- **Workflow Security** — zizmor static analysis (SARIF uploaded to the Security tab)

If any check fails, fix the underlying problem rather than disabling the check.

## Style invariants

These follow the **zkCoins Brand Guide v1.0** and must not change without an explicit brand decision:

- Ground `#0a0a0a`, accent `#f7931a` (Bitcoin orange); headings and the mark `#ffffff`, body text `#ece9e4`; warm-biased neutrals (never a dead grey). The espresso field `radial-gradient(120% 120% at 50% 26%, #a86a1f, #1a1005)` is the signature surface.
- The mark is the canonical **pixel-art Z monogram** (12×12 grid, `shape-rendering:crispEdges`, monochrome via `currentColor`) — never the old orange "zk" tile, never recoloured, skewed, or anti-aliased.
- Display name **zkCoins** (always capital C); lowercase `zkcoins` only in domains and handles.
- Tagline: *Private Bitcoin transactions via Shielded CSV*
- Type: **IBM Plex Mono** (wordmark, labels, data, numbers) + **IBM Plex Sans** (headings, body), each with a system fallback stack — no Google Fonts, no remote font CDN.
- Accent buttons are **black text on orange** (white on orange is misuse).
- Headings never end with a full stop.
- No JavaScript **except inert structured data** (`<script type="application/ld+json">` for SEO/AEO). No analytics pixel, no remote font CDN, no third-party iframe.
- The Shielded CSV paper (ePrint 2025/068) stays a prominent element of the page.

## Adding a new section

Prefer extending `index.html` over adding a new file. A second page should only exist if it cannot reasonably live inline.

If a second page is added, it must:

- Reuse the same `:root` CSS variables and component classes
- Be linked from the navigation/footer of `index.html`
- Pass the same CI checks

## Reporting a security issue

Please report security issues privately via [GitHub Security Advisories](https://github.com/zk-coins/landing-page/security/advisories/new) rather than opening a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree your contribution is licensed under MIT (same as the repo).
