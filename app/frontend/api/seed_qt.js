/* Seed the qt_questions collection (Quant Tests — CAT-style timed QA sectionals)
 * from chapter_questions/qt_test_*.json.
 *
 * Test 1 is Block VI (Permutations & Combinations, Probability, Set Theory), built
 * from verified CAT past-year questions:
 *   - Ch17 P&C          — all 13 patterns  (CAT 2017-2022)
 *   - Ch19 Set Theory   — all  7 patterns  (CAT 2018-2025)
 *   - Probability       — 10 questions; the 5 items the source flags as outside the
 *                         CAT syllabus (Bayes diagnostic, broken stick, factory
 *                         machines, binomial, meeting problem) are deliberately excluded.
 *
 * Unlike the DI seed there are no images to inline — every question is plain text
 * plus KaTeX math, rendered by MathText.
 *
 * Run:  node api/seed_qt.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const QDIR = path.join(__dirname, '..', 'chapter_questions');

// Fail loudly on content that would silently mis-score a candidate.
function validate(docs, file) {
  const errs = [];
  docs.forEach((d, i) => {
    const at = `${file}[${i}] ${d.question_code || '(no code)'}`;
    if (!d.question_text) errs.push(`${at}: missing question_text`);
    if (!d.correct_answer) errs.push(`${at}: missing correct_answer`);
    if (!d.pattern) errs.push(`${at}: missing pattern`);
    if (d.question_type === 'MCQ') {
      if (!Array.isArray(d.options) || d.options.length < 2) {
        errs.push(`${at}: MCQ needs options`);
      } else {
        const labels = d.options.map(o => o.label);
        if (new Set(labels).size !== labels.length) errs.push(`${at}: duplicate option labels`);
        if (!labels.includes(d.correct_answer)) errs.push(`${at}: correct_answer "${d.correct_answer}" is not an option label`);
        const texts = d.options.map(o => String(o.text).trim());
        if (new Set(texts).size !== texts.length) errs.push(`${at}: duplicate option text`);
      }
    } else if (d.question_type === 'TITA') {
      if (d.options && d.options.length) errs.push(`${at}: TITA must not carry options`);
      if (d.marks_incorrect !== 0) errs.push(`${at}: TITA must have marks_incorrect 0`);
      if (!/^-?[0-9.]+$/.test(String(d.correct_answer))) errs.push(`${at}: TITA answer "${d.correct_answer}" is not numeric`);
    } else {
      errs.push(`${at}: unknown question_type ${d.question_type}`);
    }
  });
  const nums = docs.map(d => d.question_number);
  if (new Set(nums).size !== nums.length) errs.push(`${file}: duplicate question_number`);
  return errs;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_STRING, { bufferCommands: false });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  const col = mongoose.connection.db.collection('qt_questions');
  const sessions = mongoose.connection.db.collection('qt_sessions');

  const files = fs.readdirSync(QDIR).filter(f => /^qt_test_\d+\.json$/.test(f)).sort();
  if (!files.length) { console.error('No qt_test_*.json found'); process.exit(1); }

  // Validate everything before touching the DB, so a bad file never half-seeds.
  const parsed = [];
  let allErrs = [];
  for (const file of files) {
    const docs = JSON.parse(fs.readFileSync(path.join(QDIR, file), 'utf8'));
    allErrs = allErrs.concat(validate(docs, file));
    parsed.push([file, docs]);
  }
  if (allErrs.length) {
    console.error(`\nRefusing to seed — ${allErrs.length} content error(s):`);
    allErrs.forEach(e => console.error('  ' + e));
    process.exit(1);
  }

  const del = await col.deleteMany({});
  console.log(`Deleted ${del.deletedCount} existing quant-test questions`);

  let total = 0;
  for (const [file, docs] of parsed) {
    const now = new Date();
    await col.insertMany(docs.map(d => ({ ...d, createdAt: now, updatedAt: now })), { ordered: false });
    total += docs.length;
    const byTopic = docs.reduce((a, d) => { a[d.topic] = (a[d.topic] || 0) + 1; return a; }, {});
    const tita = docs.filter(d => d.question_type === 'TITA').length;
    console.log(`${file}: inserted ${docs.length} (test ${docs[0].test}, ${docs[0].block})`);
    console.log(`  topics: ${Object.entries(byTopic).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    console.log(`  ${docs.length - tita} MCQ + ${tita} TITA · ${docs.reduce((a, d) => a + d.marks_correct, 0)} marks · ${new Set(docs.map(d => d.pattern)).size} distinct patterns`);
  }

  const cleared = await sessions.deleteMany({});
  console.log(`Cleared ${cleared.deletedCount} stale quant-test sessions`);
  console.log(`\nqt_questions total: ${total}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
