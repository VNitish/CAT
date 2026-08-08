/* Seed the Quant Revision content (revision_chapters + revision_questions).
 * Each chapter is a formula overview (a grid of cards) plus a short set of the
 * questions that most often catch people out. Content in
 * chapter_questions/revision_content.json.
 *
 * Re-runnable: chapters and questions are wiped and rebuilt, user attempts in
 * revision_attempts are left alone (they key off question _id, so a reseed
 * orphans them — pass --reset-attempts to clear those too).
 *
 * Run:  node api/seed_revision.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SOURCE = 'Arun Sharma QA 8e';

(async () => {
  await mongoose.connect(process.env.MONGODB_STRING, { bufferCommands: false });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  const db = mongoose.connection.db;
  const chaptersCol = db.collection('revision_chapters');
  const qCol        = db.collection('revision_questions');

  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'chapter_questions', 'revision_content.json'), 'utf8')
  );

  const now = new Date();
  const delC = await chaptersCol.deleteMany({});
  const delQ = await qCol.deleteMany({});
  console.log(`Deleted ${delC.deletedCount} chapters, ${delQ.deletedCount} questions`);

  if (process.argv.includes('--reset-attempts')) {
    const delA = await db.collection('revision_attempts').deleteMany({});
    console.log(`Deleted ${delA.deletedCount} attempts`);
  }

  const chapterDocs = data.chapters.map(c => ({
    status: 'coming_soon',
    tagline: '', intro: '', flagged_note: '',
    hero_image: '', thumb_image: '',
    overview_cards: [],
    formula_sheet: { hero: { label: '', value: '' }, items: [] },
    ...c,
    source: c.source || SOURCE,
    createdAt: now, updatedAt: now,
  }));
  if (chapterDocs.length) await chaptersCol.insertMany(chapterDocs);
  await chaptersCol.createIndex({ slug: 1 }, { unique: true });

  const qDocs = (data.questions || []).map(q => ({
    tag: '', difficulty: 'Moderate', figure: '', concept: '', answer_display: '', solution: '',
    ...q,
    correct_answer: String(q.correct_answer || '').toLowerCase().trim(),
    source: q.source || SOURCE,
    createdAt: now, updatedAt: now,
  }));
  if (qDocs.length) await qCol.insertMany(qDocs);
  await qCol.createIndex({ chapter_slug: 1, order: 1 });

  // Sanity: every question points at a real chapter, and every correct_answer
  // matches one of that question's option labels.
  const slugs = new Set(chapterDocs.map(c => c.slug));
  const problems = [];
  qDocs.forEach(q => {
    if (!slugs.has(q.chapter_slug)) problems.push(`${q.chapter_slug}#${q.order}: unknown chapter_slug`);
    const labels = (q.options || []).map(o => o.label);
    if (!labels.includes(q.correct_answer)) {
      problems.push(`${q.chapter_slug}#${q.order}: correct_answer "${q.correct_answer}" not in [${labels}]`);
    }
  });

  const byChapter = {};
  qDocs.forEach(q => { byChapter[q.chapter_slug] = (byChapter[q.chapter_slug] || 0) + 1; });
  const ready = chapterDocs.filter(c => c.status === 'ready').length;
  console.log(`Inserted ${chapterDocs.length} chapters (${ready} ready), ${qDocs.length} questions`);
  console.log('per chapter:', byChapter);
  if (problems.length) console.error('PROBLEMS:\n  ' + problems.join('\n  '));

  await mongoose.disconnect();
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
