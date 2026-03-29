# GradChoice Public Data

This directory contains public data snapshots from the GradChoice database.

## Files

### `supervisors-2026-03-28.csv`
- **Contents:** 107,307 graduate supervisor profiles from Chinese universities
- **Columns:** `id`, `school_code`, `school_name`, `province`, `name`, `department`, `title`, `affiliated_unit`, `webpage_url_1/2/3`, `avg_overall_score`, `rating_count`, `created_at`, `updated_at`, `verified_avg_overall_score`, `verified_rating_count`
- **Source:** Compiled from publicly available university enrollment directories and faculty pages for ~90 HEIs in China
- **Exported:** 2026-03-28

### `ratings-anonymized-2026-03-28.csv`
- **Contents:** 13,025 anonymized supervisor ratings
- **Columns:** `id`, `supervisor_id`, `is_verified_rating`, `overall_score`, `score_academic`, `score_mentoring`, `score_wellbeing`, `score_stipend`, `score_resources`, `score_ethics`, `upvotes`, `downvotes`, `created_at`, `first_year_income`
- **Privacy:** `user_id` and all user-identifying fields are intentionally excluded
- **Exported:** 2026-03-28

## Privacy

User data is intentionally **not** included in this snapshot:
- No user emails, usernames, or passwords
- No message content
- No student verification documents
- Ratings are stripped of their `user_id` foreign key

## License

MIT — same as the rest of the GradChoice repository.

## Scripts

- `db_cleanup.py` — removes false names and title suffixes from the supervisor database
- `rescrape.py` — web scraper for (school, department) pairs needing re-scraping
- `blocklist.json` — 1,010 explicit false names + 6 regex patterns used during data cleaning
- `clean_xlsx.py` — cleans source XLSX/CSV files with the blocklist
