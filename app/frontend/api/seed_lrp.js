/* Seed the LR Practice Sets content (lrp_topics + lrp_sets).
 * Source: Nishit Sinha LRDI (Pearson, 6e), Part 1, Ch14 (Moderate) + Ch15 (Advanced)
 * plus topic-chapter practice exercises. Per topic, a curated set of caselets chosen so
 * every distinct pattern in that topic is covered. Answers/solutions verified by hand.
 * Content in chapter_questions/lrp_content.json.
 * Run:  node api/seed_lrp.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SOURCE = 'Nishit Sinha LRDI (Pearson, 6e)';

(async () => {
  await mongoose.connect(process.env.MONGODB_STRING, { bufferCommands: false });
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  const db = mongoose.connection.db;
  const topicsCol = db.collection('lrp_topics');
  const setsCol   = db.collection('lrp_sets');

  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'chapter_questions', 'lrp_content.json'), 'utf8')
  );

  const now = new Date();
  const delT = await topicsCol.deleteMany({});
  const delS = await setsCol.deleteMany({});
  console.log(`Deleted ${delT.deletedCount} topics, ${delS.deletedCount} sets`);

  const topicDocs = data.topics.map(t => ({ ...t, createdAt: now, updatedAt: now }));
  if (topicDocs.length) await topicsCol.insertMany(topicDocs);

  const setDocs = data.sets.map(s => ({
    ...s, source: s.source || SOURCE, createdAt: now, updatedAt: now,
  }));
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
