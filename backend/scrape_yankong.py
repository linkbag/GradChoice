#!/usr/bin/env python3
"""
scrape_yankong.py — 从 yankong.org (研控) API 爬取导师评价数据

API base: https://rms-api.realmofresearch.com
Endpoints:
  GET /index/version -> {"version": "hash"}
  GET /index/{hash}  -> {university: {dept: [names]}}
  GET /reviews/{sha1} -> [{rate, description, created_at, id}]

SHA1 = sha1(university + department + professor_name)
Rate: 0-50 scale (0 = no rating, divide by 10 for 0-5 scale)
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

API_BASE = "https://rms-api.realmofresearch.com"
OUT_DIR = Path(__file__).parent.parent / "data" / "raw" / "yankong"
DELAY = 1.0  # seconds between requests
USER_AGENT = "GradChoice-DataImport/1.0 (research; https://github.com/gradchoice)"


def fetch_json(url: str, retries: int = 3) -> dict | list | None:
    """Fetch JSON from URL with retries."""
    req = Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except (URLError, HTTPError, TimeoutError) as e:
            if attempt < retries - 1:
                print(f"  重试 {url}: {e}")
                time.sleep(2 ** attempt)
            else:
                print(f"  失败 {url}: {e}")
                return None


def compute_sha1(university: str, department: str, professor: str) -> str:
    """Compute SHA1 hash for professor identification."""
    return hashlib.sha1(f"{university}{department}{professor}".encode()).hexdigest()


def scrape():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: Get index version
    print("获取索引版本...")
    version_data = fetch_json(f"{API_BASE}/index/version")
    if not version_data:
        print("无法获取索引版本")
        sys.exit(1)
    version = version_data.get("version")
    print(f"  版本: {version}")

    # Step 2: Get full index
    print("下载教授索引...")
    index = fetch_json(f"{API_BASE}/index/{version}")
    if not index:
        print("无法下载索引")
        sys.exit(1)

    # Save index
    with open(OUT_DIR / "index.json", 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    # Count professors
    total_profs = 0
    professor_list = []
    for uni, depts in index.items():
        if not isinstance(depts, dict):
            continue
        for dept, names in depts.items():
            if not isinstance(names, list):
                continue
            for name in names:
                professor_list.append((uni, dept, name))
                total_profs += 1

    print(f"  共 {len(index)} 所大学, {total_profs} 位教授")

    # Step 3: Check for existing progress (resume support)
    reviews_file = OUT_DIR / "reviews.json"
    scraped = {}
    if reviews_file.exists():
        with open(reviews_file, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        for r in existing:
            key = f"{r.get('university','')}/{r.get('department','')}/{r.get('professor','')}"
            scraped[key] = r
        print(f"  已有 {len(scraped)} 条教授记录（续传）")

    # Step 4: Scrape reviews
    all_reviews = list(scraped.values())
    total_comments = sum(len(r.get('reviews', [])) for r in all_reviews)
    errors = 0
    new_fetched = 0

    print(f"\n开始爬取评论（每请求间隔 {DELAY}s）...")
    for i, (uni, dept, name) in enumerate(professor_list):
        key = f"{uni}/{dept}/{name}"
        if key in scraped:
            continue

        sha1 = compute_sha1(uni, dept, name)
        url = f"{API_BASE}/reviews/{sha1}"

        reviews = fetch_json(url)
        if reviews is None:
            errors += 1
            if errors > 50:
                print("错误过多，停止爬取")
                break
            time.sleep(DELAY)
            continue

        review_list = reviews if isinstance(reviews, list) else []
        record = {
            'university': uni,
            'department': dept,
            'professor': name,
            'sha1': sha1,
            'reviews': review_list,
        }
        all_reviews.append(record)
        scraped[key] = record
        total_comments += len(review_list)
        new_fetched += 1

        if new_fetched % 100 == 0:
            print(f"  进度: {new_fetched} 新获取 / {i+1}/{total_profs} 总计, 评论: {total_comments}, 错误: {errors}")
            # Save progress periodically
            with open(reviews_file, 'w', encoding='utf-8') as f:
                json.dump(all_reviews, f, ensure_ascii=False)

        time.sleep(DELAY)

    # Final save
    with open(reviews_file, 'w', encoding='utf-8') as f:
        json.dump(all_reviews, f, ensure_ascii=False)

    # Statistics
    profs_with_reviews = sum(1 for r in all_reviews if len(r.get('reviews', [])) > 0)
    print(f"\n完成！")
    print(f"  教授总数: {len(all_reviews)}")
    print(f"  有评论的教授: {profs_with_reviews}")
    print(f"  评论总数: {total_comments}")
    print(f"  新获取: {new_fetched}")
    print(f"  错误: {errors}")
    print(f"  保存至: {reviews_file}")


if __name__ == "__main__":
    scrape()
