#!/usr/bin/env python3
"""Generate locale HTML pages and sitemap.xml from template + string JSONs.

Usage (from repo root):
    python3 scripts/i18n/generate.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

I18N_DIR = Path(__file__).resolve().parent
ROOT = I18N_DIR.parents[1]
ORIGIN = "https://zkcoins.com"

# Keep in sync with scripts/lib/i18n.mjs and the path lists in package.json
# (the "i18n:check" and "validate:html" scripts).
LANGS = [
    {
        "code": "en",
        "hreflang": "en",
        "ogLocale": "en_US",
        "name": "English",
        "nativeName": "English",
        "dir": "",
    },
    {
        "code": "de",
        "hreflang": "de",
        "ogLocale": "de_DE",
        "name": "German",
        "nativeName": "Deutsch",
        "dir": "de/",
    },
    {
        "code": "fr",
        "hreflang": "fr",
        "ogLocale": "fr_FR",
        "name": "French",
        "nativeName": "Français",
        "dir": "fr/",
    },
    {
        "code": "it",
        "hreflang": "it",
        "ogLocale": "it_IT",
        "name": "Italian",
        "nativeName": "Italiano",
        "dir": "it/",
    },
    {
        "code": "es",
        "hreflang": "es",
        "ogLocale": "es_ES",
        "name": "Spanish",
        "nativeName": "Español",
        "dir": "es/",
    },
]

# Derived from LANGS so the language matrix stays a single source of truth.
ALL_LANG_CODES = [lang["code"] for lang in LANGS]

PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")

# Keys placed into HTML attributes — escape &, ", <, >
ATTR_KEYS = frozenset(
    {
        "meta_title",
        "meta_description",
        "og_title",
        "og_description",
        "brand_aria",
        "nav_aria",
        "lang_switcher_aria",
        "statband_aria",
        "compare_aria",
        "investors_dd_aria",
        "footer_nostr_title",
        "perf_bitcoin_regular",
        "perf_zkcoins_v1",
    }
)


def path_for(code: str) -> str:
    if code == "en":
        return "/"
    return f"/{code}/"


def url_for(code: str) -> str:
    return f"{ORIGIN}{path_for(code)}"


def file_for(code: str) -> str:
    if code == "en":
        return "index.html"
    return f"{code}/index.html"


def html_attr(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def load_strings(code: str) -> dict[str, str]:
    path = I18N_DIR / "strings" / f"{code}.json"

    def reject_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
        seen: dict[str, object] = {}
        for key, value in pairs:
            if key in seen:
                raise SystemExit(f"{path}: duplicate key {key!r}")
            seen[key] = value
        return seen

    data = json.loads(
        path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates
    )
    if not isinstance(data, dict):
        raise SystemExit(f"{path}: root must be a JSON object")
    for key, value in data.items():
        if not isinstance(value, str):
            raise SystemExit(f"{path}: key {key!r} must be a string")
    return data


def build_hreflang_links() -> str:
    lines = []
    for lang in LANGS:
        lines.append(
            f'<link rel="alternate" hreflang="{lang["hreflang"]}" href="{url_for(lang["code"])}" />'
        )
    lines.append(
        f'<link rel="alternate" hreflang="x-default" href="{url_for("en")}" />'
    )
    return "\n".join(lines)


def build_og_locale_alternates(current_code: str) -> str:
    lines = []
    for lang in LANGS:
        if lang["code"] == current_code:
            continue
        lines.append(
            f'<meta property="og:locale:alternate" content="{lang["ogLocale"]}" />'
        )
    return "\n".join(lines)


def build_lang_switcher(current_code: str, aria_label: str) -> str:
    lines = [
        '<details class="lang">',
        f'  <summary aria-label="{html_attr(aria_label)}">{current_code.upper()}</summary>',
        '  <div class="lang__menu">',
    ]
    for lang in LANGS:
        code = lang["code"]
        href = path_for(code)
        current = ' aria-current="page"' if code == current_code else ""
        lines.append(
            f'    <a href="{href}" lang="{code}" hreflang="{code}"{current}>'
            f'{lang["nativeName"]} <span>{code.upper()}</span></a>'
        )
    lines.append("  </div>")
    lines.append("</details>")
    return "\n      ".join(lines)


def faq_answer_for_json(strings: dict[str, str], n: int) -> str:
    # Answers with an inline link carry a link-free "faq_a{n}_json" variant for
    # the FAQPage structured data; plain answers reuse the visible string.
    return strings.get(f"faq_a{n}_json", strings[f"faq_a{n}"])


def build_json_ld(code: str, strings: dict[str, str], locale_url: str) -> str:
    graph = [
        {
            "@type": "Organization",
            "@id": f"{ORIGIN}/#organization",
            "name": "zkCoins",
            "url": f"{ORIGIN}/",
            "logo": f"{ORIGIN}/favicon.png",
            "description": strings["jsonld_org_description"],
            "sameAs": [
                "https://x.com/zkcoinsbtc",
                "https://t.me/zkcoinsbtc",
                "https://github.com/zk-coins",
                "https://njump.me/npub126ap5uuyez2puq363jp8ntveyhy35p4xts2xgu8k70s727spzeash2e85m",
            ],
            "contactPoint": [
                {
                    "@type": "ContactPoint",
                    "contactType": "investor relations",
                    "email": "investors@zkcoins.com",
                    "url": f"{locale_url}#investors",
                    "availableLanguage": list(ALL_LANG_CODES),
                }
            ],
        },
        {
            "@type": "WebSite",
            "@id": f"{ORIGIN}/#website",
            "url": f"{ORIGIN}/",
            "name": "zkCoins",
            "description": strings["jsonld_website_description"],
            "inLanguage": list(ALL_LANG_CODES),
            "publisher": {"@id": f"{ORIGIN}/#organization"},
        },
        {
            "@type": "SoftwareApplication",
            "@id": f"{ORIGIN}/#wallet",
            "name": "zkCoins Wallet",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web, iOS, Android (PWA)",
            "url": "https://zkcoins.app",
            "description": strings["jsonld_wallet_description"],
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "isBasedOn": {"@id": f"{ORIGIN}/#paper"},
            "publisher": {"@id": f"{ORIGIN}/#organization"},
        },
        {
            "@type": "ScholarlyArticle",
            "@id": f"{ORIGIN}/#paper",
            "name": "Shielded CSV: Private and Efficient Client-Side Validation",
            "url": "https://eprint.iacr.org/2025/068",
            "identifier": "IACR ePrint 2025/068",
            "datePublished": "2025-01",
            "author": [
                {"@type": "Person", "name": "Jonas Nick"},
                {"@type": "Person", "name": "Liam Eagen"},
                {"@type": "Person", "name": "Robin Linus"},
            ],
        },
        {
            "@type": "FAQPage",
            "@id": f"{locale_url}#faq",
            "inLanguage": code,
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": strings[f"faq_q{n}"],
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": faq_answer_for_json(strings, n),
                    },
                }
                for n in range(1, 9)
            ],
        },
    ]
    payload = {"@context": "https://schema.org", "@graph": graph}
    return json.dumps(payload, ensure_ascii=False, indent=2)


def render(template: str, mapping: dict[str, str]) -> str:
    missing: list[str] = []

    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in mapping:
            missing.append(key)
            return match.group(0)
        return mapping[key]

    out = PLACEHOLDER_RE.sub(repl, template)
    if missing:
        uniq = sorted(set(missing))
        raise SystemExit(f"missing placeholders: {', '.join(uniq)}")
    leftover = PLACEHOLDER_RE.findall(out)
    if leftover:
        raise SystemExit(f"unresolved placeholders: {', '.join(sorted(set(leftover)))}")
    # Catch malformed placeholders the well-formed regex above cannot match,
    # e.g. "{{ nav_paper }}", "{{nav-paper}}" or a stray "{{"/"}}". The strings
    # contain no braces, so any remaining brace pair is a template defect.
    brace = out.find("{{")
    if brace == -1:
        brace = out.find("}}")
    if brace != -1:
        near = out[max(0, brace - 24) : brace + 40]
        raise SystemExit(f"malformed placeholder braces in output near: {near!r}")
    return out


def build_sitemap() -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]
    for lang in LANGS:
        loc = url_for(lang["code"])
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        for alt in LANGS:
            lines.append(
                f'    <xhtml:link rel="alternate" hreflang="{alt["hreflang"]}" '
                f'href="{url_for(alt["code"])}"/>'
            )
        lines.append(
            f'    <xhtml:link rel="alternate" hreflang="x-default" href="{url_for("en")}"/>'
        )
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    template_path = I18N_DIR / "page.template"
    if not template_path.is_file():
        print(f"error: missing {template_path}", file=sys.stderr)
        return 1

    template = template_path.read_text(encoding="utf-8")
    en = load_strings("en")
    en_keys = set(en.keys())

    required = {
        "meta_title",
        "meta_description",
        "og_title",
        "og_description",
        "skip_to_content",
        "brand_aria",
        "nav_aria",
        "nav_paper",
        "nav_how",
        "nav_roadmap",
        "nav_docs",
        "nav_open_wallet",
        "lang_switcher_aria",
        "faq_q1",
        "faq_a1",
        "faq_q7",
        "faq_a7",
        "faq_a7_json",
        "faq_q8",
        "faq_a8",
        "jsonld_org_description",
        "jsonld_website_description",
        "jsonld_wallet_description",
    }
    missing_en = sorted(required - en_keys)
    if missing_en:
        print(f"error: en.json missing keys: {', '.join(missing_en)}", file=sys.stderr)
        return 1

    written: list[str] = []
    for lang in LANGS:
        code = lang["code"]
        strings = load_strings(code)
        keys = set(strings.keys())
        if keys != en_keys:
            only_en = sorted(en_keys - keys)
            only_loc = sorted(keys - en_keys)
            msg = [f"error: {code}.json key set differs from en.json"]
            if only_en:
                msg.append(f"  missing: {', '.join(only_en)}")
            if only_loc:
                msg.append(f"  extra: {', '.join(only_loc)}")
            print("\n".join(msg), file=sys.stderr)
            return 1

        locale_url = url_for(code)
        mapping: dict[str, str] = dict(strings)

        for key in ATTR_KEYS:
            if key in mapping:
                mapping[key] = html_attr(mapping[key])

        mapping["html_lang"] = code
        mapping["canonical_url"] = locale_url
        mapping["og_locale"] = lang["ogLocale"]
        mapping["locale_home"] = path_for(code)
        mapping["hreflang_links"] = build_hreflang_links()
        mapping["og_locale_alternates"] = build_og_locale_alternates(code)
        mapping["lang_switcher"] = build_lang_switcher(
            code, strings["lang_switcher_aria"]
        )
        mapping["json_ld"] = build_json_ld(code, strings, locale_url)

        html = render(template, mapping)
        out_rel = file_for(code)
        out_path = ROOT / out_rel
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(html, encoding="utf-8")
        written.append(out_rel)
        print(f"wrote {out_rel}")

    sitemap = build_sitemap()
    sitemap_path = ROOT / "sitemap.xml"
    sitemap_path.write_text(sitemap, encoding="utf-8")
    written.append("sitemap.xml")
    print("wrote sitemap.xml")
    print(f"done — {len(written)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
