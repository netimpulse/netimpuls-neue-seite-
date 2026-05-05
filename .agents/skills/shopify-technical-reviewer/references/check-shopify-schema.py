#!/usr/bin/env python3
"""check-shopify-schema.py — pre-deploy validator for Shopify themes.

Run after writing/editing any section/snippet/template/CSS file and BEFORE
pushing to Shopify. Failing checks here mean a real Shopify deploy will
fail too. Faster than waiting for the Theme Editor to throw FileSaveError
or for the Customizer to silently drop sections from "Add section".

USAGE
    python3 check-shopify-schema.py /path/to/theme [--only path1,path2,...]

WHAT IT CHECKS
1. Liquid structural sanity (balanced tags, no \\! corruption from bash
   heredoc, no filter-chains in image_tag named args).
2. Schema JSON validity (parses, name <= 25, IDs ^[a-z][a-z0-9_]*$,
   no duplicates, no enabled_on+disabled_on together).
3. Schema default validity:
   - select.default is in options[].value
   - range.default in [min, max] AND on step grid
   - font_picker.default matches Shopify ^[a-z0-9_]+_[ni][1-9]$
     (catches the playfair_display_n4i FileSaveError class of bugs)
   - checkbox.default is bool
   - color.default is 6-digit hex
   - image_picker.default must be empty/null
4. Template JSON files:
   - JSON parses
   - Every "type" references an existing sections/<type>.liquid
   - color_scheme template-default trap (warning)
   - UNKNOWN settings in template that schema does not define (error)
   - UNKNOWN block types and unknown block settings (error)
5. CSS brace balance (single missing `}` voids the entire stylesheet).
6. Locale sanity: every {{ 'key' | t }} resolves in en.default.json.

Returns non-zero if any error found (warnings don't fail).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
FONT_HANDLE_RE = re.compile(r"^[a-z][a-z0-9_]*_[ni][1-9]$")
T_FILTER_RE = re.compile(r"\{\{\s*['\"]([a-z0-9_.]+)['\"]\s*\|\s*t\s*\}\}")
NAMED_ARG_FILTER_CHAIN_RE = re.compile(
    r"image_tag:[^}{]*\|\s*(default|escape|upcase|downcase|capitalize):"
)
PAIRED_TAGS = [
    "if", "unless", "for", "case", "capture", "form", "comment",
    "paginate", "tablerow", "schema", "style", "javascript",
    "stylesheet", "raw",
]


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, where: str, msg: str) -> None:
        self.errors.append(f"[{where}] {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"[{where}] {msg}")

    def has_errors(self) -> bool:
        return bool(self.errors)

    def print_summary(self) -> None:
        sep = "=" * 70
        print(sep)
        print(f"ERRORS:   {len(self.errors)}")
        for e in self.errors:
            print(f"  X  {e}")
        print(f"WARNINGS: {len(self.warnings)}")
        for w in self.warnings:
            print(f"  !  {w}")
        print(sep)


def check_liquid_balance(src: str, where: str, report: Report) -> None:
    if "\\!" in src:
        report.err(
            where,
            "Backslash-bang detected. Bash heredoc history-expansion bug "
            "mangled '!=' into '\\!='. Re-write via Write/Edit tool.",
        )
    for tag in PAIRED_TAGS:
        opens = len(re.findall(r"\{%-?\s*" + tag + r"\b", src))
        closes = len(re.findall(r"\{%-?\s*end" + tag + r"\b", src))
        if opens != closes:
            report.err(
                where,
                f"Liquid mismatch: {{% {tag} %}} opens={opens}, "
                f"{{% end{tag} %}} closes={closes}.",
            )
    for hit in NAMED_ARG_FILTER_CHAIN_RE.findall(src):
        report.err(
            where,
            f"Filter-chain inside image_tag named arg ('| {hit}: ...'). "
            "Pre-compute with {%- assign x = ... -%} first.",
        )


def extract_schema(src: str) -> dict[str, Any] | None:
    m = re.search(
        r"\{%-?\s*schema\s*-?%\}(.*?)\{%-?\s*endschema\s*-?%\}",
        src,
        re.DOTALL,
    )
    if m is None:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def _check_settings(settings, where, report, scope) -> None:
    seen_ids: set[str] = set()
    for s in settings:
        sid = s.get("id")
        stype = s.get("type")
        d = s.get("default")
        if sid is not None:
            if not ID_RE.match(sid):
                report.err(
                    where,
                    f"Setting ID {sid!r} ({scope}) invalid. Must match "
                    "^[a-z][a-z0-9_]*$.",
                )
            if sid in seen_ids:
                report.err(where, f"Duplicate setting ID {sid!r} ({scope}).")
            seen_ids.add(sid)
        if stype == "select":
            opts = [o.get("value") for o in s.get("options", []) or []]
            if d is not None and d not in opts:
                report.err(
                    where,
                    f"select {sid!r}: default {d!r} not in options {opts}.",
                )
        elif stype == "range":
            mn, mx, st = s.get("min"), s.get("max"), s.get("step")
            if isinstance(d, (int, float)) and isinstance(mn, (int, float)):
                if not (mn <= d <= mx):
                    report.err(
                        where,
                        f"range {sid!r}: default {d} outside [{mn}, {mx}].",
                    )
                if isinstance(st, (int, float)) and st > 0:
                    diff = (d - mn) / st
                    if abs(diff - round(diff)) > 1e-6:
                        report.err(
                            where,
                            f"range {sid!r}: default {d} not on step grid "
                            f"(min={mn} step={st}).",
                        )
        elif stype == "font_picker":
            if d is not None and not FONT_HANDLE_RE.match(str(d)):
                report.err(
                    where,
                    f"font_picker {sid!r}: INVALID handle {d!r}. Must match "
                    "family_<n|i><1-9> (e.g. playfair_display_n4 or "
                    "helvetica_i6). Mixing 'n'+'i' (like 'n4i') triggers "
                    "FileSaveError on save.",
                )
        elif stype == "checkbox":
            if d is not None and not isinstance(d, bool):
                report.err(where, f"checkbox {sid!r}: default {d!r} not bool.")
        elif stype == "color":
            if d is not None:
                if not (isinstance(d, str) and HEX_RE.match(d)):
                    report.warn(
                        where,
                        f"color {sid!r}: default {d!r} not 6-digit hex.",
                    )
        elif stype in ("text", "textarea", "richtext", "url", "html",
                       "inline_richtext", "video_url"):
            if d is not None and not isinstance(d, str):
                report.err(
                    where,
                    f"{stype} {sid!r}: default {d!r} not a string.",
                )
        elif stype == "image_picker":
            if d not in (None, ""):
                report.err(
                    where,
                    f"image_picker {sid!r}: default must be empty/null.",
                )


def check_section(path: Path, report: Report) -> dict[str, Any] | None:
    src = path.read_text(encoding="utf-8")
    where = f"sections/{path.name}"
    check_liquid_balance(src, where, report)
    sch = extract_schema(src)
    if sch is None:
        if re.search(r"\{%-?\s*schema\s*-?%\}", src) is not None:
            report.err(where, "Schema block present but JSON parse failed.")
        return None
    name = sch.get("name", "")
    if isinstance(name, str) and len(name) > 25 and not name.startswith("t:"):
        report.warn(
            where,
            f"Schema name {name!r} is {len(name)} chars (max 25).",
        )
    if "enabled_on" in sch and "disabled_on" in sch:
        report.err(
            where,
            "Schema has both enabled_on AND disabled_on. Shopify rejects this.",
        )
    _check_settings(sch.get("settings", []) or [], where, report, "section")
    for b in sch.get("blocks", []) or []:
        btype = b.get("type", "?")
        _check_settings(
            b.get("settings", []) or [],
            where,
            report,
            f"block:{btype}",
        )
    return sch


def check_snippet(path: Path, report: Report) -> None:
    src = path.read_text(encoding="utf-8")
    check_liquid_balance(src, f"snippets/{path.name}", report)


def check_template(path: Path, sections_dir: Path,
                   section_schemas: dict[str, dict[str, Any]],
                   report: Report) -> None:
    where = f"templates/{path.name}"
    try:
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"^\s*/\*.*?\*/\s*", "", text, count=1, flags=re.DOTALL)
        data = json.loads(text)
    except Exception as e:
        report.err(where, f"JSON invalid: {e}")
        return
    sections = data.get("sections", {})
    for k, v in sections.items():
        sec_type = v.get("type")
        if sec_type is None:
            report.err(where, f"Section entry {k!r} has no `type`.")
            continue
        sec_path = sections_dir / f"{sec_type}.liquid"
        if not sec_path.exists():
            report.err(where, f"References missing section: sections/{sec_type}.liquid")
            continue
        sch = section_schemas.get(sec_type)
        if sch is None:
            continue
        schema_settings = sch.get("settings", []) or []
        schema_setting_ids = {s["id"] for s in schema_settings if "id" in s}
        tmpl_settings = v.get("settings", {}) or {}
        if "color_scheme" in schema_setting_ids and "color_scheme" not in tmpl_settings:
            report.warn(
                where,
                f"section {k!r} (type {sec_type!r}) has color_scheme in "
                "its schema but template settings don't set it explicitly. "
                "Schema defaults are unreliable in templates — can 404.",
            )
        unknown = sorted(set(tmpl_settings.keys()) - schema_setting_ids)
        if unknown:
            report.err(
                where,
                f"section {k!r} (type {sec_type!r}) has UNKNOWN settings "
                f"not defined in current section schema: {unknown}. These "
                "are typically leftovers from older section versions. "
                "Shopify may render-error and 404 the page. Remove them.",
            )
        schema_blocks = {b["type"]: b for b in (sch.get("blocks", []) or [])}
        for bk, bv in (v.get("blocks") or {}).items():
            btype = bv.get("type")
            if btype not in schema_blocks:
                report.err(
                    where,
                    f"section {k!r} block {bk!r} unknown type {btype!r}. "
                    f"Allowed: {list(schema_blocks.keys())}.",
                )
                continue
            allowed = {s["id"] for s in (schema_blocks[btype].get("settings", []) or []) if "id" in s}
            b_unknown = sorted(set((bv.get("settings") or {}).keys()) - allowed)
            if b_unknown:
                report.err(
                    where,
                    f"section {k!r} block {bk!r} (type {btype!r}) has "
                    f"unknown block settings: {b_unknown}.",
                )


def check_css(path: Path, report: Report) -> None:
    src = path.read_text(encoding="utf-8")
    o = src.count("{")
    c = src.count("}")
    if o != c:
        report.err(
            f"assets/{path.name}",
            f"CSS brace mismatch: {o} opening vs {c} closing. A single "
            "missing `}` voids the entire stylesheet.",
        )


def check_locales(theme_root: Path, used_keys: set[str], report: Report) -> None:
    en_path = theme_root / "locales" / "en.default.json"
    if not en_path.exists():
        return
    try:
        en = json.loads(en_path.read_text(encoding="utf-8"))
    except Exception as e:
        report.err("locales/en.default.json", f"JSON invalid: {e}")
        return

    def has_key(data, parts):
        cur = data
        for p in parts:
            if isinstance(cur, dict) and p in cur:
                cur = cur[p]
            else:
                return False
        return True

    for key in sorted(used_keys):
        if not has_key(en, key.split(".")):
            report.warn(
                "locales/en.default.json",
                f"Key {key!r} used in Liquid but missing in en.default.json.",
            )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("theme_root")
    ap.add_argument("--only", default=None)
    args = ap.parse_args()
    theme_root = Path(args.theme_root).resolve()
    if not theme_root.exists():
        print(f"Error: {theme_root} does not exist", file=sys.stderr)
        return 1
    only_set = None
    if args.only:
        only_set = {p.strip() for p in args.only.split(",") if p.strip()}
    report = Report()
    sections_dir = theme_root / "sections"
    snippets_dir = theme_root / "snippets"
    templates_dir = theme_root / "templates"
    assets_dir = theme_root / "assets"
    section_schemas: dict[str, dict[str, Any]] = {}
    used_translation_keys: set[str] = set()
    if sections_dir.exists():
        print("== sections/ ==")
        for p in sorted(sections_dir.glob("*.liquid")):
            rel = f"sections/{p.name}"
            if only_set is not None and rel not in only_set:
                continue
            sch = check_section(p, report)
            if sch is not None:
                section_schemas[p.stem] = sch
            for m in T_FILTER_RE.finditer(p.read_text(encoding="utf-8")):
                used_translation_keys.add(m.group(1))
            print(f"  checked {rel}")
    # Always populate schemas even when --only is restricted, so template
    # checks have full context.
    if only_set is not None and sections_dir.exists():
        for p in sorted(sections_dir.glob("*.liquid")):
            if p.stem in section_schemas:
                continue
            sch = extract_schema(p.read_text(encoding="utf-8"))
            if sch is not None:
                section_schemas[p.stem] = sch
    if snippets_dir.exists():
        print("== snippets/ ==")
        for p in sorted(snippets_dir.glob("*.liquid")):
            rel = f"snippets/{p.name}"
            if only_set is not None and rel not in only_set:
                continue
            check_snippet(p, report)
            for m in T_FILTER_RE.finditer(p.read_text(encoding="utf-8")):
                used_translation_keys.add(m.group(1))
            print(f"  checked {rel}")
    if templates_dir.exists():
        print("== templates/ ==")
        for p in sorted(templates_dir.glob("*.json")):
            rel = f"templates/{p.name}"
            if only_set is not None and rel not in only_set:
                continue
            check_template(p, sections_dir, section_schemas, report)
            print(f"  checked {rel}")
    if assets_dir.exists():
        print("== assets/*.css ==")
        for p in sorted(assets_dir.glob("*.css")):
            rel = f"assets/{p.name}"
            if only_set is not None and rel not in only_set:
                continue
            check_css(p, report)
    if used_translation_keys:
        print("== locales/ ==")
        check_locales(theme_root, used_translation_keys, report)
    print()
    report.print_summary()
    return 1 if report.has_errors() else 0


if __name__ == "__main__":
    raise SystemExit(main())
