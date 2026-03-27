"""
GradChoice Name Filter — prevents false/junk entries from entering the supervisor database.
Loads blocklist from data/blocklist.json and applies heuristic rules.

Design notes:
- The explicit blocklist was derived from human review of scraped data (Agent gc-data-cleanup).
  Some entries in the original Obsidian note were real names that appeared in false-name
  positions (e.g., scraped from navigation links). These have been removed from blocklist.json:
    丁一兵, 乌云毕力格, 特尔巴衣尔, 袁春风
- Heuristic rules are conservative: only block strings that are clearly NOT personal names
  (single chars, pure digits, navigation phrases, trailing-dash patterns, title-only strings).
- Regex patterns from blocklist.json handle pagination/navigation text.
- The explicit blocklist handles phrases that look like names but aren't (4-char admin phrases,
  category headings, etc.) without needing school/department context.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Path: backend/app/utils/name_filter.py → 3 levels up → backend root (works in
# local dev, Docker volume mount, and Lambda where backend/ is the package root).
# The blocklist.json lives at backend/data/blocklist.json (copied from data/ at
# project root during build/deploy).
_DEFAULT_BLOCKLIST = (
    Path(__file__).resolve().parent.parent.parent / "data" / "blocklist.json"
)

# CJK Unified Ideographs range U+4E00–U+9FFF (most common CJK block)
_CJK_MIN = 0x4E00
_CJK_MAX = 0x9FFF


def _is_cjk(char: str) -> bool:
    return _CJK_MIN <= ord(char) <= _CJK_MAX


def _cjk_count(s: str) -> int:
    return sum(1 for c in s if _is_cjk(c))


class NameFilter:
    """
    Filter for detecting and cleaning false/junk supervisor name entries.

    Usage::

        # Standalone (uses default blocklist path)
        f = NameFilter()
        cleaned, reason = f.clean_name("李玉珂副教授")  # → ("李玉珂", "")
        cleaned, reason = f.clean_name("师德师风")       # → (None, "blocked: '师德师风'")

        # With explicit path (e.g. in tests)
        f = NameFilter(blocklist_path="/path/to/blocklist.json")
    """

    def __init__(self, blocklist_path: Optional[str | Path] = None):
        """Load blocklist from JSON. Default path: project_root/data/blocklist.json.

        If the file is not found (e.g. in Lambda deployments that omit data/),
        the filter initialises with empty lists and logs a warning — name filtering
        is disabled but the endpoint still works.
        """
        path = Path(blocklist_path) if blocklist_path else _DEFAULT_BLOCKLIST
        self._blocklist_path = path

        if not path.exists():
            logger.warning(
                "blocklist.json not found at %s — name filtering disabled (heuristic rules still active)",
                path,
            )
            data: dict = {}
        else:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)

        # Explicit false-name list (set for O(1) lookup)
        self._explicit: set[str] = {e.strip() for e in data.get("explicit", [])}
        # Title suffixes sorted longest-first for greedy matching
        self._title_suffixes: list[str] = sorted(
            data.get("title_suffixes", []), key=len, reverse=True
        )
        # Compiled regex patterns from blocklist
        self._patterns: list[re.Pattern] = [
            re.compile(p) for p in data.get("patterns", [])
        ]

    # ──────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────

    def is_blocked(self, name: str) -> bool:
        """Return True if the name should be rejected.

        Checks (in order):
        1. Heuristic structural rules (single char, digits-only, trailing dash, etc.)
        2. Regex patterns from blocklist.json (pagination, navigation text)
        3. Explicit blocklist (exact string match)
        """
        stripped = name.strip() if name else ""
        if not stripped:
            return True

        if self._heuristic_blocked(stripped):
            return True

        for pat in self._patterns:
            if pat.search(stripped):
                return True

        if stripped in self._explicit:
            return True

        return False

    def strip_title(self, name: str) -> str:
        """Strip academic title suffixes from a name.

        Examples::
            '李玉珂副教授' → '李玉珂'
            '何海平教授'   → '何海平'
            '冯喜康讲师'   → '冯喜康'
            '教授'         → '教授'  (no strip: < 2 CJK chars would remain)

        Only strips when the remainder has ≥ 2 CJK characters.
        Suffixes are checked longest-first to handle '副教授' before '教授'.
        """
        for suffix in self._title_suffixes:
            if name.endswith(suffix):
                remainder = name[: -len(suffix)]
                if _cjk_count(remainder) >= 2:
                    return remainder
                # Suffix matched but stripping would leave too short a name — stop here
                break
        return name

    def clean_name(self, name: str) -> tuple[str | None, str]:
        """Full pipeline: strip title suffix, then check blocklist.

        Returns:
            (cleaned_name, '')        if the name is acceptable
            (None, reason_string)     if the name should be rejected
        """
        if not name or not name.strip():
            return None, "empty name"

        cleaned = self.strip_title(name.strip())

        if self.is_blocked(cleaned):
            return None, f"blocked: {cleaned!r}"

        return cleaned, ""

    def filter_batch(
        self, names: list[str]
    ) -> tuple[list[str], list[tuple[str, str]]]:
        """Filter a list of names through the full pipeline.

        Returns:
            accepted               — list of cleaned, accepted names
            rejected_with_reasons  — list of (original_name, reason) tuples
        """
        accepted: list[str] = []
        rejected: list[tuple[str, str]] = []
        for name in names:
            cleaned, reason = self.clean_name(name)
            if cleaned is not None:
                accepted.append(cleaned)
            else:
                rejected.append((name, reason))
        return accepted, rejected

    def add_to_blocklist(self, name: str) -> None:
        """Add a name to the runtime explicit blocklist and persist to JSON."""
        entry = name.strip()
        if not entry or entry in self._explicit:
            return
        self._explicit.add(entry)

        with open(self._blocklist_path, encoding="utf-8") as f:
            data = json.load(f)
        data["explicit"] = sorted(self._explicit)
        with open(self._blocklist_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    # ──────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────

    def _heuristic_blocked(self, name: str) -> bool:
        """Conservative heuristic rules — only block clearly non-name strings."""
        # Too short (< 2 chars after stripping)
        if len(name) < 2:
            return True

        # Only digits, punctuation, or whitespace — not a name
        if re.fullmatch(r"[\d\s\W]+", name):
            return True

        # Single CJK character (e.g. "教", "张")
        if len(name) == 1 and _is_cjk(name[0]):
            return True

        # Trailing dash scraped from hyperlinks: "张晞-", "程洁-"
        if name.endswith("-") or name.endswith("—"):
            return True

        # Current-position breadcrumb: "当前位置:"
        if "当前位置" in name or name.startswith("当前"):
            return True

        # Title-only entry: stripping the suffix leaves < 2 CJK chars
        # e.g. "教授" → "" → blocked; "副教授" → "" → blocked
        for suffix in self._title_suffixes:
            if name.endswith(suffix):
                remainder = name[: -len(suffix)]
                if _cjk_count(remainder) < 2:
                    return True
                break

        return False


# ──────────────────────────────────────────────
# Module-level singleton (lazy init)
# ──────────────────────────────────────────────

_default_filter: NameFilter | None = None


def get_name_filter() -> NameFilter:
    """Return the module-level singleton NameFilter (lazy-loaded)."""
    global _default_filter
    if _default_filter is None:
        _default_filter = NameFilter()
    return _default_filter
