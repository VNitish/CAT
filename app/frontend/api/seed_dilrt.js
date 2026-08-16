/* Seed the dilrt_questions collection (LR Sample Tests — full timed real-CAT DILR
 * sectionals) from chapter_questions/dilrt_test_*.json.
 *
 * Each test is one real CAT slot's DILR section with any Data-Interpretation set
 * from that slot deliberately excluded, so the mock is pure logical reasoning:
 *   - Test 1: CAT 2023, Slot 1 (all 4 real DILR sets — this slot was 100% LR already)
 *   - Test 2: CAT 2021, Slot 3 (3 of its 4 real DILR sets — 1 DI set excluded)
 *
 * Every question is verbatim from the real paper with the DB's official
 * correct_answer; explanations are hand-written and checked against that answer.
 *
 * Run:  node api/seed_dilrt.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const QDIR = path.join(__dirname, '..', 'chapter_questions');

function validate(docs, file) {
  const errs = [];
  docs.forEach((d, i) => {
    const at = `${file}[${i}] ${d.question_code || '(no code)'}`;
    if (!d.question_text) errs.push(`${at}: missing question_text`);
    if (!d.correct_answer) errs.push(`${at}: missing correct_answer`);
    if (!d.set_id) errs.push(`${at}: missing set_id`);
    if (!d.context_passage) errs.push(`${at}: missing context_passage`);
    if (!d.explanation || !String(d.explanation).trim()) errs.push(`${at}: missing explanation`);
    if (d.question_type === 'MCQ') {
      if (!Array.isArray(d.options) || d.options.length < 2) {
        errs.push(`${at}: MCQ needs options`);
      } else {
        const labels = d.options.map(o => o.label);
        if (new Set(labels).size !== labels.length) errs.push(`${at}: duplicate option labels`);
        if (!labels.includes(d.correct_answer)) errs.push(`${at}: correct_answer "${d.correct_answer}" is not an option label`);
      }
    } else if (d.question_type === 'TITA') {
      if (d.options && d.options.length) errs.push(`${at}: TITA must not carry options`);
      if (d.marks_incorrect !== 0) errs.push(`${at}: TITA must have marks_incorrect 0`);
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
  const col = mongoose.connection.db.collection('dilrt_questions');
  const sessions = mongoose.connection.db.collection('dilrt_sessions');

  const files = fs.readdirSync(QDIR).filter(f => /^dilrt_test_\d+\.json$/.test(f)).sort();
  if (!files.length) { console.error('No dilrt_test_*.json found'); process.exit(1); }

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
  console.log(`Deleted ${del.deletedCount} existing LR sample-test questions`);

  let total = 0;
  for (const [file, docs] of parsed) {
    const now = new Date();
    await col.insertMany(docs.map(d => ({ ...d, createdAt: now, updatedAt: now })), { ordered: false });
    total += docs.length;
    const bySet = new Set(docs.map(d => d.set_id)).size;
    const tita = docs.filter(d => d.question_type === 'TITA').length;
    console.log(`${file}: inserted ${docs.length} (test ${docs[0].test}, ${docs[0].label})`);
    console.log(`  ${bySet} sets · ${docs.length - tita} MCQ + ${tita} TITA · ${docs.reduce((a, d) => a + d.marks_correct, 0)} marks`);
  }

  const cleared = await sessions.deleteMany({});
  console.log(`Cleared ${cleared.deletedCount} stale LR sample-test sessions`);
  console.log(`\ndilrt_questions total: ${total}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
