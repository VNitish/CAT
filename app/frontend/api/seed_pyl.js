/* Seed the pyl_questions collection (CAT Past Year LRDI — complete real DILR
 * sections, DI and LR sets both included) from chapter_questions/pyl_test_*.json.
 *
 *   - Test 1: CAT 2022, Slot 1 — all 4 sets (20 Qs), 40-minute clock.
 *
 * Every question is verbatim from the real paper with the official answer key,
 * re-verified by solving each set from scratch; explanations are hand-written.
 * Diagrams are inlined into context_passage as base64 data-URIs (same approach as
 * the DI mocks) so they render on prod with no static-file dependency.
 *
 * The clock is fixed per test via duration_seconds on every question doc. It never
 * auto-submits: the exam page counts into negative "Overtime" and the candidate
 * submits when ready, so a session can run past the limit.
 *
 * Run:  node api/seed_pyl.js
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
    if (!Number.isInteger(d.duration_seconds) || d.duration_seconds <= 0) errs.push(`${at}: duration_seconds must be a positive integer`);
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
      if (!/^-?[0-9.]+$/.test(String(d.correct_answer))) errs.push(`${at}: TITA answer "${d.correct_answer}" is not numeric`);
    } else {
      errs.push(`${at}: unknown question_type ${d.question_type}`);
    }
  });
  const nums = docs.map(d => d.question_number);
  if (new Set(nums).size !== nums.length) errs.push(`${file}: duplicate question_number`);
  if (new Set(docs.map(d => d.duration_seconds)).size > 1) errs.push(`${file}: mixed duration_seconds`);
  // Any image reference must already be inlined; a bare path would 404 on prod.
  docs.forEach(d => { if (/\]\(\/[^)]+\.(png|jpe?g)\)/i.test(d.context_passage)) errs.push(`${file} ${d.question_code}: passage references a file path image, inline it as a data-URI`); });
  return errs;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_STRING, { bufferCommands: false });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  const col = mongoose.connection.db.collection('pyl_questions');
  const sessions = mongoose.connection.db.collection('pyl_sessions');

  const files = fs.readdirSync(QDIR).filter(f => /^pyl_test_\d+\.json$/.test(f)).sort();
  if (!files.length) { console.error('No pyl_test_*.json found'); process.exit(1); }

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
  console.log(`Deleted ${del.deletedCount} existing past-year LRDI questions`);

  let total = 0;
  for (const [file, docs] of parsed) {
    const now = new Date();
    await col.insertMany(docs.map(d => ({ ...d, createdAt: now, updatedAt: now })), { ordered: false });
    total += docs.length;
    const bySet = new Set(docs.map(d => d.set_id)).size;
    const tita = docs.filter(d => d.question_type === 'TITA').length;
    const imgs = docs.filter(d => /data:image/.test(d.context_passage)).length;
    console.log(`${file}: inserted ${docs.length} (test ${docs[0].test}, ${docs[0].label})`);
    console.log(`  ${bySet} sets · ${docs.length - tita} MCQ + ${tita} TITA · ${docs.reduce((a, d) => a + d.marks_correct, 0)} marks · ${docs[0].duration_seconds / 60} min · ${imgs} question(s) carry an inlined diagram`);
  }

  const cleared = await sessions.deleteMany({});
  console.log(`Cleared ${cleared.deletedCount} stale past-year LRDI sessions`);
  console.log(`\npyl_questions total: ${total}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
