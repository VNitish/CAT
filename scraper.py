#!/usr/bin/env python3
"""
CAT Question Paper Scraper
Scrapes past year CAT questions from online.2iim.com and inserts into MongoDB.

Usage:
  python scraper.py                          # scrape everything (2017-2025)
  python scraper.py --year 2024              # one year
  python scraper.py --year 2023 --slot 2    # one paper
  python scraper.py --section QA            # one section across all years/slots
"""

import re
import time
import os
import argparse
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup, Comment
from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError

# ── Config ────────────────────────────────────────────────────────────────────

load_dotenv()
MONGO_URI = os.getenv("MONGODB_STRING")
BASE_URL   = "https://online.2iim.com/CAT-question-paper"

# Years and their slot counts
YEAR_SLOTS = {
    2017: 2, 2018: 2, 2019: 2,
    2020: 3, 2021: 3, 2022: 3, 2023: 3, 2024: 3, 2025: 3,
}

# DB section name → URL segment
# Fallbacks tried in order if the primary URL 404s
SECTION_URL_VARIANTS = {
    "QA":   ["Quant"],
    "DILR": ["DILR", "DI-LR"],
    "VARC": ["VARC", "VA-RC"],
}

# A <p align="justify"> must exceed this length to be considered a passage/set-context
PASSAGE_MIN_LEN = 200

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ── HTTP ──────────────────────────────────────────────────────────────────────

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0 (compatible; CAT-scraper/1.0)"})


def fetch(url: str):
    """Fetch a URL.  Returns (response_text, None) or (None, error_str)."""
    try:
        r = SESSION.get(url, timeout=30)
        if r.status_code == 404:
            return None, "404"
        r.raise_for_status()
        return r.text, None
    except Exception as e:
        return None, str(e)


# ── Parsing helpers ───────────────────────────────────────────────────────────

def parse_answer_tooltip(span) -> tuple[str, bool]:
    """
    Parse the 'Correct Answer' tooltip span.
    Returns (answer_value, is_mcq).
      MCQ  → ("A"/"B"/"C"/"D", True)
      TITA → (numeric_string,  False)
    """
    text = span.get_text(separator=" ", strip=True)
    m = re.search(r"Choice\s+([A-D])", text, re.IGNORECASE)
    if m:
        return m.group(1).upper(), True
    # Strip any residual HTML junk and return the raw value
    return text.strip(), False


def parse_options(choice_ol) -> list | None:
    """Parse MCQ options from <ol class='choice'>. Returns None if empty (TITA)."""
    if not choice_ol:
        return None
    items = choice_ol.find_all("li", recursive=False)
    if not items:
        return None
    labels = ["A", "B", "C", "D"]
    return [{"label": labels[i], "text": li.get_text(strip=True)} for i, li in enumerate(items) if i < 4]


def is_passage_para(elem) -> bool:
    """True if this element looks like a set-context / RC passage paragraph."""
    if elem.name != "p":
        return False
    align = (elem.get("align") or "").lower()
    if align != "justify":
        return False
    text = elem.get_text(strip=True)
    return len(text) >= PASSAGE_MIN_LEN


def is_question_li(elem) -> bool:
    """True if this <li> is a CAT question.

    Newer pages (2020+): question <li> always has an <h4> heading.
    Older pages (pre-2020): question <li> has no <h4> but does have
    <ol class='choice'> or <div class='btn-group'>.
    """
    if elem.name != "li":
        return False
    if elem.find("h4"):
        return True
    # Older format fallback — presence of choice list or answer button group
    return bool(elem.find("ol", class_="choice") or elem.find("div", class_="btn-group"))


def _passage_text(p_elem) -> str:
    """Extract only the prose text from a passage <p>, stopping before any
    nested <ol>/<div>/<table> (which may contain question content on older pages
    where the <p> tag was never closed before <ol class='ques'>)."""
    from bs4 import NavigableString
    parts = []
    for child in p_elem.children:
        if isinstance(child, NavigableString):
            t = str(child).strip()
            if t:
                parts.append(t)
        elif child.name == "br":
            parts.append(" ")
        elif child.name in ("b", "i", "em", "strong", "u", "span", "a", "sup", "sub"):
            parts.append(child.get_text())
        elif child.name in ("ol", "div", "table", "img", "noscript"):
            break   # stop — structural/question content starts here
    return " ".join(parts).strip()


# ── Core extractor ────────────────────────────────────────────────────────────

def extract_questions(
    html: str,
    section_db: str,
    paper_id,
    paper_code: str,
    year: int,
    slot: int,
) -> list[dict]:
    """
    Walk the page HTML in document order.
    - <p align="justify"> with substantial text → start of a new set (DILR / VARC RC).
    - <li> with <h4> → a question.

    Returns a list of question dicts ready for MongoDB.
    """
    soup = BeautifulSoup(html, "html.parser")

    questions      = []
    current_passage = None
    current_set_idx = 0
    set_q_count     = 0
    q_num           = 0
    seen_ids        = set()   # avoid re-processing children of already-yielded elements

    for elem in soup.descendants:
        eid = id(elem)
        if eid in seen_ids:
            continue

        # ── Passage / set-context ────────────────────────────────
        if is_passage_para(elem):
            # Only treat as a passage if the <p> is NOT inside a <li> or another <p>.
            # Note: on some older pages the <p> is not closed before <ol class="ques">,
            # so html.parser nests the entire question list inside the <p>.  We must
            # NOT mark the <p>'s descendants as seen — that would swallow all questions.
            # We also extract only the prose text (not text from nested <ol>/<div>).
            if not any(p.name in ("li", "p") for p in elem.parents):
                current_passage  = _passage_text(elem)
                current_set_idx += 1
                set_q_count      = 0
            continue

        # ── Question <li> ─────────────────────────────────────────
        if not is_question_li(elem):
            continue

        q_num       += 1
        set_q_count += 1
        for child in elem.descendants:
            seen_ids.add(id(child))

        # QID from HTML comment
        qid = None
        for child in elem.children:
            if isinstance(child, Comment):
                m = re.search(r"QID:\s*(\d+)", str(child))
                if m:
                    qid = m.group(1)
                    break

        # Question text  — first <p> that follows the <h4>
        question_text = ""
        h4 = elem.find("h4")
        if h4:
            for sib in h4.next_siblings:
                if getattr(sib, "name", None) == "p":
                    question_text = sib.get_text(strip=True)
                    break
        if not question_text:
            first_p = elem.find("p")
            question_text = first_p.get_text(strip=True) if first_p else ""

        # Options
        choice_ol = elem.find("ol", class_="choice")
        options   = parse_options(choice_ol)

        # Correct answer
        correct_answer = None
        detected_mcq   = options is not None
        for tooltip_div in elem.find_all("div", class_="tooltip"):
            btn = tooltip_div.find("button")
            if btn and "Correct Answer" in btn.get_text():
                span = tooltip_div.find("span", class_="tooltiptext")
                if span:
                    correct_answer, detected_mcq = parse_answer_tooltip(span)
                break

        question_type   = "MCQ" if (options or detected_mcq) else "TITA"
        marks_incorrect = -1 if question_type == "MCQ" else 0

        # Set grouping — only for DILR and VARC (RC questions)
        use_set     = section_db in ("DILR", "VARC") and current_passage is not None
        set_id      = f"SET_{paper_code}_{section_db}_{current_set_idx:02d}" if use_set else None
        set_position = set_q_count if use_set else None

        questions.append({
            "question_code":   f"CAT_{year}_S{slot}_{section_db}_Q{q_num:02d}",
            "paper_id":        paper_id,
            "section":         section_db,
            "question_type":   question_type,
            "topic":           None,       # not present on this site; can be enriched later
            "subtopic":        None,
            "set_id":          set_id,
            "set_position":    set_position,
            "context_passage": current_passage if use_set else None,
            "question_text":   question_text,
            "options":         options,
            "correct_answer":  correct_answer,
            "marks_correct":   3,
            "marks_incorrect": marks_incorrect,
            "explanation":     None,
            "difficulty":      None,
            "question_number": q_num,
            "tags":            [],
            "is_image_based":  False,
            "image_url":       None,
            "source_qid":      qid,        # original QID from 2iim
            "source_url":      None,       # filled in by caller
            "created_at":      datetime.now(timezone.utc),
            "updated_at":      datetime.now(timezone.utc),
        })

    return questions


# ── MongoDB helpers ───────────────────────────────────────────────────────────

def upsert_questions(col, questions: list) -> tuple[int, int]:
    """Bulk upsert questions. Returns (inserted, modified)."""
    if not questions:
        return 0, 0
    ops = [
        UpdateOne(
            {"question_code": q["question_code"]},
            {
                "$set": {k: v for k, v in q.items() if k != "created_at"} | {"updated_at": datetime.now(timezone.utc)},
                "$setOnInsert": {"created_at": q["created_at"]},
            },
            upsert=True,
        )
        for q in questions
    ]
    try:
        res = col.bulk_write(ops, ordered=False)
        return res.upserted_count, res.modified_count
    except BulkWriteError as e:
        log.error(f"BulkWriteError: {e.details.get('writeErrors', [])[:3]}")
        return 0, 0


def ensure_indexes(papers_col, qs_col):
    papers_col.create_index("paper_code", unique=True)
    qs_col.create_index("question_code", unique=True)
    qs_col.create_index([("paper_id", 1), ("section", 1), ("question_number", 1)])
    qs_col.create_index("set_id")
    qs_col.create_index([("section", 1), ("topic", 1), ("difficulty", 1)])
    qs_col.create_index("source_qid")


# ── Main scraper loop ─────────────────────────────────────────────────────────

def run(years=None, slots=None, sections=None):
    client     = MongoClient(MONGO_URI)
    db         = client["cat"]
    papers_col = db["question_papers"]
    qs_col     = db["questions"]
    ensure_indexes(papers_col, qs_col)

    target_years    = sorted(years    or YEAR_SLOTS.keys())
    target_sections = sections or list(SECTION_URL_VARIANTS.keys())
    grand_total     = 0

    for year in target_years:
        max_slots    = YEAR_SLOTS.get(year, 3)
        target_slots = slots or list(range(1, max_slots + 1))

        for slot in target_slots:
            if slot > max_slots:
                log.warning(f"CAT {year} only has {max_slots} slot(s), skipping slot {slot}")
                continue

            paper_code = f"CAT_{year}_S{slot}"
            log.info(f"{'─'*55}")
            log.info(f"CAT {year}  Slot {slot}  [{paper_code}]")

            # Ensure paper document exists (insert only if new)
            now = datetime.now(timezone.utc)
            papers_col.update_one(
                {"paper_code": paper_code},
                {
                    "$setOnInsert": {
                        "paper_code":       paper_code,
                        "title":            f"CAT {year} \u2013 Slot {slot}",
                        "source_type":      "past_year_paper",
                        "year":             year,
                        "slot":             f"Slot {slot}",
                        "sections":         [],
                        "total_questions":  0,
                        "total_marks":      None,
                        "duration_minutes": 120,
                        "created_at":       now,
                        "updated_at":       now,
                    }
                },
                upsert=True,
            )
            paper    = papers_col.find_one({"paper_code": paper_code})
            paper_id = paper["_id"]

            scraped_sections = []

            for section_db in target_sections:
                # Try URL variants in order (handles older years with different slugs)
                html      = None
                used_url  = None
                for url_variant in SECTION_URL_VARIANTS[section_db]:
                    url = f"{BASE_URL}/CAT-{year}-Question-Paper-Slot-{slot}-{url_variant}/"
                    html, err = fetch(url)
                    if html:
                        used_url = url
                        break
                    log.debug(f"  [{section_db}] {url}  → {err}")

                if not html:
                    log.warning(f"  [{section_db}] No accessible URL found, skipping")
                    time.sleep(1)
                    continue

                log.info(f"  [{section_db}] {used_url}")
                questions = extract_questions(html, section_db, paper_id, paper_code, year, slot)

                # Stamp source URL on each question
                for q in questions:
                    q["source_url"] = used_url

                if not questions:
                    log.warning(f"  [{section_db}] No questions parsed — check page structure")
                    time.sleep(2)
                    continue

                inserted, modified = upsert_questions(qs_col, questions)
                grand_total += len(questions)
                log.info(
                    f"  [{section_db}] {len(questions):>3} questions  "
                    f"(new: {inserted}, updated: {modified})  "
                    f"MCQ: {sum(1 for q in questions if q['question_type']=='MCQ')}  "
                    f"TITA: {sum(1 for q in questions if q['question_type']=='TITA')}"
                )

                scraped_sections.append({
                    "section":          section_db,
                    "total_questions":  len(questions),
                    "mcq_count":        sum(1 for q in questions if q["question_type"] == "MCQ"),
                    "tita_count":       sum(1 for q in questions if q["question_type"] == "TITA"),
                    "time_limit_minutes": 40,
                })

                time.sleep(2)  # polite crawl delay

            # Update paper with collected section stats (idempotent — full replace)
            if scraped_sections:
                # Merge with any previously scraped sections for this paper
                existing = papers_col.find_one({"_id": paper_id}, {"sections": 1})
                existing_secs = {s["section"]: s for s in (existing.get("sections") or [])}
                for s in scraped_sections:
                    existing_secs[s["section"]] = s
                merged = list(existing_secs.values())
                total_q = sum(s["total_questions"] for s in merged)
                papers_col.update_one(
                    {"_id": paper_id},
                    {
                        "$set": {
                            "sections":        merged,
                            "total_questions": total_q,
                            "updated_at":      datetime.now(timezone.utc),
                        }
                    },
                )

    log.info(f"{'='*55}")
    log.info(f"Done.  Total questions inserted/updated: {grand_total}")
    client.close()


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape CAT past year papers into MongoDB")
    parser.add_argument("--year",    type=int,  help="Scrape only this year (e.g. 2023)")
    parser.add_argument("--slot",    type=int,  help="Scrape only this slot (1, 2, or 3)")
    parser.add_argument("--section", choices=["QA", "DILR", "VARC"], help="Scrape only this section")
    args = parser.parse_args()

    run(
        years    = [args.year]    if args.year    else None,
        slots    = [args.slot]    if args.slot    else None,
        sections = [args.section] if args.section else None,
    )
