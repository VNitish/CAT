/* Build the 30 daily GRE Quant tests from chapter_questions/gre_ch*.json and
 * write them to chapter_questions/gre_tests.json + the gre_tests collection.
 *
 * Each test: 28 questions, 50 minutes, mixed like the real GRE.
 *   - Data Interpretation sets stay whole (one set per test, spread across the month).
 *   - Every other question is dealt greedily so each test gets a fair share of
 *     every content area, every chapter, every format (QC ~40%), and early/late
 *     book positions (the book's rough difficulty order).
 *   - Order inside a test: a fixed seeded shuffle, DI set kept together.
 *   - Disputed questions (tag answer_disputed) are left out.
 *
 * 828 usable questions are 12 short of 30 x 28, so test 30 gets 16 fresh questions
 * (dealt like the rest) plus 12 repeats from tests 1-10, flagged in repeat_keys.
 *
 * Questions are referenced by a stable key "chNN_qN" because seed_gre_quant.js
 * re-creates question _ids on every run.
 *
 * Run:  node api/seed_gre_tests.js
 */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const QDIR = path.join(__dirname, '..', 'chapter_questions');
const N_TESTS = 30, SIZE = 28, MINUTES = 50;
const AREA = ch =>
  [7, 11, 12, 13, 14, 15].includes(ch) ? 'Arithmetic & Number Properties'
  : [8, 9, 10, 19].includes(ch) ? 'Algebra'
  : [16, 17, 18, 20].includes(ch) ? 'Word Problems'
  : [21, 22, 23, 24].includes(ch) ? 'Data Analysis'
  : [25, 26, 27, 28, 29].includes(ch) ? 'Geometry'
  : 'Advanced';
const key = (ch, n) => `ch${String(ch).padStart(2, '0')}_q${n}`;
const FORMAT = t => (t === 'QC' ? 'QC' : 'PS');

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function load() {
  const qs = [], sets = [];
  for (const f of fs.readdirSync(QDIR).filter(f => /^gre_ch\d+\.json$/.test(f)).sort()) {
    const ch = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
    const total = ch.questions.length;
    for (const q of ch.questions) {
      if ((q.tags || []).includes('answer_disputed')) continue;
      qs.push({ key: key(ch.chapter_no, q.question_number), chapter_no: ch.chapter_no, chapter: ch.chapter,
        area: AREA(ch.chapter_no), type: q.question_type, set_id: q.set_id || null,
        pos: Math.min(2, Math.floor((3 * (q.question_number - 1)) / total)) }); // 0 early, 1 mid, 2 late
    }
    for (const s of ch.sets || []) sets.push({ set_id: s.set_id, keys: s.question_numbers.map(n => key(ch.chapter_no, n)) });
  }
  return { qs, sets };
}

function build() {
  const { qs, sets } = load();
  const byKey = Object.fromEntries(qs.map(q => [q.key, q]));
  const tests = Array.from({ length: N_TESTS }, (_, i) => ({ test_no: i + 1, items: [], set_keys: [] }));
  const repeats = N_TESTS * SIZE - qs.length;           // shortfall, filled with repeats in test 30
  const cap = i => (i < N_TESTS - 1 ? SIZE : SIZE - repeats);

  // 1. DI sets, spread evenly over tests 1-29.
  sets.forEach((s, k) => {
    const t = tests[Math.round((k + 0.5) * (N_TESTS - 1) / sets.length - 0.5)];
    t.set_keys.push(...s.keys);
    s.keys.forEach(kk => t.items.push(byKey[kk]));
  });

  // 2. Singles, scarcest chapter first, dealt to the test that most needs them.
  const singles = qs.filter(q => !q.set_id);
  const chCount = {};
  singles.forEach(q => { chCount[q.chapter_no] = (chCount[q.chapter_no] || 0) + 1; });
  singles.sort((a, b) => chCount[a.chapter_no] - chCount[b.chapter_no] || a.chapter_no - b.chapter_no || a.key.localeCompare(b.key, 'en', { numeric: true }));
  const count = (t, f, v) => t.items.filter(x => x[f] === v).length;
  const qcShare = qs.filter(q => q.type === 'QC').length / qs.length;
  for (const q of singles) {
    let best = null, bestScore = Infinity;
    tests.forEach((t, i) => {
      if (t.items.length >= cap(i)) return;
      const fill = t.items.length / cap(i);
      const qcTarget = Math.round(qcShare * cap(i));
      const qcNow = t.items.filter(x => FORMAT(x.type) === 'QC').length;
      const score =
        10 * count(t, 'chapter_no', q.chapter_no) +
        4 * count(t, 'area', q.area) +
        3 * t.items.filter(x => x.pos === q.pos).length +
        (FORMAT(q.type) === 'QC' ? 6 * Math.max(0, qcNow - qcTarget + 1) : 6 * Math.max(0, (t.items.length - qcNow) - (cap(i) - qcTarget) + 1)) +
        8 * fill;
      if (score < bestScore) { bestScore = score; best = t; }
    });
    (best || tests[N_TESTS - 1]).items.push(q);
  }

  // 3. Test 30: leftovers plus repeats from tests 1-10 to reach 28.
  const last = tests[N_TESTS - 1];
  let r = 0;
  while (last.items.length < SIZE) {
    const src = tests[r % 10].items.filter(x => !x.set_id && !last.items.some(y => y.key === x.key));
    const pick = src.find(x => !count(last, 'chapter_no', x.chapter_no)) || src.find(x => count(last, 'area', x.area) < 6) || src[0];
    last.items.push({ ...pick, repeat: true });
    r++;
  }

  // 4. Order: a fixed shuffle per test (seeded by test number, so re-running gives
  //    the same order). The DI set stays together as one block, and no more than
  //    two questions of the same format or area sit next to each other where avoidable.
  return tests.map(t => {
    const rnd = mulberry32(1000 + t.test_no);
    const setBlock = t.items.filter(x => x.set_id);
    const pool = t.items.filter(x => !x.set_id).sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const singles = [];
    while (pool.length) {
      const clash = x => singles.length >= 2 && [-1, -2].every(o => FORMAT(singles[singles.length + o].type) === FORMAT(x.type))
        || (singles.length && singles[singles.length - 1].area === x.area);
      const i = pool.findIndex(x => !clash(x));
      singles.push(pool.splice(i < 0 ? 0 : i, 1)[0]);
    }
    const at = setBlock.length ? Math.floor(rnd() * (singles.length + 1)) : 0;
    const items = [...singles.slice(0, at), ...setBlock, ...singles.slice(at)];
    const tally = f => items.reduce((m, x) => ((m[x[f]] = (m[x[f]] || 0) + 1), m), {});
    return {
      test_no: t.test_no, subject: 'quant', title: `GRE Quant Test ${t.test_no}`, duration_minutes: MINUTES,
      question_keys: items.map(x => x.key),
      repeat_keys: items.filter(x => x.repeat).map(x => x.key),
      mix: { by_area: tally('area'), by_type: tally('type'), chapters: Object.keys(tally('chapter_no')).length },
    };
  });
}

(async () => {
  const tests = build();
  const all = tests.flatMap(t => t.question_keys.filter(k => !t.repeat_keys.includes(k)));
  if (new Set(all).size !== all.length) throw new Error('a question is used twice outside the repeat list');
  if (tests.some(t => t.question_keys.length !== SIZE)) throw new Error('a test is not 28 questions');
  fs.writeFileSync(path.join(QDIR, 'gre_tests.json'), JSON.stringify(tests, null, 1));
  const client = await MongoClient.connect(process.env.MONGODB_STRING);
  const col = client.db().collection('gre_tests');
  await col.deleteMany({ subject: { $ne: 'verbal' } }); // verbal tests (101+) are seeded by seed_gre_verbal_tests.js
  await col.insertMany(tests.map(t => ({ ...t, createdAt: new Date() })));
  await col.createIndex({ test_no: 1 }, { unique: true });
  await client.close();
  for (const t of tests) console.log(t.test_no, JSON.stringify(t.mix.by_type), 'chapters:', t.mix.chapters, t.repeat_keys.length ? `repeats:${t.repeat_keys.length}` : '');
})().catch(e => { console.error(e.message); process.exit(1); });
