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
FAQ_A_JSON_RE = re.compile(r"^faq_a(\d+)_json$")
# Character references (named or numeric); semicolon optional for legacy forms.
CHAR_REF_RE = re.compile(r"&(?:#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[a-zA-Z][a-zA-Z0-9]*;?)")


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
    }
)

# FAQ question/answer indices that feed the FAQPage JSON-LD graph.
FAQ_NS = range(1, 9)


def is_unsafe_sink_key(key: str) -> bool:
    """True if this string key is injected into an attribute or JSON-LD."""
    if key in ATTR_KEYS or key.startswith("jsonld_"):
        return True
    if key in {f"faq_q{n}" for n in FAQ_NS} or key in {f"faq_a{n}" for n in FAQ_NS}:
        return True
    return FAQ_A_JSON_RE.fullmatch(key) is not None


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
    accessible_label = f"{aria_label} ({current_code.upper()})"
    lines = [
        '<details class="lang">',
        f'  <summary aria-label="{html_attr(accessible_label)}">{current_code.upper()}</summary>',
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


def faq_answer_for_json(code: str, strings: dict[str, str], n: int) -> str:
    # A visible answer containing any HTML markup MUST have a markup-free
    # "faq_a{n}_json" variant for the FAQPage structured data (a missing variant
    # in that case is a hard error). When a "_json" variant is present it always
    # takes precedence over the visible answer, whether or not the visible
    # answer contains markup.
    visible_key = f"faq_a{n}"
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
    locale_url: str,
    get_string: Callable[[str], str],
    get_faq_answer: Callable[[int], str],
) -> str:
    graph = [
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
            "@type": "FAQPage",
            "@id": f"{locale_url}#faq",
            "inLanguage": code,
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": get_string(f"faq_q{n}"),
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": get_faq_answer(n),
                    },
                }
                for n in FAQ_NS
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

        # FAQ keys are injected raw into the HTML body via page.template, but
        # are also guarded against character references because they feed the
        # JSON-LD payload. Authors write a literal "&"; this pass escapes it
        # only for the body-copy mapping. JSON-LD reads from strings (untouched)
        # and keeps the plain character — JSON needs no HTML escaping.
        for n in FAQ_NS:
            for key in (f"faq_q{n}", f"faq_a{n}"):
                if key in mapping:
                    mapping[key] = mapping[key].replace("&", "&amp;")

        mapping["html_lang"] = code
        mapping["canonical_url"] = locale_url
        mapping["og_locale"] = lang["ogLocale"]
        mapping["locale_home"] = path_for(code)
        mapping["hreflang_links"] = build_hreflang_links()
        mapping["og_locale_alternates"] = build_og_locale_alternates(code)
        mapping["lang_switcher"] = build_lang_switcher(
            code, strings["lang_switcher_aria"]
        )

        def get_string(key: str) -> str:
            return jsonld_string(strings, code, key)

        def get_faq_answer(n: int) -> str:
            return faq_answer_for_json(code, strings, n)

        mapping["json_ld"] = build_json_ld(code, locale_url, get_string, get_faq_answer)

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
