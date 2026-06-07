/* Seed the varc_questions collection from the extracted JSON files.
 * Source: Nishit Sinha VA-RC for the CAT (Pearson 2017), Section Tests 1-3,
 * extracted from the book PDF and lightly cleaned. Correct answers taken from
 * each test's printed answer key.
 * Run:  node api/seed_varc.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const QDIR = path.join(__dirname, '..', 'chapter_questions');
const SOURCE = 'Nishit Sinha VA-RC (Pearson 2017)';

function loadTest(tn) {
  const file = path.join(QDIR, `varc_test_${tn}.json`);
  const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (arr.length !== 34) {
    console.warn(`  WARN: varc_test_${tn}.json has ${arr.length} questions (expected 34)`);
  }
  return arr.map(q => ({ ...q, source: q.source || SOURCE }));
}

(async () => {
  await mongoose.connect(process.env.MONGODB_STRING, { bufferCommands: false });
  const col = mongoose.connection.db.collection('varc_questions');
  const sessions = mongoose.connection.db.collection('varc_sessions');

  let totalInserted = 0;
  for (const tn of [1, 2, 3]) {
    const docs = loadTest(tn);
    const del = await col.deleteMany({ source: SOURCE, test: tn });
    const now = new Date();
    const ins = await col.insertMany(docs.map(d => ({ ...d, createdAt: now, updatedAt: now })));
    totalInserted += ins.insertedCount;
    console.log(`Test ${tn}: deleted ${del.deletedCount}, inserted ${ins.insertedCount}`);
  }

  // Reset any sessions referencing the re-seeded questions (ids change on reseed)
  const cleared = await sessions.deleteMany({});
  console.log(`Cleared ${cleared.deletedCount} stale VARC sessions`);

  const total = await col.countDocuments({ source: SOURCE });
  console.log(`varc_questions total for source: ${total} (expected 102)`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
