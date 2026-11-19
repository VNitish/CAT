/* Seed the GRE verbal bank (Manhattan 5 lb. Book: ch1 diagnostic, ch3 Text
 * Completions, ch4 Sentence Equivalence, ch5 Reading Comprehension, ch6
 * Logic-Based RC, ch32 Verbal Practice Sections) from
 * chapter_questions/gre_v_chNN[_partK].json into:
 *   - gre_verbal_chapters   one row per chapter
 *   - gre_verbal_questions  one row per question
 *   - gre_verbal_passages   reading passages shared by RC questions
 *
 * Question types:
 *   TC         Text Completion: blanks[] each with its own options; answer = one letter per blank
 *   SE         Sentence Equivalence: 6 options, answer = exactly 2 letters
 *   RC_MCQ     one answer of five
 *   RC_MULTI   "select all that apply" of three; answer = list of letters
 *   RC_SELECT  select-in-passage; answer = the exact sentence from the passage
 *
 * Text fields are Markdown rendered by MathText, so a literal dollar sign is \$.
 * Private study bank (copy of a commercial book): the JSON files are gitignored.
 * A chapter split into part files is replaced wholesale, so re-running is safe.
 *
 * Run:  node api/seed_gre_verbal.js
 */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const QDIR = path.join(__dirname, '..', 'chapter_questions');
const TYPES = ['TC', 'SE', 'RC_MCQ', 'RC_MULTI', 'RC_SELECT'];

function check(chNo, questions, passages) {
  const pids = new Set(passages.map(p => p.passage_id));
  const nums = questions.map(q => q.question_number).sort((a, b) => a - b);
  nums.forEach((n, i) => { if (n !== i + 1) throw new Error(`ch${chNo}: question numbers not 1..N (at ${n})`); });
  for (const q of questions) {
    const id = `ch${chNo} Q${q.question_number}`;
    const t = q.question_type;
    if (!TYPES.includes(t)) throw new Error(`${id}: bad type ${t}`);
    if (!q.solution_text) throw new Error(`${id}: no solution`);
    if (q.passage_id && !pids.has(q.passage_id)) throw new Error(`${id}: unknown passage ${q.passage_id}`);
    if (t.startsWith('RC') && !q.passage_id) throw new Error(`${id}: RC question without passage`);
    const a = q.correct_answer;
    if (t === 'TC') {
      if (!Array.isArray(q.blanks) || !q.blanks.length || !Array.isArray(a) || a.length !== q.blanks.length) throw new Error(`${id}: TC blanks/answer mismatch`);
      q.blanks.forEach((b, i) => { if (!(a[i] in b.options)) throw new Error(`${id}: blank ${i + 1} answer not an option`); });
    }
    if (t === 'SE' && !(Array.isArray(a) && a.length === 2 && a.every(x => x in q.options) && Object.keys(q.options).length === 6)) throw new Error(`${id}: SE needs 6 options and 2 answers`);
    if (t === 'RC_MCQ' && !(a in q.options)) throw new Error(`${id}: MCQ answer not an option`);
    if (t === 'RC_MULTI' && !(Array.isArray(a) && a.length && a.every(x => x in q.options))) throw new Error(`${id}: MULTI answer`);
    if (t === 'RC_SELECT') {
      const p = passages.find(x => x.passage_id === q.passage_id);
      if (typeof a !== 'string' || !p.text.replace(/\s+/g, ' ').includes(a.replace(/\s+/g, ' '))) throw new Error(`${id}: select-in-passage answer not found verbatim in passage`);
    }
  }
}

(async () => {
  const byCh = {};
  for (const f of fs.readdirSync(QDIR).filter(f => /^gre_v_ch\d+(_part\d+)?\.json$/.test(f)).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
    const c = byCh[d.chapter_no] || (byCh[d.chapter_no] = { meta: { chapter_no: d.chapter_no, chapter: d.chapter, book_page_start: d.book_page_start, book_page_answers: d.book_page_answers }, questions: [], passages: [] });
    c.questions.push(...d.questions);
    c.passages.push(...(d.passages || []));
  }
  const client = await MongoClient.connect(process.env.MONGODB_STRING);
  const db = client.db();
  const now = new Date();
  for (const [chNo, c] of Object.entries(byCh)) {
    const n = Number(chNo);
    check(n, c.questions, c.passages);
    await db.collection('gre_verbal_questions').deleteMany({ chapter_no: n });
    await db.collection('gre_verbal_passages').deleteMany({ chapter_no: n });
    await db.collection('gre_verbal_questions').insertMany(c.questions.map(q => ({ ...q, chapter_no: n, chapter: c.meta.chapter, source: 'Manhattan 5 lb GRE', createdAt: now, updatedAt: now })));
    if (c.passages.length) await db.collection('gre_verbal_passages').insertMany(c.passages.map(p => ({ ...p, chapter_no: n })));
    await db.collection('gre_verbal_chapters').updateOne({ chapter_no: n },
      { $set: { ...c.meta, question_count: c.questions.length, passage_count: c.passages.length, updatedAt: now } }, { upsert: true });
    console.log(`ch${n} ${c.meta.chapter}: ${c.questions.length} questions, ${c.passages.length} passages`);
  }
  await db.collection('gre_verbal_questions').createIndex({ chapter_no: 1, question_number: 1 }, { unique: true });
  await client.close();
})().catch(e => { console.error(e.message); process.exit(1); });
