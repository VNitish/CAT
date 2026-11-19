/* Seed the GRE quant bank (Manhattan 5 lb. Book, chapters 7-30) from
 * chapter_questions/gre_ch*.json into three collections:
 *   - gre_quant_chapters   one row per chapter
 *   - gre_quant_questions  one row per question (QC / MCQ / MULTI / NUMERIC / FRACTION)
 *   - gre_quant_sets       shared charts/setups (Data Interpretation etc.)
 *
 * QC questions store no options: the four choices are fixed by the GRE.
 * Each chapter is replaced wholesale, so re-running is safe.
 *
 * Run:  node api/seed_gre_quant.js
 */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const QDIR = path.join(__dirname, '..', 'chapter_questions');
const TYPES = ['QC', 'MCQ', 'MULTI', 'NUMERIC', 'FRACTION'];

function check(ch) {
  for (const q of ch.questions) {
    const id = `ch${ch.chapter_no} Q${q.question_number}`;
    if (!TYPES.includes(q.question_type)) throw new Error(`${id}: bad type ${q.question_type}`);
    if (q.question_type === 'QC' && !'abcd'.includes(q.correct_answer)) throw new Error(`${id}: QC answer`);
    if (q.question_type === 'MCQ' && !(q.correct_answer in q.options)) throw new Error(`${id}: MCQ answer`);
    if (q.question_type === 'MULTI' && !q.correct_answer.every(a => a in q.options)) throw new Error(`${id}: MULTI answer`);
    if (!q.solution_latex) throw new Error(`${id}: no solution`);
  }
}

(async () => {
  const files = fs.readdirSync(QDIR).filter(f => /^gre_ch\d+\.json$/.test(f)).sort();
  const client = await MongoClient.connect(process.env.MONGODB_STRING);
  const db = client.db();
  const now = new Date();
  for (const f of files) {
    const ch = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
    check(ch);
    const { questions, sets = [], ...meta } = ch;
    await db.collection('gre_quant_questions').deleteMany({ chapter_no: ch.chapter_no });
    await db.collection('gre_quant_sets').deleteMany({ chapter_no: ch.chapter_no });
    await db.collection('gre_quant_questions').insertMany(questions.map(q => ({ ...q, createdAt: now, updatedAt: now })));
    if (sets.length) await db.collection('gre_quant_sets').insertMany(sets.map(s => ({ ...s, chapter_no: ch.chapter_no })));
    await db.collection('gre_quant_chapters').updateOne(
      { chapter_no: ch.chapter_no },
      { $set: { ...meta, question_count: questions.length, updatedAt: now } },
      { upsert: true });
    console.log(`ch${ch.chapter_no} ${ch.chapter}: ${questions.length} questions, ${sets.length} sets`);
  }
  await db.collection('gre_quant_questions').createIndex({ chapter_no: 1, question_number: 1 }, { unique: true });
  await client.close();
})().catch(e => { console.error(e.message); process.exit(1); });
