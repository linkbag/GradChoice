"""Tests for the historical-import metadata backfill.

Covers the two contracts that matter:
  * the committed date index (data/import_dates.csv.gz) stays loadable and well-formed
  * the description-hash contract stays in step with data/build_import_date_index.py,
    which is what lets a database comment be matched back to its source record
"""
import sys
from datetime import timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import backfill_import_metadata as backfill  # noqa: E402

# A real record from the imported archive (data/normalized/combined.json).
SOURCE_DESCRIPTION = (
    "学生前途：不想让出去实习，因为实习的事情和学生一度闹的很僵，最后奋劝各位一句，能不来就别来"
)
SOURCE_MONTH = "2017-08"


def test_date_index_is_loadable_and_wellformed():
    index = backfill.load_date_index()

    assert len(index) > 20000, "the index should cover the whole imported comment set"
    for digest, date in list(index.items())[:500]:
        assert len(digest) == 32 and all(c in "0123456789abcdef" for c in digest)
        parts = date.split("-")
        assert len(parts) in (2, 3), date
        assert 2000 <= int(parts[0]) <= 2026, date
        assert 1 <= int(parts[1]) <= 12, date
        if len(parts) == 3:
            assert 1 <= int(parts[2]) <= 31, date


def test_source_comment_is_found_in_the_index():
    index = backfill.load_date_index()
    assert index[backfill.content_hash(SOURCE_DESCRIPTION)] == SOURCE_MONTH


def test_content_hash_ignores_whitespace_differences():
    assert backfill.content_hash("a  b\n c") == backfill.content_hash(" a b c ")


def test_strip_attribution_returns_the_original_comment():
    content = f"{SOURCE_DESCRIPTION}\n\n——此条评论转载自 https://github.com/kgco/RateMySupervisor"
    assert backfill.strip_attribution(content) == SOURCE_DESCRIPTION


def test_imported_comment_round_trips_to_its_original_month():
    """End-to-end: stored content -> stripped -> hashed -> date, for either suffix."""
    index = backfill.load_date_index()
    for url in (backfill.OLD_SOURCE_URL, backfill.NEW_SOURCE_URL):
        content = f"{SOURCE_DESCRIPTION}\n\n——此条评论转载自 {url}"
        date = index[backfill.content_hash(backfill.strip_attribution(content))]
        assert backfill.parse_date(date).isoformat() == "2017-08-01T00:00:00+00:00"


def test_parse_date_handles_both_precisions():
    assert backfill.parse_date("2019-03").isoformat() == "2019-03-01T00:00:00+00:00"
    assert backfill.parse_date("2019-03-14").isoformat() == "2019-03-14T00:00:00+00:00"
    assert backfill.parse_date("2019-03").tzinfo == timezone.utc


def test_attribution_targets_the_live_repository():
    assert backfill.NEW_SOURCE_URL == "https://github.com/pengp25/RateMySupervisor"
    assert "kgco" in backfill.OLD_SOURCE_URL  # the repository that now 404s
