# Security Policy

## Reporting a vulnerability

If you find a security issue in this repository or on the deployed site at `zkcoins.com`, please report it **privately** via [GitHub Security Advisories](https://github.com/zk-coins/landing-page/security/advisories/new).

Do **not** open a public issue, pull request, or discussion for security topics.

## Scope

In scope:

- The contents of this repository
- The production site `https://zkcoins.com` and its preview deployment `https://dev.zkcoins.com`
- The `auto-release-pr.yaml` workflow and any workflow that has write permissions

Out of scope:

- The linked external sites (`zkcoins.app`, `zkcoins.info`, `zkcoins.exchange`, `zkcoins.space`, `docs.zkcoins.app`) — report those to their respective repos
- The Shielded CSV protocol itself — report to the upstream authors
- General Bitcoin protocol concerns

## Response expectations

We do not run a bug bounty for this static site. We will:

1. Acknowledge a credible report within a few working days.
2. Investigate and remediate confirmed issues.
3. Credit reporters in the advisory once the fix is public, unless anonymity is requested.

## Hardening already in place

- No JavaScript, no third-party scripts, no remote font/CDN load
- HTML5 validator + link check on every push (CI)
- `zizmor` static analysis on all GitHub Actions workflows (CI)
- Dependabot enabled for GitHub Actions versions
- `main` branch protected; production deploys only from `main`
