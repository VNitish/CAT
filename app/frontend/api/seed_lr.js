/* Seed the Logical Reasoning learning content (lr_topics + lr_questions).
 * Source: Nishit Sinha LRDI (Pearson, 6e), Part 1 — concepts grounded in the book,
 * questions self-contained and verified. Content in chapter_questions/lr_content.json.
 * Run:  node api/seed_lr.js
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
  const topicsCol  = db.collection('lr_topics');
  const qCol       = db.collection('lr_questions');

  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'chapter_questions', 'lr_content.json'), 'utf8')
  );

  const now = new Date();
  const delT = await topicsCol.deleteMany({});
  const delQ = await qCol.deleteMany({});
  console.log(`Deleted ${delT.deletedCount} topics, ${delQ.deletedCount} questions`);

  const topicDocs = data.topics.map(t => ({ ...t, createdAt: now, updatedAt: now }));
  await topicsCol.insertMany(topicDocs);

  const qDocs = data.questions.map(q => ({
    ...q, source: q.source || SOURCE, createdAt: now, updatedAt: now,
  }));
  await qCol.insertMany(qDocs);

  const byTopic = {};
  qDocs.forEach(q => { byTopic[q.topic_slug] = (byTopic[q.topic_slug] || 0) + 1; });
  console.log(`Inserted ${topicDocs.length} topics, ${qDocs.length} questions`);
  console.log('per topic:', byTopic);

  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
