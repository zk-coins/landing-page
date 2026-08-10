#!/usr/bin/env python3
"""Generate locale HTML pages and sitemap.xml from template + string JSONs.

Usage (from repo root):
    python3 scripts/i18n/generate.py
"""
from __future__ import annotations

import json
import re
import sys
from html.entities import html5
from pathlib import Path
from typing import Callable

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
# Optional markup-free FAQ answer variant used only in FAQPage JSON-LD.
FAQ_A_JSON_RE = re.compile(r"^(?:zkbtc_)?faq_a(\d+)_json$")
# Character references (named or numeric); semicolon optional for legacy forms.
CHAR_REF_RE = re.compile(r"&(?:#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[a-zA-Z][a-zA-Z0-9]*;?)")

# dateModified for the home WebPage node (no dedicated string key).
HOME_DATE_MODIFIED = "2026-08-10"


def resolvable_refs(value: str) -> list[str]:
    """Flag tokens that look like deliberate author character references.

    Matching rule: every ``&`` followed by a run of alphanumerics (optional
    trailing ``;``) is considered. Numeric forms (``&#…`` / ``&#x…``) are
    always flagged, with or without the trailing semicolon. A named form is
    flagged only when the matched token itself — the full alphanumeric run
    after ``&``, with or without the semicolon, exactly as matched by the
    regex — is a key in ``html.entities.html5``.

    Tokens whose matched run is outside that table are deliberately not
    flagged, e.g. ``"R&D;"``, ``"&bogus;"``, ``"AT&T"``,
    ``"?tab=1&notes=2"``. A real HTML parser may still partially resolve
    some of these in body text (longest-match against table names, not
    against the whole alphanumeric run) — e.g. ``?tab=1&notes=2`` becomes
    ``?tab=1¬es=2`` because ``not`` is a table name. They are nonetheless
    safe in every guarded key because the two HTML sinks escape the
    ampersand: ``html_attr()`` for ``ATTR_KEYS`` and the ``&`` → ``&amp;``
    pass in ``main()`` for FAQ body copy. The JSON-LD sink needs no
    escaping at all: ``json.dumps`` emits the ampersand verbatim, but
    ``<script type="application/ld+json">`` is an HTML raw-text element,
    so a literal ``&`` is never parsed as a character reference there
    (the same non-escaping is why ``check_jsonld_value()`` must reject
    ``<`` by hand).

    Purpose: catch a character reference the author wrote expecting a
    parser to resolve it (e.g. ``&nbsp;``, ``&copy``) landing in a sink
    that will not parse it — an authoring-intent check, distinct from the
    sink-escaping that provides the actual safety guarantee.
    """
    found: list[str] = []
    for m in CHAR_REF_RE.finditer(value):
        text = m.group()
        name = text[1:]  # strip the leading "&"
        if name.startswith("#") or name in html5:
            found.append(text)
    return found


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
        "zkbtc_meta_title",
        "zkbtc_meta_description",
        "zkbtc_og_title",
        "zkbtc_og_description",
        "zkbtc_stats_aria",
        "zkbtc_bc_aria",
        "zkbtc_roles_caption",
        "og_image_alt",
    }
)

# Sitemap lastmod per page — hand-maintained, never datetime.now().
# An auto-generated date would change every run and break i18n:check idempotency.
SITEMAP_LASTMOD = {
    "": "2026-08-10",  # home
    "zkbtc": "2026-08-10",
}

# Shared chrome keys every page needs (nav, footer, JSON-LD core).
_CHROME_REQUIRED = {
    "skip_to_content",
    "brand_aria",
    "nav_aria",
    "nav_paper",
    "nav_how",
    "nav_zkbtc",
    "nav_roadmap",
    "nav_docs",
    "nav_open_wallet",
    "lang_switcher_aria",
    "footer_tag",
    "footer_protocol",
    "footer_whitepaper",
    "footer_how",
    "footer_roadmap",
    "footer_zkbtc",
    "footer_build",
    "footer_wallet",
    "footer_documentation",
    "footer_github",
    "footer_brand_kit",
    "footer_community",
    "footer_x",
    "footer_telegram",
    "footer_nostr",
    "footer_nostr_title",
    "footer_investors_col",
    "footer_investor_relations",
    "footer_source_code",
    "footer_legal_copy",
    "footer_legal_disclaimer",
    "jsonld_org_description",
    "jsonld_website_description",
    "jsonld_wallet_description",
}

HOME_REQUIRED = _CHROME_REQUIRED | {
    "meta_title",
    "meta_description",
    "og_title",
    "og_description",
    "faq_q1",
    "faq_a1",
    "faq_q7",
    "faq_a7",
    "faq_q8",
    "faq_a8",
    "faq_q9",
    "faq_a9",
}

ZKBTC_REQUIRED = _CHROME_REQUIRED | {
    "zkbtc_meta_title",
    "zkbtc_meta_description",
    "zkbtc_og_title",
    "zkbtc_og_description",
    "zkbtc_h1_line1",
    "zkbtc_h1_accent",
    "zkbtc_bc_home",
    "zkbtc_bc_current",
    "zkbtc_bc_aria",
    "zkbtc_faq_q1",
    "zkbtc_faq_a1",
    "zkbtc_faq_q2",
    "zkbtc_faq_a2",
    "zkbtc_faq_q3",
    "zkbtc_faq_a3",
    "zkbtc_faq_q4",
    "zkbtc_faq_a4",
    "zkbtc_faq_q5",
    "zkbtc_faq_a5",
    "zkbtc_faq_q6",
    "zkbtc_faq_a6",
    "jsonld_zkbtc_headline",
    "jsonld_zkbtc_description",
    "jsonld_zkbtc_term_name",
    "jsonld_zkbtc_term_description",
    "jsonld_zkbtc_published",
    "jsonld_zkbtc_modified",
}

# Site pages. "slug" is the path segment under the language root ("" = home),
# "template" the file, "required" keys that must exist before build,
# "faq_prefix"/"faq_count" the FAQPage namespace for that page.
# Keep in sync with SITE_PAGES in scripts/lib/pages.mjs.
PAGES = [
    {
        "slug": "",
        "template": "page.template",
        "required": HOME_REQUIRED,
        "faq_prefix": "faq_",
        "faq_count": 9,
        "og_type": "website",
    },
    {
        "slug": "zkbtc",
        "template": "zkbtc.template",
        "required": ZKBTC_REQUIRED,
        "faq_prefix": "zkbtc_faq_",
        "faq_count": 6,
        "og_type": "article",
    },
]


# Visible breadcrumb labels also feed BreadcrumbList JSON-LD.
BREADCRUMB_JSONLD_KEYS = frozenset({"zkbtc_bc_home", "zkbtc_bc_current"})


def is_unsafe_sink_key(key: str) -> bool:
    """True if this string key is injected into an attribute or JSON-LD."""
    if key in ATTR_KEYS or key in BREADCRUMB_JSONLD_KEYS or key.startswith("jsonld_"):
        return True
    for page in PAGES:
        prefix = page["faq_prefix"]
        for n in range(1, page["faq_count"] + 1):
            if key in (f"{prefix}q{n}", f"{prefix}a{n}", f"{prefix}a{n}_json"):
                return True
    return FAQ_A_JSON_RE.fullmatch(key) is not None


def path_for(code: str, slug: str = "") -> str:
    if code == "en":
        return f"/{slug}/" if slug else "/"
    return f"/{code}/{slug}/" if slug else f"/{code}/"


def url_for(code: str, slug: str = "") -> str:
    return f"{ORIGIN}{path_for(code, slug)}"


def file_for(code: str, slug: str = "") -> str:
    if code == "en":
        return f"{slug}/index.html" if slug else "index.html"
    return f"{code}/{slug}/index.html" if slug else f"{code}/index.html"


def strings_path_for(code: str) -> Path:
    return I18N_DIR / "strings" / f"{code}.json"


def html_attr(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def load_strings(code: str) -> dict[str, str]:
    path = strings_path_for(code)

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
    # Author-intent refs (table-key / numeric; see resolvable_refs docstring) are
    # fine in body-only keys but wrong in attributes and JSON-LD. Untable tokens
    # like "R&D;", "&bogus;", "?tab=1&notes=2" are not flagged; they are safe in
    # guarded keys because the sink escapes & regardless.
    char_ref_hits: list[tuple[str, list[str]]] = sorted(
        (key, refs)
        for key, value in data.items()
        if is_unsafe_sink_key(key) and (refs := resolvable_refs(value))
    )
    if char_ref_hits:
        details = "; ".join(
            f"{key}: {', '.join(repr(r) for r in refs)}" for key, refs in char_ref_hits
        )
        raise SystemExit(
            f"{path}: HTML character references are not allowed in attribute or "
            f"JSON-LD keys: {details}. Type the literal character "
            "instead (a no-break space is U+00A0)."
        )
    return data


def build_hreflang_links(slug: str = "") -> str:
    lines = []
    for lang in LANGS:
        lines.append(
            f'<link rel="alternate" hreflang="{lang["hreflang"]}" '
            f'href="{url_for(lang["code"], slug)}" />'
        )
    lines.append(
        f'<link rel="alternate" hreflang="x-default" href="{url_for("en", slug)}" />'
    )
    return "\n".join(lines)


def build_og_locale_alternates(current_code: str) -> str:
    # Locale tags only — independent of page slug.
    lines = []
    for lang in LANGS:
        if lang["code"] == current_code:
            continue
        lines.append(
            f'<meta property="og:locale:alternate" content="{lang["ogLocale"]}" />'
        )
    return "\n".join(lines)


def build_lang_switcher(current_code: str, aria_label: str, slug: str = "") -> str:
    accessible_label = f"{aria_label} ({current_code.upper()})"
    lines = [
        '<details class="lang">',
        f'  <summary aria-label="{html_attr(accessible_label)}">{current_code.upper()}</summary>',
        '  <div class="lang__menu">',
    ]
    for lang in LANGS:
        code = lang["code"]
        href = path_for(code, slug)
        current = ' aria-current="page"' if code == current_code else ""
        lines.append(
            f'    <a href="{href}" lang="{code}" hreflang="{code}"{current}>'
            f'{lang["nativeName"]} <span>{code.upper()}</span></a>'
        )
    lines.append("  </div>")
    lines.append("</details>")
    return "\n      ".join(lines)


def check_jsonld_value(code: str, key: str, value: str) -> str:
    """Reject a value unfit for the JSON-LD payload.

    ld+json is an HTML raw-text element, terminated by the literal byte sequence
    "</script", and json.dumps does not escape "<". Every string reaching that
    payload must be non-empty and markup-free.
    """
    if not value.strip():
        raise SystemExit(
            f"{strings_path_for(code)}: key {key!r} is empty (or whitespace-only) "
            "but is used in the JSON-LD payload; JSON-LD strings must be "
            "non-empty."
        )
    if "<" in value:
        raise SystemExit(
            f"{strings_path_for(code)}: key {key!r} contains '<' but is used in "
            "the JSON-LD payload; JSON-LD strings must be markup-free because "
            '<script type="application/ld+json"> is an HTML raw-text element '
            "(a literal '</script' sequence would terminate it early, and "
            "json.dumps does not escape '<')."
        )
    return value


def faq_answer_for_json(
    code: str, strings: dict[str, str], n: int, prefix: str = "faq_"
) -> str:
    # A visible answer containing any HTML markup MUST have a markup-free
    # "{prefix}a{n}_json" variant for the FAQPage structured data (a missing
    # variant in that case is a hard error). When a "_json" variant is present
    # it always takes precedence over the visible answer, whether or not the
    # visible answer contains markup.
    visible_key = f"{prefix}a{n}"
    visible_answer = strings[visible_key]
    json_key = f"{visible_key}_json"
    if json_key in strings:
        return check_jsonld_value(code, json_key, strings[json_key])
    if "<" in visible_answer:
        path = strings_path_for(code)
        raise SystemExit(
            f"{path}: missing required key {json_key!r}: "
            f"{visible_key!r} contains HTML markup, so a markup-free JSON-LD "
            "answer is required."
        )
    return check_jsonld_value(code, visible_key, visible_answer)


def jsonld_string(strings: dict[str, str], code: str, key: str) -> str:
    """Fetch a locale string for the JSON-LD payload, refusing unguarded keys."""
    if not is_unsafe_sink_key(key):
        raise SystemExit(
            f"{strings_path_for(code)}: key {key!r} is used in the JSON-LD payload "
            "but is not covered by the character-reference guard. Name JSON-LD "
            "strings 'jsonld_*' (see is_unsafe_sink_key)."
        )
    return check_jsonld_value(code, key, strings[key])


def build_json_ld(
    code: str,
    page_url: str,
    home_url: str,
    slug: str,
    faq_prefix: str,
    faq_count: int,
    get_string: Callable[[str], str],
    get_faq_answer: Callable[[int], str],
) -> str:
    if slug == "zkbtc":
        page_name = get_string("zkbtc_meta_title")
        page_desc = get_string("zkbtc_meta_description")
        page_modified = get_string("jsonld_zkbtc_modified")
    else:
        page_name = get_string("meta_title")
        page_desc = get_string("meta_description")
        page_modified = HOME_DATE_MODIFIED

    graph: list[dict] = [
        {
            "@type": "Organization",
            "@id": f"{ORIGIN}/#organization",
            "name": "zkCoins",
            "url": f"{ORIGIN}/",
            "logo": f"{ORIGIN}/favicon.png",
            "description": get_string("jsonld_org_description"),
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
                    "url": f"{home_url}#investors",
                    "availableLanguage": list(ALL_LANG_CODES),
                }
            ],
        },
        {
            "@type": "WebSite",
            "@id": f"{ORIGIN}/#website",
            "url": f"{ORIGIN}/",
            "name": "zkCoins",
            "description": get_string("jsonld_website_description"),
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
            "description": get_string("jsonld_wallet_description"),
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
            "@type": "WebPage",
            "@id": f"{page_url}#webpage",
            "url": page_url,
            "name": page_name,
            "description": page_desc,
            "inLanguage": code,
            "dateModified": page_modified,
            "isPartOf": {"@id": f"{ORIGIN}/#website"},
        },
    ]

    if slug == "zkbtc":
        graph.append(
            {
                "@type": "TechArticle",
                "@id": f"{page_url}#article",
                "headline": get_string("jsonld_zkbtc_headline"),
                "description": get_string("jsonld_zkbtc_description"),
                "mainEntityOfPage": {"@id": f"{page_url}#webpage"},
                "isBasedOn": {"@id": f"{ORIGIN}/#paper"},
                "author": {"@id": f"{ORIGIN}/#organization"},
                "publisher": {"@id": f"{ORIGIN}/#organization"},
                "datePublished": get_string("jsonld_zkbtc_published"),
                "dateModified": get_string("jsonld_zkbtc_modified"),
                "about": {"@id": f"{ORIGIN}/#zkbtc"},
                "inLanguage": code,
                "license": "https://opensource.org/licenses/MIT",
            }
        )
        graph.append(
            {
                "@type": "DefinedTerm",
                "@id": f"{ORIGIN}/#zkbtc",
                "name": get_string("jsonld_zkbtc_term_name"),
                "description": get_string("jsonld_zkbtc_term_description"),
            }
        )
        graph.append(
            {
                "@type": "BreadcrumbList",
                "@id": f"{page_url}#breadcrumb",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": get_string("zkbtc_bc_home"),
                        "item": home_url,
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": get_string("zkbtc_bc_current"),
                    },
                ],
            }
        )

    graph.append(
        {
            "@type": "FAQPage",
            "@id": f"{page_url}#faq",
            "inLanguage": code,
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": get_string(f"{faq_prefix}q{n}"),
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": get_faq_answer(n),
                    },
                }
                for n in range(1, faq_count + 1)
            ],
        }
    )

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
    # Page-major order: all langs of page 1, then all langs of page 2, …
    for page in PAGES:
        slug = page["slug"]
        lastmod = SITEMAP_LASTMOD[slug]
        for lang in LANGS:
            loc = url_for(lang["code"], slug)
            lines.append("  <url>")
            lines.append(f"    <loc>{loc}</loc>")
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
            for alt in LANGS:
                lines.append(
                    f'    <xhtml:link rel="alternate" hreflang="{alt["hreflang"]}" '
                    f'href="{url_for(alt["code"], slug)}"/>'
                )
            lines.append(
                f'    <xhtml:link rel="alternate" hreflang="x-default" '
                f'href="{url_for("en", slug)}"/>'
            )
            lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    # Pre-flight: every template must exist before any file is written.
    templates: dict[str, str] = {}
    for page in PAGES:
        template_path = I18N_DIR / page["template"]
        if not template_path.is_file():
            print(f"error: missing {template_path}", file=sys.stderr)
            return 1
        templates[page["template"]] = template_path.read_text(encoding="utf-8")

    en = load_strings("en")
    en_keys = set(en.keys())

    for page in PAGES:
        missing_en = sorted(page["required"] - en_keys)
        if missing_en:
            print(
                f"error: en.json missing keys for page "
                f"{page['slug'] or 'home'!r}: {', '.join(missing_en)}",
                file=sys.stderr,
            )
            return 1

    written: list[str] = []
    for page in PAGES:
        slug = page["slug"]
        template = templates[page["template"]]
        faq_prefix = page["faq_prefix"]
        faq_count = page["faq_count"]

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

            page_url = url_for(code, slug)
            home_url = url_for(code, "")
            mapping: dict[str, str] = dict(strings)

            for key in ATTR_KEYS:
                if key in mapping:
                    mapping[key] = html_attr(mapping[key])

            # FAQ keys are injected raw into the HTML body via the template, but
            # are also guarded against character references because they feed the
            # JSON-LD payload. Authors write a literal "&"; this pass escapes it
            # only for the body-copy mapping. JSON-LD reads from strings (untouched)
            # and keeps the plain character — JSON needs no HTML escaping.
            for n in range(1, faq_count + 1):
                for key in (f"{faq_prefix}q{n}", f"{faq_prefix}a{n}"):
                    if key in mapping:
                        mapping[key] = mapping[key].replace("&", "&amp;")

            mapping["html_lang"] = code
            mapping["canonical_url"] = page_url
            mapping["og_locale"] = lang["ogLocale"]
            mapping["og_type"] = page["og_type"]
            mapping["locale_home"] = path_for(code, "")
            mapping["locale_zkbtc"] = path_for(code, "zkbtc")
            mapping["hreflang_links"] = build_hreflang_links(slug)
            mapping["og_locale_alternates"] = build_og_locale_alternates(code)
            mapping["lang_switcher"] = build_lang_switcher(
                code, strings["lang_switcher_aria"], slug
            )

            def get_string(key: str, _code: str = code, _strings: dict = strings) -> str:
                return jsonld_string(_strings, _code, key)

            def get_faq_answer(
                n: int,
                _code: str = code,
                _strings: dict = strings,
                _prefix: str = faq_prefix,
            ) -> str:
                return faq_answer_for_json(_code, _strings, n, _prefix)

            mapping["json_ld"] = build_json_ld(
                code,
                page_url,
                home_url,
                slug,
                faq_prefix,
                faq_count,
                get_string,
                get_faq_answer,
            )

            # Meta/OG: zkbtc page uses zkbtc_* keys in the template directly.
            # Home uses meta_* / og_*.

            html = render(template, mapping)
            out_rel = file_for(code, slug)
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
