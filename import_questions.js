/**
 * Import questions_raw.json → MongoDB
 * Run: node import_questions.js
 *
 * Filters out obvious extraction garbage before inserting.
 * Sets verified: false on all — review via /admin/questions later.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

// ── Schema ───────────────────────────────────────────────────────────────────
const QuestionSchema = new mongoose.Schema({
  source:          { type: String, default: 'Arun Sharma QA 8e' },
  chapter_id:      { type: Number, required: true },
  topic:           { type: String, required: true },
  block:           { type: String },
  lod:             { type: Number, enum: [1, 2, 3], required: true },
  difficulty:      { type: String, enum: ['Easy', 'Medium', 'Hard'] },
  question_number: { type: Number },
  directions:      { type: String, default: '' },
  question:        { type: String, required: true },
  question_type:   { type: String, enum: ['MCQ', 'TITA'], default: 'MCQ' },
  options: {
    a: String,
    b: String,
    c: String,
    d: String,
  },
  correct_answer:  { type: String },   // 'a'/'b'/'c'/'d' or numeric string
  solution:        { type: String, default: '' },
  tags:            [String],
  verified:        { type: Boolean, default: false },
}, { timestamps: true });

const TopicQuestion = mongoose.model('TopicQuestion', QuestionSchema, 'topic_questions');

// ── Quality filters ──────────────────────────────────────────────────────────
function isGarbage(q) {
  const text = q.question || '';

  // Too short to be a real question
  if (text.length < 20) return true;

  // Looks like a solution/explanation bleed-in
  if (/^(you can|thus,|hence,|therefore,|solution:|since|note:|the answer|it is given)/i.test(text)) return true;

  // Looks like a page header or book navigation text
  if (/how to prepare for quantitative aptitude/i.test(text)) return true;
  if (/level of diff/i.test(text)) return true;
  if (/answer key/i.test(text)) return true;
  if (/back to school/i.test(text)) return true;

  // Option text bled into question field
  if (/^\([a-d]\)\s+\S/.test(text)) return true;

  // Gibberish / encoded chars dominating
  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
  if (nonAscii / text.length > 0.2) return true;

  // Very long question that is clearly multiple things merged
  if (text.length > 1200) return true;

  return false;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const MONGO_URI = process.env.MONGODB_STRING || 'mongodb://localhost:27017/cat';

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const raw = JSON.parse(fs.readFileSync('questions_raw.json', 'utf8'));
  console.log(`Loaded ${raw.length} raw questions`);

  // Filter
  const clean = raw.filter(q => !isGarbage(q));
  console.log(`After filtering: ${clean.length} questions (removed ${raw.length - clean.length} garbage)`);

  // Drop existing topic_questions collection before re-import
  await mongoose.connection.collection('topic_questions').drop().catch(() => {});
  console.log('Dropped existing topic_questions collection (if any)');

  // Insert in batches
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < clean.length; i += BATCH) {
    const batch = clean.slice(i, i + BATCH).map(q => ({
      source:          q.source,
      chapter_id:      q.chapter_id,
      topic:           q.topic,
      block:           q.block,
      lod:             q.lod,
      difficulty:      q.difficulty,
      question_number: q.question_number,
      directions:      q.directions || '',
      question:        q.question,
      question_type:   q.question_type,
      options:         q.options || {},
      correct_answer:  q.correct_answer || '',
      solution:        '',
      tags:            q.tags || [q.topic],
      verified:        false,
    }));
    await TopicQuestion.insertMany(batch);
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${clean.length}...`);
  }
  console.log(`\nDone. ${inserted} questions in MongoDB collection 'topic_questions'.`);

  // Summary by topic
  const summary = await TopicQuestion.aggregate([
    { $group: { _id: { topic: '$topic', lod: '$lod' }, count: { $sum: 1 } } },
    { $sort: { '_id.topic': 1, '_id.lod': 1 } },
  ]);
  console.log('\n── Summary ─────────────────────────────────────────────────');
  let curTopic = '';
  for (const row of summary) {
    if (row._id.topic !== curTopic) {
      curTopic = row._id.topic;
      process.stdout.write(`\n  ${curTopic}`);
    }
    process.stdout.write(`  L${row._id.lod}:${row.count}`);
  }
  console.log('\n');

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
