#!/usr/bin/env python3
"""
Shopify theme pre-commit validator.

Usage:
    python3 check-theme.py /path/to/theme

Checks:
  1. Every {% schema %} block parses as valid JSON
  2. Schema IDs match ^[a-z][a-z0-9_]*$ and are <= 25 chars
  3. No duplicate setting IDs within a settings array
  4. Section/block names <= 25 chars
  5. No section has both disabled_on and enabled_on
  6. Liquid braces balanced, every opener has a matching end-tag
  7. No \\! escape artifacts (bash heredoc bug)
  8. No invalid `{{ x | if, a, b }}` ternary-style filter

Exits 1 on any error.
"""
import json
import re
import sys
from pathlib import Path

ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
TAG_RE = re.compile(r"\{%-?\s*([a-zA-Z_]+)\b(.*?)-?%\}", re.DOTALL)
OUT_RE = re.compile(r"\{\{(.*?)\}\}", re.DOTALL)
SCHEMA_RE = re.compile(r"\{%\s*schema\s*%\}(.*?)\{%\s*endschema\s*%\}", re.DOTALL)
PAIRED_OPENS = {
    "if", "unless", "for", "case", "capture", "comment", "form", "paginate",
    "raw", "schema", "stylesheet", "javascript", "style", "tablerow", "doc",
}

errors = []
warnings = []


def check_setting(s, path, scope):
    stype = s.get("type")
    if stype in ("header", "paragraph"):
        if "content" not in s:
            errors.append(f"{path} [{scope}]: '{stype}' missing 'content'")
        return None
    sid = s.get("id")
    if not sid:
        errors.append(f"{path} [{scope}]: type '{stype}' missing 'id'")
        return None
    if not ID_RE.match(sid):
        errors.append(f"{path} [{scope}]: invalid id '{sid}' (must match ^[a-z][a-z0-9_]*$)")
    if len(sid) > 25:
        warnings.append(f"{path} [{scope}]: id '{sid}' exceeds 25 chars")
    if "label" not in s:
        errors.append(f"{path} [{scope}]: setting '{sid}' missing 'label'")
    return sid


def validate_schema(schema, path):
    name = schema.get("name", "")
    if isinstance(name, str) and not name.startswith("t:") and len(name) > 25:
        warnings.append(f"{path}: section name '{name}' exceeds 25 chars")
    seen = set()
    for s in schema.get("settings", []) or []:
        sid = check_setting(s, path, "settings")
        if sid:
            if sid in seen:
                errors.append(f"{path} [settings]: duplicate id '{sid}'")
            seen.add(sid)
    for b in schema.get("blocks", []) or []:
        btype = b.get("type")
        if btype and btype not in ("@app", "@theme") and not ID_RE.match(btype):
            errors.append(f"{path}: block type '{btype}' invalid")
        bname = b.get("name", "")
        if isinstance(bname, str) and not bname.startswith("t:") and len(bname) > 25:
            warnings.append(f"{path}: block '{btype}' name exceeds 25 chars")
        bseen = set()
        for s in b.get("settings", []) or []:
            sid = check_setting(s, path, f"block[{btype}]")
            if sid:
                if sid in bseen:
                    errors.append(f"{path} [block {btype}]: duplicate id '{sid}'")
                bseen.add(sid)
    if "disabled_on" in schema and "enabled_on" in schema:
        errors.append(f"{path}: cannot have both 'disabled_on' and 'enabled_on'")


def validate_liquid_structure(text, name):
    if text.count("{%") != text.count("%}"):
        errors.append(f"{name}: unbalanced {{% %}} ({text.count('{%')} vs {text.count('%}')})")
    if text.count("{{") != text.count("}}"):
        errors.append(f"{name}: unbalanced {{{{ }}}} ({text.count('{{')} vs {text.count('}}')})")
    stripped = text
    for block in ("raw", "comment", "schema", "stylesheet", "javascript", "style", "doc"):
        pat = r"\{%-?\s*" + block + r"\s*-?%\}.*?\{%-?\s*end" + block + r"\s*-?%\}"
        stripped = re.sub(pat, "", stripped, flags=re.DOTALL)
    # {% liquid %} is inline (no endliquid) — strip the tag itself
    stripped = re.sub(r"\{%-?\s*liquid\b.*?-?%\}", "", stripped, flags=re.DOTALL)
    stack = []
    for m in TAG_RE.finditer(stripped):
        tag = m.group(1)
        if tag == "liquid":
            continue
        if tag in PAIRED_OPENS:
            stack.append((tag, m.start()))
        elif tag.startswith("end"):
            base = tag[3:]
            if not stack:
                errors.append(f"{name}: stray {{% {tag} %}}")
            else:
                opened, _ = stack[-1]
                if opened != base:
                    errors.append(f"{name}: {{% {tag} %}} doesn't match opening {{% {opened} %}}")
                stack.pop()
    for opened, off in stack:
        errors.append(f"{name}: unclosed {{% {opened} %}} at offset {off}")
    for m in OUT_RE.finditer(text):
        if re.search(r"\|\s*if\s*,", m.group(1)):
            errors.append(f"{name}: invalid ternary-style filter `{m.group(1).strip()}` (Liquid has no ternary)")
    if re.search(r"\\!", text):
        errors.append(f"{name}: contains \\! escape artifact (bash heredoc bug — never write Liquid via heredoc)")


def main():
    if len(sys.argv) < 2:
        print(f"usage: {sys.argv[0]} /path/to/theme", file=sys.stderr)
        sys.exit(2)
    root = Path(sys.argv[1])
    if not root.is_dir():
        print(f"not a directory: {root}", file=sys.stderr)
        sys.exit(2)

    targets = list((root / "sections").glob("*.liquid")) + \
              list((root / "snippets").glob("*.liquid")) + \
              list((root / "layout").glob("*.liquid"))
    schemas_checked = 0
    for f in sorted(targets):
        text = f.read_text(encoding="utf-8")
        validate_liquid_structure(text, str(f.relative_to(root)))
        m = SCHEMA_RE.search(text)
        if m:
            schemas_checked += 1
            try:
                schema = json.loads(m.group(1).strip())
            except json.JSONDecodeError as e:
                errors.append(f"{f.relative_to(root)}: schema JSON error: {e}")
                continue
            validate_schema(schema, str(f.relative_to(root)))

    print(f"Checked {len(targets)} liquid files, {schemas_checked} schemas.")
    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for w in warnings:
            print("  " + w)
    if errors:
        print(f"\nERRORS ({len(errors)}):")
        for e in errors:
            print("  " + e)
        sys.exit(1)
    print("\nAll checks passed.")


if __name__ == "__main__":
    main()
