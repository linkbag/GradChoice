"""
Tests for backend/app/utils/name_filter.py

Design notes:
- The explicit blocklist applies to all is_blocked() calls (no school/dept context required).
- 4 confirmed real names were REMOVED from blocklist.json because they appeared there by
  mistake (scraped from nav links):
    丁一兵, 乌云毕力格, 特尔巴衣尔, 袁春风
  These are verified real professors and should NOT be blocked.
- Heuristic rules are conservative: they catch clearly non-name structural patterns only.
"""

import sys
from pathlib import Path

import pytest

# Make 'app' importable when running tests from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.utils.name_filter import NameFilter

BLOCKLIST_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "blocklist.json"


@pytest.fixture(scope="module")
def f():
    return NameFilter(blocklist_path=BLOCKLIST_PATH)


# ──────────────────────────────────────────────
# Explicit blocklist
# ──────────────────────────────────────────────

def test_explicit_blocklist(f: NameFilter):
    """Known false/junk entries from the explicit list should be blocked."""
    blocked = [
        "师德师风",      # ethics/virtue phrase
        "教工之家",      # staff community center
        "诚聘英才",      # hiring phrase
        "办事流程",      # administrative process
        "学院领导",      # college leadership
        "副教授",        # title-only (no name)
        "博士生导师",    # title phrase
        "研究生",        # graduate students
        "校友名录",      # alumni directory
    ]
    for name in blocked:
        assert f.is_blocked(name), f"Expected {name!r} to be blocked"


# ──────────────────────────────────────────────
# Title stripping
# ──────────────────────────────────────────────

def test_title_stripping(f: NameFilter):
    """Title suffixes should be stripped correctly."""
    cases = [
        ("李玉珂副教授",  "李玉珂"),
        ("何海平教授",    "何海平"),
        ("冯喜康讲师",    "冯喜康"),
        ("王强助教",      "王强"),
        ("陈研助理教授",  "陈研"),
        ("刘伟研究员",    "刘伟"),
        ("张副研究员",    "张副研究员"),   # only 1 CJK char would remain → no strip
        # No suffix → unchanged
        ("张三",          "张三"),
        ("李四",          "李四"),
    ]
    for raw, expected in cases:
        result = f.strip_title(raw)
        assert result == expected, f"strip_title({raw!r}) = {result!r}, expected {expected!r}"


def test_standalone_title_blocked(f: NameFilter):
    """Standalone title-only entries (no name part) should be blocked."""
    blocked = ["教授", "副教授", "讲师", "助教", "研究员"]
    for name in blocked:
        assert f.is_blocked(name), f"Expected title-only {name!r} to be blocked"


def test_clean_name_strips_title(f: NameFilter):
    """clean_name should strip title and return cleaned name."""
    cleaned, reason = f.clean_name("李玉珂副教授")
    assert cleaned == "李玉珂"
    assert reason == ""

    cleaned, reason = f.clean_name("教授")  # title-only → blocked
    assert cleaned is None
    assert reason != ""


# ──────────────────────────────────────────────
# Single character blocked
# ──────────────────────────────────────────────

def test_single_char_blocked(f: NameFilter):
    """Single CJK characters should be blocked."""
    for char in ["张", "李", "教", "学", "研"]:
        assert f.is_blocked(char), f"Expected single char {char!r} to be blocked"


def test_single_ascii_char_blocked(f: NameFilter):
    """Single ASCII characters should be blocked."""
    for char in ["a", "B", "Z"]:
        assert f.is_blocked(char), f"Expected {char!r} to be blocked"


# ──────────────────────────────────────────────
# Heuristic structural rules
# ──────────────────────────────────────────────

def test_digits_only_blocked(f: NameFilter):
    """Pure-digit strings should be blocked."""
    for s in ["123", "001", "2024"]:
        assert f.is_blocked(s), f"Expected digits-only {s!r} to be blocked"


def test_trailing_dash_blocked(f: NameFilter):
    """Names with trailing dashes (scraped from hyperlinks) should be blocked."""
    for s in ["张晞-", "程洁-"]:
        assert f.is_blocked(s), f"Expected trailing-dash {s!r} to be blocked"


def test_empty_blocked(f: NameFilter):
    """Empty strings and whitespace-only should be blocked."""
    for s in ["", "  ", "\t"]:
        assert f.is_blocked(s), f"Expected empty/whitespace to be blocked"


def test_navigation_patterns_blocked(f: NameFilter):
    """Pagination and navigation text should be blocked."""
    for s in ["上一页", "下一页", "上页", "下页", "尾页", "首页"]:
        assert f.is_blocked(s), f"Expected navigation text {s!r} to be blocked"


# ──────────────────────────────────────────────
# Real names should pass
# ──────────────────────────────────────────────

def test_real_names_pass(f: NameFilter):
    """Common Chinese personal names should NOT be blocked."""
    real_names = [
        "张三",
        "李四",
        "王五",
        "陈怡然",
        "丁一兵",        # removed from blocklist — confirmed real professor
        "欧阳娜娜",      # 4-char compound surname
        "司马光",
        "王小明",
        "刘晓东",
        "赵雅芝",
    ]
    for name in real_names:
        assert not f.is_blocked(name), f"Real name {name!r} should NOT be blocked"


def test_real_names_clean_pass(f: NameFilter):
    """clean_name should return the name unchanged for real names without titles."""
    for name in ["张三", "李四", "王五", "陈怡然", "丁一兵"]:
        cleaned, reason = f.clean_name(name)
        assert cleaned == name, f"clean_name({name!r}) returned {cleaned!r}, expected unchanged"
        assert reason == ""


# ──────────────────────────────────────────────
# Edge cases — borderline or ethnic minority names
# ──────────────────────────────────────────────

def test_edge_cases(f: NameFilter):
    """Borderline names and ethnic minority names should pass."""
    should_pass = [
        "特尔巴衣尔",   # legitimate Mongolian name (removed from blocklist)
        "乌云毕力格",   # legitimate Mongolian name (removed from blocklist)
        "袁春风",       # real professor at 南京大学 CS (removed from blocklist)
        "阿不都热依木", # Uyghur name
        "扎西次仁",     # Tibetan name
    ]
    for name in should_pass:
        assert not f.is_blocked(name), f"Ethnic/borderline name {name!r} should NOT be blocked"


# ──────────────────────────────────────────────
# filter_batch
# ──────────────────────────────────────────────

def test_filter_batch(f: NameFilter):
    names = ["张三", "师德师风", "李玉珂副教授", "教授", "王五"]
    accepted, rejected = f.filter_batch(names)
    assert "张三" in accepted
    assert "李玉珂" in accepted  # title stripped
    assert "王五" in accepted
    assert len(accepted) == 3

    rejected_names = [r[0] for r in rejected]
    assert "师德师风" in rejected_names
    assert "教授" in rejected_names
    assert len(rejected) == 2


# ──────────────────────────────────────────────
# clean_name pipeline
# ──────────────────────────────────────────────

def test_clean_name_blocked_returns_reason(f: NameFilter):
    """clean_name should return (None, reason) for blocked names."""
    cleaned, reason = f.clean_name("师德师风")
    assert cleaned is None
    assert len(reason) > 0

    cleaned, reason = f.clean_name("")
    assert cleaned is None
    assert "empty" in reason


def test_clean_name_real_name(f: NameFilter):
    """clean_name should return (name, '') for valid names."""
    cleaned, reason = f.clean_name("张三")
    assert cleaned == "张三"
    assert reason == ""
