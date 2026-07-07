<p align="center">
  <img src="logo/png/zkcoins-icon-192.png" width="112" alt="zkCoins">
</p>

<h1 align="center">zkCoins — Brand Kit</h1>

<p align="center"><em>Private Bitcoin transactions via Shielded CSV.</em></p>

The single source of truth for how zkCoins looks. Precise, warm, cryptographically calm.
No hype, no moon. Verifiable claims, plainly stated.

> This kit is asset-only (logo, tokens, guidelines) — no build step, no JavaScript, in
> keeping with this repo. `zkcoins.com` itself stays a single static `index.html`.

---

## 1 · The mark

A **pixel-art Z** monogram on a 12×12 grid — a bold Z inside a capsule of top/bottom
staples and continuous side bars, with two open windows. It is **deliberately blocky**.

- Render **crisp-edged** (`shape-rendering: crispEdges`). Never anti-alias, smooth, or
  redraw it as a rounded vector.
- **Monochrome:** white on dark and warm grounds, near-black on light. The signature
  treatment is white on the espresso field (see the app icon).
- Scale only in **whole-pixel steps**; minimum **24px** (2px per cell).
- **Clearspace:** at least ½ the mark's width on every side.

**Orientation.** This kit uses the **Z-reading** variant. The current
[`zk-coins/app`](https://github.com/zk-coins/app) `src/app/icon.svg` and `Logo.tsx` read
as an "S"; those files should be updated to match (swap rows 5 and 6 of the map).

<p>
  <img src="logo/png/zkcoins-icon-128.png" width="96" alt="app icon">
  <img src="logo/png/zkcoins-symbol-white-96.png" width="72" alt="symbol">
</p>

**Do not:** stretch or change the aspect ratio · recolor · skew or distort · smooth /
anti-alias the pixels.

### Files

| Asset | SVG | PNG |
|---|---|---|
| Symbol (monochrome, `currentColor`) | [`zkcoins-symbol.svg`](logo/svg/zkcoins-symbol.svg) | `logo/png/zkcoins-symbol-{white,black}-{48,96,192,384}.png` |
| App icon (espresso tile) | [`zkcoins-icon.svg`](logo/svg/zkcoins-icon.svg) | `logo/png/zkcoins-icon-{16,32,64,128,192,256,512}.png` |
| Wordmark lockup | [`zkcoins-wordmark.svg`](logo/svg/zkcoins-wordmark.svg) | — (outline text to paths for raster) |

The site favicon (`/favicon.svg`) is the 12-cell version of the app icon.

---

## 2 · Color

`#0a0a0a` (ground) and `#f7931a` (Bitcoin orange, accent) are the brand constants — the
same style invariants this repo already enforces. The **espresso field** is the signature
surface behind the mark. Neutrals are warm-biased — never a dead grey.

**Accent — Bitcoin orange**

| 50 | 100 | 200 | 300 | **500** | 600 | 700 | 900 |
|---|---|---|---|---|---|---|---|
| `#fff4e6` | `#ffe4bf` | `#ffce8a` | `#ffb85c` | **`#f7931a`** | `#e07d0a` | `#b56207` | `#5c320a` |

**Neutrals (warm)** — ground `#0a0a0a` · surface `#1c1a18` · border `#2e2a26` ·
muted `#a8a29a` · body `#ece9e4` · strong `#ffffff`

**Signature surface — espresso**
`radial-gradient(120% 120% at 50% 26%, #a86a1f, #1a1005 82%)`

**Semantic** (status only, never as the accent) — success `#3fb950` · warning `#e3b341`
· danger `#f85149` · info `#58a6ff`

**Contrast (on `#0a0a0a`)** — accent 8.6:1 (AA) · white 19.8:1 (AAA) ·
black-on-accent 9.1:1 (AAA). White on orange (2.3:1) is fine for the mark and large
display; for small body text prefer black.

---

## 3 · Typography

Mono-forward — zkCoins speaks in hashes, addresses, and proofs.

- **IBM Plex Mono** — wordmark, labels, addresses, code, numeric data.
- **IBM Plex Sans** — headings, body, UI, long-form docs.

Both are SIL OFL 1.1. **Note:** `zkcoins.com` itself ships **no font CDN** and stays on
the system monospace stack per this repo's invariants — IBM Plex is the canonical face for
other surfaces (app, docs, decks), not a webfont for this page.

---

## 4 · Voice & messaging

Precise, calm, honest. Explain privacy in plain language for non-cryptographers; stay
technically exact for builders. Never overpromise, never say "moon," never claim more
privacy than the protocol delivers.

**The name — always exactly `zkCoins`** (lowercase `zk`, capital `C`, one word).
Not `ZKCoins` / `Zkcoins` / `zk coins` / `ZK Coins`. Lowercase `zkcoins` only in domains
and handles (`zkcoins.com`, `@zkcoins`).

**Tagline:** Private Bitcoin transactions via Shielded CSV.

| Don't | Do |
|---|---|
| The next-gen privacy revolution. Untraceable, guaranteed anonymity. | A shielded pool that hides amounts and links between payments. Privacy depends on the anonymity set. |
| zkCoins is a new coin / sidechain / bridge. | zkCoins is Bitcoin. Shielded CSV keeps funds in BTC — no new token, no bridge. |
| Bank-grade security, total peace of mind. | Every transaction carries a zero-knowledge proof anyone can verify. |

---

## 5 · Tokens

Design tokens are the machine-readable source of truth — wire them into `app` and `docs`
so the accent and mark live in one place.

- [`tokens/tokens.css`](tokens/tokens.css) — CSS custom properties (`--zk-*`)
- [`tokens/tokens.json`](tokens/tokens.json) — Style-Dictionary-style JSON

```css
--zk-accent:    #f7931a;   /* primary */
--zk-accent-fg: #000000;   /* default on-accent ink; white is also fine for the mark */
--zk-bg:        #0a0a0a;
--zk-espresso:  radial-gradient(120% 120% at 50% 26%, #a86a1f, #1a1005 82%);
--zk-font-mono: 'IBM Plex Mono', ui-monospace, monospace;
--zk-font-sans: 'IBM Plex Sans', system-ui, sans-serif;
```
