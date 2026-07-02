/* Seed the asrc_questions collection from the extracted JSON files.
 * Source: Arun Sharma VA-RC for the CAT (McGraw Hill), "Latest Pattern
 * Comprehension Passages for the CAT" (LOD II) — 7 tests, 3 passages each
 * (72 questions). Correct answers from the printed answer key; explanations
 * from the book's Solutions section where present.
 * Run:  node api/seed_asrc.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const QDIR = path.join(__dirname, '..', 'chapter_questions');
const SOURCE = 'Arun Sharma VA-RC (McGraw Hill) — Latest Pattern Comprehension Passages';
const TESTS = [1, 2, 3, 4, 5, 6, 7];

function loadTest(tn) {
  const file = path.join(QDIR, `asrc_test_${tn}.json`);
  const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
  return arr.map(q => ({ ...q, source: q.source || SOURCE }));
}

(async () => {
  await mongoose.connect(process.env.MONGODB_STRING, { bufferCommands: false });
  const col = mongoose.connection.db.collection('asrc_questions');
  const sessions = mongoose.connection.db.collection('asrc_sessions');

  let totalInserted = 0;
  for (const tn of TESTS) {
    const docs = loadTest(tn);
    const del = await col.deleteMany({ source: SOURCE, test: tn });
    const now = new Date();
    const ins = await col.insertMany(docs.map(d => ({ ...d, createdAt: now, updatedAt: now })));
    totalInserted += ins.insertedCount;
    console.log(`Test ${tn}: deleted ${del.deletedCount}, inserted ${ins.insertedCount}`);
  }

  // Reset any sessions referencing the re-seeded questions (ids change on reseed)
  const cleared = await sessions.deleteMany({});
  console.log(`Cleared ${cleared.deletedCount} stale Arun Sharma VARC sessions`);

  const total = await col.countDocuments({ source: SOURCE });
  console.log(`asrc_questions total for source: ${total} (expected 72)`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
