/* Seed the rc_questions collection from the extracted JSON files.
 * Source: Nishit Sinha VA-RC for the CAT (Pearson 2017), "Reading Comprehension
 * A Day" chapter — 40 passages grouped 4 per test => 10 tests (173 questions).
 * Correct answers from the printed answer key; explanations from the book's
 * "Hints and explanations" section where present (passages 3, 5, 6, 19).
 * Run:  node api/seed_rc.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const QDIR = path.join(__dirname, '..', 'chapter_questions');
const SOURCE = 'Nishit Sinha VA-RC (Pearson 2017)';
const TESTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function loadTest(tn) {
  const file = path.join(QDIR, `rc_test_${tn}.json`);
  const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
  return arr.map(q => ({ ...q, source: q.source || SOURCE }));
}

(async () => {
  await mongoose.connect(process.env.MONGODB_STRING, { bufferCommands: false });
  const col = mongoose.connection.db.collection('rc_questions');
  const sessions = mongoose.connection.db.collection('rc_sessions');

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
  console.log(`Cleared ${cleared.deletedCount} stale RC sessions`);

  const total = await col.countDocuments({ source: SOURCE });
  console.log(`rc_questions total for source: ${total} (expected 173)`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
