# MongoDB Schema Design — CAT Question Bank

## Overview

Two collections:
- **`question_papers`** — metadata about the source a question came from
- **`questions`** — the actual question content, referencing a paper

---

## Collection 1: `question_papers`

Tracks where a question originated. Three source types are supported:
`past_year_paper` | `mock_paper` | `question_bank`

### Schema

```json
{
  "_id": ObjectId,
  "paper_code": "CAT_2023_S1",
  "title": "CAT 2023 – Slot 1",
  "source_type": "past_year_paper",

  // ── Only for source_type: "past_year_paper" ──────────────────
  "year": 2023,
  "slot": "Slot 1",            // "Slot 1" | "Slot 2" | "Slot 3"

  // ── Only for source_type: "mock_paper" ──────────────────────
  "series": "IMS SimCAT",      // e.g. "TIME Mock", "CL AIMCAT"
  "mock_number": 5,

  // ── Only for source_type: "question_bank" ───────────────────
  "bank_topic": "Arithmetic",  // broad subject area of the bank
  "bank_category": "Topic-wise", // "Topic-wise" | "Difficulty-wise"

  // ── Common fields ────────────────────────────────────────────
  "sections": [
    {
      "section": "VARC",
      "total_questions": 24,
      "mcq_count": 21,
      "tita_count": 3,
      "time_limit_minutes": 40
    },
    {
      "section": "DILR",
      "total_questions": 20,
      "mcq_count": 16,
      "tita_count": 4,
      "time_limit_minutes": 40
    },
    {
      "section": "QA",
      "total_questions": 22,
      "mcq_count": 14,
      "tita_count": 8,
      "time_limit_minutes": 40
    }
  ],
  "total_questions": 66,
  "total_marks": 198,
  "duration_minutes": 120,
  "created_at": ISODate,
  "updated_at": ISODate
}
```

### Sample Documents

**Past Year Paper**
```json
{
  "_id": ObjectId("..."),
  "paper_code": "CAT_2023_S2",
  "title": "CAT 2023 – Slot 2",
  "source_type": "past_year_paper",
  "year": 2023,
  "slot": "Slot 2",
  "sections": [ ... ],
  "total_questions": 66,
  "total_marks": 198,
  "duration_minutes": 120,
  "created_at": ISODate("2024-01-01"),
  "updated_at": ISODate("2024-01-01")
}
```

**Mock Paper**
```json
{
  "_id": ObjectId("..."),
  "paper_code": "SIMCAT_2024_07",
  "title": "IMS SimCAT 7 – 2024",
  "source_type": "mock_paper",
  "series": "IMS SimCAT",
  "mock_number": 7,
  "sections": [ ... ],
  "total_questions": 66,
  "total_marks": 198,
  "duration_minutes": 120,
  "created_at": ISODate("2024-06-15"),
  "updated_at": ISODate("2024-06-15")
}
```

**Question Bank**
```json
{
  "_id": ObjectId("..."),
  "paper_code": "QB_QA_ARITHMETIC",
  "title": "QA Arithmetic Question Bank",
  "source_type": "question_bank",
  "bank_topic": "Arithmetic",
  "bank_category": "Topic-wise",
  "sections": [
    {
      "section": "QA",
      "total_questions": 150,
      "mcq_count": 100,
      "tita_count": 50,
      "time_limit_minutes": null
    }
  ],
  "total_questions": 150,
  "total_marks": null,
  "duration_minutes": null,
  "created_at": ISODate("2024-03-01"),
  "updated_at": ISODate("2024-03-01")
}
```

---

## Collection 2: `questions`

Stores every question. References `question_papers` via `paper_id`.

### Key Design Decisions

- **Set-based questions** (RC passages, DI/LR sets): Questions in the same set share a `set_id` (a string like `"SET_CAT2023_S1_VARC_01"`). The common passage/data is stored in `context_passage` on every question in the set (denormalized for fast reads).
- **TITA questions**: `options` is `null`; `marks_incorrect` is `0` (no negative marking).
- **MCQ questions**: 4 options labeled A–D; `marks_incorrect` is `-1`.

### Schema

```json
{
  "_id": ObjectId,
  "question_code": "CAT_2023_S1_VARC_Q03",
  "paper_id": ObjectId,       // → question_papers._id

  // ── Classification ───────────────────────────────────────────
  "section": "VARC",          // "VARC" | "DILR" | "QA"
  "question_type": "MCQ",     // "MCQ" | "TITA"

  "topic": "Reading Comprehension",
  // VARC topics   : "Reading Comprehension" | "Para Jumbles" |
  //                 "Para Summary" | "Odd Sentence Out" | "Sentence Completion"
  // DILR topics   : "Data Interpretation" | "Logical Reasoning"
  // QA topics     : "Arithmetic" | "Algebra" | "Geometry" |
  //                 "Number System" | "Modern Math"

  "subtopic": "Inference",
  // RC subtopics  : "Main Idea" | "Inference" | "Tone" | "Vocab in Context" | "Fact/Opinion"
  // DI subtopics  : "Bar Chart" | "Pie Chart" | "Line Graph" | "Table" | "Caselet"
  // LR subtopics  : "Arrangement" | "Routes & Networks" | "Teams & Scheduling" |
  //                 "Games & Tournaments"
  // QA subtopics  : "Profit & Loss" | "Time-Speed-Distance" | "Percentages" |
  //                 "Ratio & Proportion" | "Simple & Compound Interest" |
  //                 "Time & Work" | "Quadratic Equations" | "Progressions" |
  //                 "Functions" | "Triangles" | "Circles" | "Coordinate Geometry" |
  //                 "Mensuration" | "Divisibility" | "HCF & LCM" |
  //                 "Permutation & Combination" | "Probability" | "Set Theory"

  // ── Set grouping (for RC, DI, LR sets) ──────────────────────
  "set_id": "SET_CAT2023_S1_VARC_01",  // null if standalone question
  "set_position": 2,                    // question number within this set (1-indexed)
  "context_passage": "Anil Kumar Gupta was travelling...",
  // The shared RC passage or DI/LR data table — stored on every
  // question in the set. null for standalone questions.

  // ── Question content ─────────────────────────────────────────
  "question_text": "Which of the following best describes the author's attitude?",
  "options": [
    { "label": "A", "text": "Optimistic and encouraging" },
    { "label": "B", "text": "Critical and dismissive" },
    { "label": "C", "text": "Neutral and analytical" },
    { "label": "D", "text": "Pessimistic and resigned" }
  ],
  // null for TITA questions

  // ── Answer & scoring ─────────────────────────────────────────
  "correct_answer": "C",     // option label for MCQ; numeric string for TITA
  "marks_correct": 3,
  "marks_incorrect": -1,     // -1 for MCQ | 0 for TITA (no negative marking)
  "explanation": "The author consistently presents facts without bias...",

  // ── Metadata ─────────────────────────────────────────────────
  "difficulty": "Medium",    // "Easy" | "Medium" | "Hard"
  "question_number": 7,      // position of this question in the paper/section
  "tags": ["inference", "attitude", "tone"],
  "is_image_based": false,   // true if question/options contain an image
  "image_url": null,         // URL/path to image if is_image_based is true

  "created_at": ISODate,
  "updated_at": ISODate
}
```

### Sample Documents

**MCQ — RC (set-based)**
```json
{
  "_id": ObjectId("..."),
  "question_code": "CAT_2023_S1_VARC_Q03",
  "paper_id": ObjectId("..."),
  "section": "VARC",
  "question_type": "MCQ",
  "topic": "Reading Comprehension",
  "subtopic": "Inference",
  "set_id": "SET_CAT2023_S1_VARC_01",
  "set_position": 3,
  "context_passage": "Anil Kumar Gupta was travelling through the dense forests...",
  "question_text": "Which of the following best describes the author's attitude towards modernisation?",
  "options": [
    { "label": "A", "text": "Enthusiastically supportive" },
    { "label": "B", "text": "Cautiously optimistic" },
    { "label": "C", "text": "Deeply sceptical" },
    { "label": "D", "text": "Completely indifferent" }
  ],
  "correct_answer": "B",
  "marks_correct": 3,
  "marks_incorrect": -1,
  "explanation": "The author acknowledges benefits while warning about risks...",
  "difficulty": "Medium",
  "question_number": 3,
  "tags": ["inference", "author's tone"],
  "is_image_based": false,
  "image_url": null,
  "created_at": ISODate("2024-01-01"),
  "updated_at": ISODate("2024-01-01")
}
```

**TITA — QA (standalone)**
```json
{
  "_id": ObjectId("..."),
  "question_code": "CAT_2023_S1_QA_Q18",
  "paper_id": ObjectId("..."),
  "section": "QA",
  "question_type": "TITA",
  "topic": "Arithmetic",
  "subtopic": "Time-Speed-Distance",
  "set_id": null,
  "set_position": null,
  "context_passage": null,
  "question_text": "A train 200m long crosses a platform 300m long in 25 seconds. Find the speed of the train in km/h.",
  "options": null,
  "correct_answer": "72",
  "marks_correct": 3,
  "marks_incorrect": 0,
  "explanation": "Total distance = 200 + 300 = 500m. Speed = 500/25 = 20 m/s = 72 km/h.",
  "difficulty": "Easy",
  "question_number": 18,
  "tags": ["train", "speed", "platform"],
  "is_image_based": false,
  "image_url": null,
  "created_at": ISODate("2024-01-01"),
  "updated_at": ISODate("2024-01-01")
}
```

**MCQ — DILR (set-based, with data table in passage)**
```json
{
  "_id": ObjectId("..."),
  "question_code": "CAT_2023_S1_DILR_Q09",
  "paper_id": ObjectId("..."),
  "section": "DILR",
  "question_type": "MCQ",
  "topic": "Data Interpretation",
  "subtopic": "Table",
  "set_id": "SET_CAT2023_S1_DILR_02",
  "set_position": 1,
  "context_passage": "The following table shows the sales (in units) of 5 products across 4 quarters...\n| Product | Q1 | Q2 | Q3 | Q4 |\n|---------|----|----|----|----|...",
  "question_text": "In which quarter was the total sales across all products the highest?",
  "options": [
    { "label": "A", "text": "Q1" },
    { "label": "B", "text": "Q2" },
    { "label": "C", "text": "Q3" },
    { "label": "D", "text": "Q4" }
  ],
  "correct_answer": "C",
  "marks_correct": 3,
  "marks_incorrect": -1,
  "explanation": "Sum of all products in Q3 = 1240, which is the highest.",
  "difficulty": "Easy",
  "question_number": 9,
  "tags": ["table", "comparison", "totals"],
  "is_image_based": false,
  "image_url": null,
  "created_at": ISODate("2024-01-01"),
  "updated_at": ISODate("2024-01-01")
}
```

---

## Indexes

```js
// question_papers
db.question_papers.createIndex({ paper_code: 1 }, { unique: true });
db.question_papers.createIndex({ source_type: 1, year: -1 });

// questions
db.questions.createIndex({ question_code: 1 }, { unique: true });
db.questions.createIndex({ paper_id: 1 });
db.questions.createIndex({ paper_id: 1, section: 1, question_number: 1 });
db.questions.createIndex({ set_id: 1 });
db.questions.createIndex({ section: 1, topic: 1, difficulty: 1 });
db.questions.createIndex({ tags: 1 });
```

---

## Relationship Diagram

```
question_papers                    questions
───────────────                    ─────────────────────────
_id  ◄────────────────────────── paper_id
paper_code                         question_code
source_type                        section
  past_year_paper                  question_type (MCQ/TITA)
  mock_paper                       topic / subtopic
  question_bank                    set_id  ─── (groups questions in same RC/DI/LR set)
year / slot                        context_passage
series / mock_number               question_text
bank_topic                         options (null for TITA)
sections[]                         correct_answer
total_questions                    marks_correct / marks_incorrect
                                   difficulty
                                   tags[]
```
