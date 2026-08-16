/* Seed the LR Topics content (dilr_topics + dilr_sets).
 * Unlike LR Practice Sets (lrp_*, a generic reasoning-book taxonomy), every topic
 * and pattern here was derived empirically: all 116 real CAT DILR sets from
 * 2017-2025 were read and classified, and this is the topic list that actually
 * emerged from that read, with a curated subset of real sets per topic chosen so
 * every distinct pattern within it is covered. Every question is a verbatim CAT
 * past-year question with an official correct_answer; explanations are hand-written,
 * re-derived and checked against that official answer (not assumed from it).
 * Content in chapter_questions/dilr_content.json.
 * Run:  node api/seed_dilr.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function validate(data) {
  const errs = [];
  const topicSlugs = new Set((data.topics || []).map(t => t.slug));
  (data.topics || []).forEach((t, i) => {
    if (!t.slug) errs.push(`topics[${i}]: missing slug`);
    if (!t.name) errs.push(`topics[${i}]: missing name`);
  });
  (data.sets || []).forEach((s, i) => {
    const at = `sets[${i}] ${s.set_slug || '(no slug)'}`;
    if (!s.set_slug) errs.push(`${at}: missing set_slug`);
    if (!s.topic_slug || !topicSlugs.has(s.topic_slug)) errs.push(`${at}: topic_slug "${s.topic_slug}" not in topics list`);
    if (!s.setup || !s.setup.trim()) errs.push(`${at}: missing setup/passage`);
    if (!Array.isArray(s.questions) || s.questions.length === 0) errs.push(`${at}: no questions`);
    (s.questions || []).forEach((q, qi) => {
      const qat = `${at} Q${qi + 1}`;
      if (!q.q_slug) errs.push(`${qat}: missing q_slug`);
      if (!q.question_text) errs.push(`${qat}: missing question_text`);
      if (!q.correct_answer) errs.push(`${qat}: missing correct_answer`);
      if (!q.solution_steps || !q.solution_steps.length) errs.push(`${qat}: missing solution_steps`);
      if (q.answer_format === 'option') {
        const labels = (q.options || []).map(o => o.label);
        if (!labels.length) errs.push(`${qat}: option format needs options`);
        if (!labels.includes(q.correct_answer)) errs.push(`${qat}: correct_answer "${q.correct_answer}" not an option label`);
      }
    });
  });
  const setSlugs = (data.sets || []).map(s => s.set_slug);
  if (new Set(setSlugs).size !== setSlugs.length) errs.push('duplicate set_slug across sets');
  return errs;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_STRING, { bufferCommands: false });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  const db = mongoose.connection.db;
  const topicsCol = db.collection('dilr_topics');
  const setsCol   = db.collection('dilr_sets');

  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'chapter_questions', 'dilr_content.json'), 'utf8')
  );

  const errs = validate(data);
  if (errs.length) {
    console.error(`\nRefusing to seed — ${errs.length} content error(s):`);
    errs.forEach(e => console.error('  ' + e));
    process.exit(1);
  }

  const now = new Date();
  const delT = await topicsCol.deleteMany({});
  const delS = await setsCol.deleteMany({});
  console.log(`Deleted ${delT.deletedCount} topics, ${delS.deletedCount} sets`);

  const topicDocs = data.topics.map(t => ({ ...t, createdAt: now, updatedAt: now }));
  if (topicDocs.length) await topicsCol.insertMany(topicDocs);

  const setDocs = data.sets.map(s => ({ ...s, createdAt: now, updatedAt: now }));
  if (setDocs.length) await setsCol.insertMany(setDocs);

  const byTopic = {};
  setDocs.forEach(s => {
    byTopic[s.topic_slug] = byTopic[s.topic_slug] || { sets: 0, q: 0 };
    byTopic[s.topic_slug].sets += 1;
    byTopic[s.topic_slug].q += (s.questions || []).length;
  });
  console.log(`Inserted ${topicDocs.length} topics, ${setDocs.length} sets`);
  console.log('per topic:', byTopic);

  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
