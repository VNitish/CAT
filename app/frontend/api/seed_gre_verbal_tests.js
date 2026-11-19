/* Build the 22 daily GRE Verbal tests from chapter_questions/gre_v_ch*.json and
 * write them to chapter_questions/gre_verbal_tests.json + the gre_tests collection.
 *
 * Each test mirrors the real Verbal Reasoning measure: 27 questions, 45 minutes,
 * about half Reading Comprehension (2-4 passages plus short arguments) and the rest
 * split between Text Completion and Sentence Equivalence.
 *   - A passage and all its questions always land in the same test, together.
 *   - RC passages are dealt first (largest first) to the test with the least RC,
 *     arguments spread evenly; TC/SE singles then fill each test to exactly 27,
 *     spreading 1/2/3-blank TCs and the practice-section difficulty levels.
 *   - Order inside a test: Text Completions first (as on the GRE), then SE and the
 *     RC passages mixed in a fixed seeded shuffle.
 *   - Disputed questions (tag answer_disputed) are left out; 598 usable questions
 *     fill 22 x 27 = 594, so the 4 last-dealt singles are unused (listed in the output).
 *
 * Verbal tests share gre_tests (unique test_no) with the quant tests, so they are
 * numbered 101-122 and carry subject: 'verbal'; the UI shows them as Test 1-22.
 * Questions are referenced by the stable key "vNN_qN".
 *
 * Run:  node api/seed_gre_verbal_tests.js
 */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const QDIR = path.join(__dirname, '..', 'chapter_questions');
const N_TESTS = 22, SIZE = 27, MINUTES = 45, OFFSET = 100;
const key = (ch, n) => `v${String(ch).padStart(2, '0')}_q${n}`;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (arr, rnd) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

function load() {
  const qs = [], units = [];
  const byCh = {};
  for (const f of fs.readdirSync(QDIR).filter(f => /^gre_v_ch\d+(_part\d+)?\.json$/.test(f)).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
    (byCh[d.chapter_no] = byCh[d.chapter_no] || { qs: [], ps: [] });
    byCh[d.chapter_no].qs.push(...d.questions);
    byCh[d.chapter_no].ps.push(...(d.passages || []));
  }
  for (const [chNo, c] of Object.entries(byCh)) {
    const usable = q => !(q.tags || []).includes('answer_disputed');
    for (const q of c.qs) {
      if (q.passage_id || !usable(q)) continue;
      qs.push({ key: key(chNo, q.question_number), type: q.question_type,
        blanks: q.blanks ? q.blanks.length : 0, difficulty: q.section?.difficulty || null });
    }
    for (const p of c.ps) {
      const keys = c.qs.filter(q => q.passage_id === p.passage_id && usable(q)).sort((a, b) => a.question_number - b.question_number)
        .map(q => key(chNo, q.question_number));
      if (keys.length) units.push({ passage_id: p.passage_id, kind: p.kind, keys });
    }
  }
  return { singles: qs, units };
}

function build() {
  const { singles, units } = load();
  const rnd = mulberry32(2026);
  const tests = Array.from({ length: N_TESTS }, (_, i) => ({ test_no: OFFSET + i + 1, units: [], singles: [] }));
  const rc = t => t.units.reduce((s, u) => s + u.keys.length, 0);
  const args = t => t.units.filter(u => u.kind === 'argument').length;
  const rcTarget = units.reduce((s, u) => s + u.keys.length, 0) / N_TESTS;

  // 1. RC passages, largest first, to the test with the least RC (arguments spread).
  shuffle(units, rnd).sort((a, b) => b.keys.length - a.keys.length);
  for (const u of units) {
    const best = tests
      .filter(t => rc(t) + u.keys.length <= Math.ceil(rcTarget) + 1)
      .sort((a, b) => rc(a) - rc(b) || (u.kind === 'argument' ? args(a) - args(b) : 0))[0]
      || tests.sort((a, b) => rc(a) - rc(b))[0];
    best.units.push(u);
  }
  tests.sort((a, b) => a.test_no - b.test_no);

  // 2. TC/SE singles fill each test to 27, balancing TC vs SE, blank counts and difficulty.
  const pool = shuffle([...singles], rnd);
  const tcShare = singles.filter(s => s.type === 'TC').length / singles.length;
  const count = (t, f) => t.singles.filter(f).length;
  for (const s of pool) {
    let best = null, bestScore = Infinity;
    for (const t of tests) {
      const room = SIZE - rc(t) - t.singles.length;
      if (room <= 0) continue;
      const need = SIZE - rc(t);
      const tcWant = Math.round(need * tcShare);
      const score =
        (s.type === 'TC' ? 5 * Math.max(0, count(t, x => x.type === 'TC') - tcWant + 1) : 5 * Math.max(0, count(t, x => x.type === 'SE') - (need - tcWant) + 1)) +
        (s.type === 'TC' ? 2 * count(t, x => x.type === 'TC' && x.blanks === s.blanks) : 0) +
        (s.difficulty ? 3 * count(t, x => x.difficulty === s.difficulty) : 0) +
        4 * (1 - room / need);
      if (score < bestScore) { bestScore = score; best = t; }
    }
    if (best) best.singles.push(s); else s.unused = true;
  }
  const unused = pool.filter(s => s.unused).map(s => s.key);

  // 3. Order: TC block first, then SE singles and RC passages mixed.
  return {
    unused,
    tests: tests.map(t => {
      const r = mulberry32(5000 + t.test_no);
      const tc = shuffle(t.singles.filter(s => s.type === 'TC'), r);
      const rest = shuffle([...t.singles.filter(s => s.type === 'SE').map(s => [s.key]), ...t.units.map(u => u.keys)], r);
      const keys = [...tc.map(s => s.key), ...rest.flat()];
      return {
        test_no: t.test_no, subject: 'verbal', title: `GRE Verbal Test ${t.test_no - OFFSET}`, duration_minutes: MINUTES,
        question_keys: keys, repeat_keys: [],
        mix: {
          by_type: { TC: tc.length, SE: count(t, x => x.type === 'SE'), RC: rc(t) },
          passages: t.units.filter(u => u.kind !== 'argument').length,
          arguments: args(t),
        },
      };
    }),
  };
}

(async () => {
  const { tests, unused } = build();
  const all = tests.flatMap(t => t.question_keys);
  if (new Set(all).size !== all.length) throw new Error('a question is used twice');
  const bad = tests.filter(t => t.question_keys.length !== SIZE);
  if (bad.length) throw new Error(`tests not ${SIZE} questions: ${bad.map(t => `${t.test_no}=${t.question_keys.length}`).join(', ')}`);
  fs.writeFileSync(path.join(QDIR, 'gre_verbal_tests.json'), JSON.stringify({ tests, unused }, null, 1));
  const client = await MongoClient.connect(process.env.MONGODB_STRING);
  const col = client.db().collection('gre_tests');
  await col.deleteMany({ subject: 'verbal' });
  await col.insertMany(tests.map(t => ({ ...t, createdAt: new Date() })));
  await client.close();
  for (const t of tests) console.log(t.test_no - OFFSET, JSON.stringify(t.mix));
  console.log('unused:', unused.join(', '));
})().catch(e => { console.error(e.message); process.exit(1); });
