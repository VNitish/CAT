const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
// Next.js env precedence: process.env > .env.local > .env. We never override
// process.env (shell + Vercel). On Vercel both .env files are absent and
// values come from Vercel's project environment settings.
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
// Same-origin in dev (Next dev server proxies /api/* to localhost:4000) and in
// prod (function runs on the same Vercel domain as the app). CORS_ORIGINS only
// matters when hitting the deployed API from a different origin.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 12;
const FREE_PAPERS = new Set(['CAT_2025_S1', 'CAT_2025_S2', 'CAT_2025_S3']);

// ── MongoDB connection (cached across serverless invocations) ─────────────────
let cached = global._mongoConn;
if (!cached) cached = global._mongoConn = { conn: null, promise: null };

async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_STRING, { bufferCommands: false })
      .then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

app.use(async (_req, res, next) => {
  try { await dbConnect(); next(); }
  catch (e) {
    console.error('MongoDB connection failed:', e.message);
    res.status(503).json({ error: 'database unavailable' });
  }
});

// ── Schemas ───────────────────────────────────────────────────────────────────
const optionSchema = new mongoose.Schema({ label: String, text: String }, { _id: false });

const questionSchema = new mongoose.Schema({
  question_code:    String,
  paper_id:         mongoose.Schema.Types.ObjectId,
  section:          String,
  question_type:    String,
  topic:            String,
  subtopic:         String,
  set_id:           String,
  set_position:     Number,
  context_passage:  String,
  question_text:    String,
  options:          [optionSchema],
  correct_answer:   String,
  marks_correct:    Number,
  marks_incorrect:  Number,
  explanation:      String,
  difficulty:       String,
  question_number:  Number,
  tags:             [String],
  is_image_based:   Boolean,
  image_url:        String,
}, { collection: 'questions' });

const sectionInfoSchema = new mongoose.Schema({
  section:             String,
  total_questions:     Number,
  mcq_count:           Number,
  tita_count:          Number,
  time_limit_minutes:  Number,
}, { _id: false });

const paperSchema = new mongoose.Schema({
  paper_code:      String,
  title:           String,
  source_type:     String,
  year:            Number,
  slot:            String,
  series:          String,
  mock_number:     Number,
  bank_topic:      String,
  bank_category:   String,
  sections:        [sectionInfoSchema],
  total_questions: Number,
  total_marks:     Number,
  duration_minutes: Number,
}, { collection: 'question_papers', timestamps: true });

const examPaperSchema = new mongoose.Schema({
  paper_code:    { type: String, unique: true },
  question_ids:  [mongoose.Schema.Types.ObjectId],
  generated_at:  { type: Date, default: Date.now },
}, { collection: 'exam_papers' });

const userSchema = new mongoose.Schema({
  email:           { type: String, unique: true, lowercase: true, trim: true },
  name:            { type: String, trim: true },
  password_hash:   String,
  plan:            { type: String, enum: ['free', 'pro'], default: 'free' },
  plan_expires_at: { type: Date, default: null },
  email_verified:  { type: Boolean, default: false },
  last_login_at:   { type: Date, default: null },
}, { collection: 'users', timestamps: true });

const sectionScoreSchema = new mongoose.Schema({
  attempted:    Number,
  correct:      Number,
  incorrect:    Number,
  score:        Number,
  max_score:    Number,
  time_taken_s: Number,
}, { _id: false });

const attemptSchema = new mongoose.Schema({
  user_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  paper_code:      { type: String, index: true },
  started_at:      Date,
  finished_at:     { type: Date, default: null },
  question_states: { type: mongoose.Schema.Types.Mixed, default: {} },
  scores: {
    VARC:  sectionScoreSchema,
    DILR:  sectionScoreSchema,
    QA:    sectionScoreSchema,
    total: Number,
  },
}, { collection: 'attempts', timestamps: true });

// ── Topic Question (Arun Sharma book) ─────────────────────────────────────────
const topicQuestionSchema = new mongoose.Schema({
  source:          { type: String, default: 'Arun Sharma QA 8e' },
  chapter_id:      Number,
  topic:           String,
  block:           String,
  lod:             { type: Number, enum: [1, 2, 3] },
  difficulty:      { type: String, enum: ['Easy', 'Medium', 'Hard'] },
  question_number: Number,
  directions:      { type: String, default: '' },
  question:        String,
  question_type:   { type: String, enum: ['MCQ', 'TITA'], default: 'MCQ' },
  options:         { a: String, b: String, c: String, d: String },
  correct_answer:  String,
  solution:        { type: String, default: '' },
  tags:            [String],
  verified:        { type: Boolean, default: false },
}, { collection: 'topic_questions', timestamps: true });

// Practice session schema
const practiceSessionSchema = new mongoose.Schema({
  user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  topic:      String,
  lod:        Number,
  status:     { type: String, enum: ['in_progress', 'submitted', 'abandoned'], default: 'in_progress', index: true },
  question_ids: [mongoose.Schema.Types.ObjectId],
  responses:  { type: mongoose.Schema.Types.Mixed, default: {} },
  // responses: { [question_id]: { answer: 'a'|'b'|'c'|'d'|string, is_correct: bool, skipped: bool } }
  finished_at: { type: Date, default: null },
  score: {
    total:     Number,
    correct:   Number,
    incorrect: Number,
    skipped:   Number,
  },
}, { collection: 'practice_sessions', timestamps: true });
practiceSessionSchema.index({ user_id: 1, topic: 1, status: 1 });

// ── VARC question (Nishit Sinha VA-RC section tests) ──────────────────────────
const varcQuestionSchema = new mongoose.Schema({
  question_code:   { type: String, index: true },
  test:            { type: Number, enum: [1, 2, 3], index: true },
  section:         { type: String, default: 'VARC' },
  question_type:   { type: String, enum: ['MCQ', 'TITA'], default: 'MCQ' },
  answer_format:   { type: String, enum: ['option', 'sequence'], default: 'option' },
  topic:           String,
  set_id:          String,
  set_position:    Number,
  context_passage: { type: String, default: '' },
  directions:      { type: String, default: '' },
  question_text:   String,
  underline:       { type: String, default: '' },
  options:         [{ _id: false, label: String, text: String }],
  correct_answer:  String,
  marks_correct:   { type: Number, default: 3 },
  marks_incorrect: { type: Number, default: -1 },
  explanation:     { type: String, default: '' },
  question_number: Number,
  source:          String,
  verified:        { type: Boolean, default: false },
  removed:         { type: Boolean, default: false },
}, { collection: 'varc_questions', timestamps: true });

// ── VARC session (one attempt of a 34-question test) ──────────────────────────
const varcSessionSchema = new mongoose.Schema({
  user_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  test:            { type: Number, enum: [1, 2, 3] },
  status:          { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
  question_ids:    [mongoose.Schema.Types.ObjectId],
  // question_states: { [qId]: { status: 'answered'|'not-answered'|'marked'|'answered-marked'|'not-visited', answer: string|null } }
  question_states: { type: mongoose.Schema.Types.Mixed, default: {} },
  time_left:       { type: Number, default: 60 * 60 }, // seconds; may go negative
  started_at:      { type: Date, default: Date.now },
  finished_at:     { type: Date, default: null },
  score: {
    total:      Number,
    attempted:  Number,
    correct:    Number,
    incorrect:  Number,
    max_score:  Number,
  },
}, { collection: 'varc_sessions', timestamps: true });
varcSessionSchema.index({ user_id: 1, test: 1, status: 1 });

const Question        = mongoose.model('Question', questionSchema);
const QuestionPaper   = mongoose.model('QuestionPaper', paperSchema);
const ExamPaper       = mongoose.model('ExamPaper', examPaperSchema);
const User            = mongoose.model('User', userSchema);
const Attempt         = mongoose.model('Attempt', attemptSchema);
const TopicQuestion   = mongoose.model('TopicQuestion', topicQuestionSchema);
const PracticeSession = mongoose.model('PracticeSession', practiceSessionSchema);
const VarcQuestion    = mongoose.model('VarcQuestion', varcQuestionSchema);
const VarcSession     = mongoose.model('VarcSession', varcSessionSchema);

// ── Reading Comprehension question (Nishit Sinha "RC A Day" — 40 passages) ─────
// Grouped 4 passages per test => 10 tests. Same shape as VARC so the exam UI is
// shared in spirit; questions of one passage share context_passage + directions.
const RC_TESTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const rcQuestionSchema = new mongoose.Schema({
  question_code:   { type: String, index: true },
  test:            { type: Number, enum: RC_TESTS, index: true },
  section:         { type: String, default: 'Reading Comprehension' },
  question_type:   { type: String, enum: ['MCQ', 'TITA'], default: 'MCQ' },
  answer_format:   { type: String, enum: ['option', 'sequence'], default: 'option' },
  topic:           String,
  set_id:          String,          // passage id, e.g. "t1-p3"
  set_position:    Number,          // position within its passage
  context_passage: { type: String, default: '' },
  directions:      { type: String, default: '' },
  question_text:   String,
  underline:       { type: String, default: '' },
  options:         [{ _id: false, label: String, text: String }],
  correct_answer:  String,
  marks_correct:   { type: Number, default: 3 },
  marks_incorrect: { type: Number, default: -1 },
  explanation:     { type: String, default: '' },
  question_number: Number,
  source:          String,
  verified:        { type: Boolean, default: false },
  removed:         { type: Boolean, default: false },
}, { collection: 'rc_questions', timestamps: true });

const rcSessionSchema = new mongoose.Schema({
  user_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  test:            { type: Number, enum: RC_TESTS },
  status:          { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
  question_ids:    [mongoose.Schema.Types.ObjectId],
  question_states: { type: mongoose.Schema.Types.Mixed, default: {} },
  time_left:       { type: Number, default: 40 * 60 }, // seconds; set per test on create
  started_at:      { type: Date, default: Date.now },
  finished_at:     { type: Date, default: null },
  score: {
    total:      Number,
    attempted:  Number,
    correct:    Number,
    incorrect:  Number,
    max_score:  Number,
  },
}, { collection: 'rc_sessions', timestamps: true });
rcSessionSchema.index({ user_id: 1, test: 1, status: 1 });

const RcQuestion      = mongoose.model('RcQuestion', rcQuestionSchema);
const RcSession       = mongoose.model('RcSession', rcSessionSchema);

// ── Data Interpretation question (Nishit Sinha LRDI 6e — Part 2 Section 2 ──────
// "Practising Data Interpretation"). Timed mocks like RC: each book practice
// exercise becomes one test. Tests are numbered 1..N globally and tagged with a
// tier (Foundation/Moderate/Advanced) for grouping on the listing page. Chart and
// table visuals are cropped PNGs referenced as markdown images inside
// context_passage (served from /public/di), rendered via the shared MathText.
const DI_TIERS = ['Foundation', 'Moderate', 'Advanced'];
const diQuestionSchema = new mongoose.Schema({
  question_code:   { type: String, index: true },
  tier:            { type: String, enum: DI_TIERS, index: true },
  test:            { type: Number, index: true },   // 1..N global
  section:         { type: String, default: 'DILR' },
  question_type:   { type: String, enum: ['MCQ', 'TITA'], default: 'MCQ' },
  answer_format:   { type: String, enum: ['option', 'sequence'], default: 'option' },
  topic:           { type: String, default: 'Data Interpretation' },
  subtopic:        String,          // 'Pie Chart' | 'Bar Chart' | 'Line Graph' | 'Table' | 'Caselet'
  set_id:          String,          // caselet id, e.g. "fnd-t1-s1"
  set_position:    Number,          // position within its data-set
  context_passage: { type: String, default: '' },  // intro paras + markdown chart/table image
  directions:      { type: String, default: '' },
  question_text:   String,
  underline:       { type: String, default: '' },
  options:         [{ _id: false, label: String, text: String }],
  correct_answer:  String,
  marks_correct:   { type: Number, default: 3 },
  marks_incorrect: { type: Number, default: -1 },
  explanation:     { type: String, default: '' },
  difficulty:      String,
  question_number: Number,
  source:          String,
  verified:        { type: Boolean, default: false },
  removed:         { type: Boolean, default: false },
}, { collection: 'di_questions', timestamps: true });
diQuestionSchema.index({ test: 1, question_number: 1 });

const diSessionSchema = new mongoose.Schema({
  user_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  tier:            { type: String, enum: DI_TIERS },
  test:            { type: Number },
  status:          { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
  question_ids:    [mongoose.Schema.Types.ObjectId],
  question_states: { type: mongoose.Schema.Types.Mixed, default: {} },
  time_left:       { type: Number, default: 30 * 60 }, // seconds; set per test on create
  started_at:      { type: Date, default: Date.now },
  finished_at:     { type: Date, default: null },
  score: {
    total:      Number,
    attempted:  Number,
    correct:    Number,
    incorrect:  Number,
    max_score:  Number,
  },
}, { collection: 'di_sessions', timestamps: true });
diSessionSchema.index({ user_id: 1, test: 1, status: 1 });

// Chart/table crops live in MongoDB as base64 (one doc per data-set), served as PNG by
// GET /api/di/image/:setId. Questions reference them via a short URL in context_passage,
// so the heavy image bytes are fetched once per set and cached by the browser rather than
// inlined as a huge data-URI on every question.
const diImageSchema = new mongoose.Schema({
  set_id:       { type: String, unique: true, index: true },
  content_type: { type: String, default: 'image/png' },
  b64:          String,
}, { collection: 'di_images', timestamps: true });

const DiQuestion      = mongoose.model('DiQuestion', diQuestionSchema);
const DiSession       = mongoose.model('DiSession', diSessionSchema);
const DiImage         = mongoose.model('DiImage', diImageSchema);

// ── Middleware ────────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAccess(req, res, next) {
  const paperCode = req.params.code;
  if (FREE_PAPERS.has(paperCode)) return next();
  if (req.user.plan === 'pro') {
    const now = new Date();
    const exp = req.user.plan_expires_at ? new Date(req.user.plan_expires_at) : null;
    if (!exp || exp > now) return next();
  }
  res.status(403).json({ error: 'pro_required' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sortQuestions(questions) {
  const sectionOrder = { VARC: 0, DILR: 1, QA: 2 };
  questions.sort((a, b) => {
    const so = (sectionOrder[a.section] ?? 9) - (sectionOrder[b.section] ?? 9);
    if (so !== 0) return so;
    if (a.set_id && b.set_id && a.set_id === b.set_id) {
      return (a.set_position || 0) - (b.set_position || 0);
    }
    return (a.question_number || 0) - (b.question_number || 0);
  });
  return questions;
}

function groupBySection(questions) {
  const counts = { VARC: 0, DILR: 0, QA: 0 };
  questions.forEach(q => { counts[q.section] = (counts[q.section] || 0) + 1; q.question_number = counts[q.section]; });
  return {
    VARC: questions.filter(q => q.section === 'VARC'),
    DILR: questions.filter(q => q.section === 'DILR'),
    QA:   questions.filter(q => q.section === 'QA'),
  };
}

function makeToken(user) {
  return jwt.sign(
    { _id: user._id, email: user.email, name: user.name, plan: user.plan, plan_expires_at: user.plan_expires_at },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ── Auth routes ───────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: 'email, name and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ email, name, password_hash });
    user.last_login_at = new Date();
    await user.save();

    res.status(201).json({ token: makeToken(user), user: { _id: user._id, email: user.email, name: user.name, plan: user.plan } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    user.last_login_at = new Date();
    await user.save();

    res.json({ token: makeToken(user), user: { _id: user._id, email: user.email, name: user.name, plan: user.plan } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password_hash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Status ────────────────────────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  try {
    const counts = {
      questions:       await Question.countDocuments(),
      question_papers: await QuestionPaper.countDocuments(),
      exam_papers:     await ExamPaper.countDocuments(),
      users:           await User.countDocuments(),
    };
    const bySection = await Question.aggregate([{ $group: { _id: '$section', count: { $sum: 1 } } }]);
    res.json({ connected: true, counts, bySection });
  } catch (e) {
    res.status(500).json({ connected: false, error: e.message });
  }
});

// GET /api/stats — public platform stats for home page
app.get('/api/stats', async (req, res) => {
  try {
    const [totalUsers, finishedAttempts, totalQuestions, totalPapers] = await Promise.all([
      User.countDocuments(),
      Attempt.countDocuments({ finished_at: { $ne: null } }),
      Question.countDocuments(),
      QuestionPaper.countDocuments(),
    ]);
    res.json({ totalUsers, finishedAttempts, totalQuestions, totalPapers });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Papers ────────────────────────────────────────────────────────────────────

// GET /api/papers — list all papers (public, but marks is_free)
app.get('/api/papers', async (req, res) => {
  try {
    const qps = await QuestionPaper.find({}).sort({ year: 1, slot: 1 }).lean();
    const examPapers = await ExamPaper.find({}).lean();
    const generatedSet = new Set(examPapers.map(ep => ep.paper_code));
    const papers = qps.map(qp => ({
      paper_code:      qp.paper_code,
      title:           qp.title,
      year:            qp.year,
      slot:            qp.slot,
      source_type:     qp.source_type,
      total_questions: qp.total_questions,
      duration_minutes: qp.duration_minutes,
      sections:        qp.sections,
      generated:       generatedSet.has(qp.paper_code),
      is_free:         FREE_PAPERS.has(qp.paper_code),
    }));
    res.json(papers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/papers/:code/generate — auth required; pro required for paywalled papers
app.post('/api/papers/:code/generate', authMiddleware, requireAccess, async (req, res) => {
  const paperCode = req.params.code;
  try {
    const qp = await QuestionPaper.findOne({ paper_code: paperCode }).lean();
    if (!qp) return res.status(404).json({ error: 'Unknown paper code' });

    const existing = await ExamPaper.findOne({ paper_code: paperCode });
    if (existing && existing.question_ids.length > 0) return res.json({ paper_code: paperCode, cached: true });
    if (existing) await ExamPaper.deleteOne({ paper_code: paperCode });

    const allPaperQs = await Question.find({ paper_id: qp._id }).lean();
    sortQuestions(allPaperQs);

    await ExamPaper.create({ paper_code: paperCode, question_ids: allPaperQs.map(q => q._id) });
    res.json({ paper_code: paperCode, cached: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/papers/:code/questions — auth + access required
app.get('/api/papers/:code/questions', authMiddleware, requireAccess, async (req, res) => {
  const paperCode = req.params.code;
  try {
    const ep = await ExamPaper.findOne({ paper_code: paperCode });
    if (!ep) return res.status(404).json({ error: 'Paper not generated yet.' });

    const questions = await Question.find({ _id: { $in: ep.question_ids } }).lean();
    sortQuestions(questions);
    const bySection = groupBySection(questions);

    res.json({ paper_code: paperCode, sections: bySection });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/papers/:code
app.delete('/api/papers/:code', authMiddleware, async (req, res) => {
  try {
    await ExamPaper.deleteOne({ paper_code: req.params.code });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Attempts ──────────────────────────────────────────────────────────────────

// POST /api/attempts — start or resume an attempt
app.post('/api/attempts', authMiddleware, async (req, res) => {
  try {
    const { paper_code } = req.body;
    if (!paper_code) return res.status(400).json({ error: 'paper_code required' });

    // Check access
    const isFree = FREE_PAPERS.has(paper_code);
    if (!isFree && req.user.plan !== 'pro') return res.status(403).json({ error: 'pro_required' });

    // Resume unfinished attempt if exists
    const existing = await Attempt.findOne({ user_id: req.user._id, paper_code, finished_at: null });
    if (existing) return res.json(existing);

    const attempt = await Attempt.create({ user_id: req.user._id, paper_code, started_at: new Date() });
    res.status(201).json(attempt);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/attempts/:id — save progress mid-exam
app.patch('/api/attempts/:id', authMiddleware, async (req, res) => {
  try {
    const { question_states } = req.body;
    const attempt = await Attempt.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      { question_states },
      { new: true }
    );
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    res.json(attempt);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/attempts/:id/finish — submit and score
app.post('/api/attempts/:id/finish', authMiddleware, async (req, res) => {
  try {
    const { question_states } = req.body;
    const attempt = await Attempt.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

    const ep = await ExamPaper.findOne({ paper_code: attempt.paper_code });
    if (!ep) return res.status(404).json({ error: 'Paper not found' });

    const questions = await Question.find({ _id: { $in: ep.question_ids } }).lean();
    const qMap = Object.fromEntries(questions.map(q => [q._id.toString(), q]));

    const sections = { VARC: [], DILR: [], QA: [] };
    questions.forEach(q => sections[q.section]?.push(q));

    const scores = {};
    let total = 0;
    for (const [sec, qs] of Object.entries(sections)) {
      let correct = 0, incorrect = 0, attempted = 0;
      for (const q of qs) {
        const state = question_states[q._id.toString()];
        if (!state || !state.answer) continue;
        attempted++;
        if (state.answer === q.correct_answer) { correct++; }
        else if (q.question_type === 'MCQ') { incorrect++; }
      }
      const score = correct * 3 + incorrect * -1;
      const max_score = qs.length * 3;
      scores[sec] = { attempted, correct, incorrect, score, max_score, time_taken_s: 0 };
      total += score;
    }
    scores.total = total;

    const updated = await Attempt.findByIdAndUpdate(
      attempt._id,
      { question_states, scores, finished_at: new Date() },
      { new: true }
    );
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attempts — list user's attempts
app.get('/api/attempts', authMiddleware, async (req, res) => {
  try {
    const attempts = await Attempt.find({ user_id: req.user._id })
      .select('-question_states')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(attempts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attempts/:id — single attempt (for results page)
app.get('/api/attempts/:id', authMiddleware, async (req, res) => {
  try {
    const attempt = await Attempt.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    res.json(attempt);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Topic Practice Routes ─────────────────────────────────────────────────────

// GET /api/topics — list all available topics with question counts
app.get('/api/topics', async (req, res) => {
  try {
    const topics = await TopicQuestion.aggregate([
      { $match: { removed: { $ne: true } } },
      { $group: {
        _id: { topic: '$topic', block: '$block', chapter_id: '$chapter_id' },
        total:  { $sum: 1 },
        easy:   { $sum: { $cond: [{ $eq: ['$lod', 1] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$lod', 2] }, 1, 0] } },
        hard:   { $sum: { $cond: [{ $eq: ['$lod', 3] }, 1, 0] } },
      }},
      { $sort: { '_id.chapter_id': 1 } },
    ]);
    res.json(topics.map(t => ({
      topic:      t._id.topic,
      block:      t._id.block,
      chapter_id: t._id.chapter_id,
      counts:     { total: t.total, easy: t.easy, medium: t.medium, hard: t.hard },
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/practice/start — create a NEW practice session (and abandon any in-progress one for this user+topic)
// Body: { topic, lod (1|2|3|null=all), limit (default 30) }
app.post('/api/practice/start', authMiddleware, async (req, res) => {
  try {
    const { topic, lod, limit = 30 } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic required' });

    // Mark any in-progress sessions for this user+topic as abandoned (clean restart)
    await PracticeSession.updateMany(
      { user_id: req.user._id, topic, status: 'in_progress' },
      { $set: { status: 'abandoned', finished_at: new Date() } }
    );

    const filter = { topic, removed: { $ne: true } };
    if (lod) filter.lod = Number(lod);

    const questions = await TopicQuestion.aggregate([
      { $match: filter },
      { $sample: { size: Math.min(Number(limit), 50) } },
      // Present in book order (caselets grouped) rather than random sample order.
      { $sort: { question_number: 1 } },
      { $project: {
        topic: 1, block: 1, lod: 1, difficulty: 1,
        question_number: 1, directions: 1, directions_latex: 1,
        question: 1, question_latex: 1,
        question_type: 1, options: 1, options_latex: 1,
        // Do NOT send correct_answer to client
      }},
    ]);

    if (questions.length === 0) {
      return res.status(404).json({ error: 'No questions found for this topic/level' });
    }

    const session = await PracticeSession.create({
      user_id:      req.user._id,
      topic,
      lod:          lod || null,
      status:       'in_progress',
      question_ids: questions.map(q => q._id),
      responses:    {},
    });

    res.json({ session_id: session._id, questions, responses: {} });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/practice/active?topic=<topic> — resume or read the user's latest session for this topic
// Returns one of:
//   { state: 'none' }
//   { state: 'in_progress', session_id, questions (no answers), responses }
//   { state: 'finished',    session_id, questions (with answers+solutions), responses, score }
app.get('/api/practice/active', authMiddleware, async (req, res) => {
  try {
    const { topic } = req.query;
    if (!topic) return res.status(400).json({ error: 'topic required' });

    // 1) Prefer the in-progress session
    let session = await PracticeSession.findOne({
      user_id: req.user._id, topic, status: 'in_progress',
    }).sort({ createdAt: -1 }).lean();
    let isFinished = false;

    // 2) Fall back to the most recent submitted session
    if (!session) {
      session = await PracticeSession.findOne({
        user_id: req.user._id, topic, status: 'submitted',
      }).sort({ finished_at: -1 }).lean();
      isFinished = !!session;
    }

    if (!session) return res.json({ state: 'none' });

    // Fetch the questions referenced by this session, preserving original order
    const projection = isFinished
      ? 'topic block lod difficulty question_number directions directions_latex question question_latex question_type options options_latex correct_answer solution solution_latex'
      : 'topic block lod difficulty question_number directions directions_latex question question_latex question_type options options_latex';

    const docs = await TopicQuestion.find({ _id: { $in: session.question_ids } }, projection).lean();
    const docMap = {};
    docs.forEach(d => { docMap[String(d._id)] = d; });
    const orderedQs = session.question_ids
      .map(id => docMap[String(id)])
      .filter(Boolean);

    if (isFinished) {
      // Enrich with user_answer / is_correct so the page renders the result UI
      const enriched = orderedQs.map(q => {
        const r = (session.responses || {})[String(q._id)] || {};
        return {
          ...q,
          user_answer: r.answer || '',
          is_correct: !!r.is_correct,
        };
      });
      return res.json({
        state:      'finished',
        session_id: session._id,
        questions:  enriched,
        responses:  session.responses || {},
        score:      session.score || null,
      });
    }

    // In-progress — return raw saved-answer map { qId: 'a'|'b'|... } for the UI
    const flatResponses = {};
    for (const [qId, r] of Object.entries(session.responses || {})) {
      if (r && r.answer) flatResponses[qId] = r.answer;
    }

    res.json({
      state:      'in_progress',
      session_id: session._id,
      questions:  orderedQs,
      responses:  flatResponses,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/practice/:sessionId/save — incrementally persist responses (no scoring yet)
// Body: { responses: { [qId]: 'a'|'b'|'c'|'d'|string } }
app.post('/api/practice/:sessionId/save', authMiddleware, async (req, res) => {
  try {
    const { responses = {} } = req.body;
    const session = await PracticeSession.findOne({
      _id: req.params.sessionId,
      user_id: req.user._id,
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'in_progress') {
      return res.status(400).json({ error: 'Session is not in progress' });
    }

    // Replace responses with raw map (no scoring); keep the same shape as submit for consistency
    const raw = {};
    for (const [qId, ans] of Object.entries(responses)) {
      if (ans !== undefined && ans !== null && ans !== '') {
        raw[qId] = { answer: ans, skipped: false };
      }
    }
    session.responses = raw;
    session.markModified('responses');
    await session.save();
    res.json({ ok: true, saved: Object.keys(raw).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/practice/:sessionId/submit — submit answers and get results
app.post('/api/practice/:sessionId/submit', authMiddleware, async (req, res) => {
  try {
    const { responses } = req.body;
    // responses: { [question_id]: 'a'|'b'|'c'|'d'|string }

    const session = await PracticeSession.findOne({
      _id: req.params.sessionId,
      user_id: req.user._id,
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'submitted' || session.finished_at) return res.status(400).json({ error: 'Session already submitted' });

    // Fetch all questions with correct answers
    const questions = await TopicQuestion.find(
      { _id: { $in: session.question_ids } },
      'question question_latex question_type options options_latex correct_answer solution solution_latex directions directions_latex topic lod difficulty'
    ).lean();

    const qMap = {};
    questions.forEach(q => { qMap[String(q._id)] = q; });

    let correct = 0, incorrect = 0, skipped = 0;
    const enrichedResponses = {};

    for (const qId of session.question_ids.map(String)) {
      const q = qMap[qId];
      const given = responses[qId];
      if (!given || given === '') {
        skipped++;
        enrichedResponses[qId] = { answer: '', is_correct: false, skipped: true };
      } else {
        const is_correct = q.correct_answer && given.toLowerCase() === q.correct_answer.toLowerCase();
        if (is_correct) correct++; else incorrect++;
        enrichedResponses[qId] = { answer: given, is_correct: !!is_correct, skipped: false };
      }
    }

    session.responses   = enrichedResponses;
    session.markModified('responses');
    session.finished_at = new Date();
    session.status      = 'submitted';
    session.score       = { total: questions.length, correct, incorrect, skipped };
    await session.save();

    // Return results with correct answers and solutions
    const result_questions = questions.map(q => ({
      _id:              q._id,
      question:         q.question,
      question_latex:   q.question_latex,
      question_type:    q.question_type,
      options:          q.options,
      options_latex:    q.options_latex,
      correct_answer:   q.correct_answer,
      solution:         q.solution,
      solution_latex:   q.solution_latex,
      directions:       q.directions,
      directions_latex: q.directions_latex,
      topic:            q.topic,
      difficulty:       q.difficulty,
      lod:              q.lod,
      user_answer:      enrichedResponses[String(q._id)]?.answer || '',
      is_correct:       enrichedResponses[String(q._id)]?.is_correct || false,
    }));

    res.json({
      session_id: session._id,
      score:      session.score,
      questions:  result_questions,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/quant-chapters — list all chapters with question counts
app.get('/api/quant-chapters', async (req, res) => {
  try {
    const chapters = await TopicQuestion.aggregate([
      { $match: { removed: { $ne: true } } },
      { $group: {
        _id: { chapter_id: '$chapter_id', topic: '$topic', block: '$block' },
        total:  { $sum: 1 },
        easy:   { $sum: { $cond: [{ $eq: ['$lod', 1] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$lod', 2] }, 1, 0] } },
        hard:   { $sum: { $cond: [{ $eq: ['$lod', 3] }, 1, 0] } },
      }},
      { $sort: { '_id.chapter_id': 1 } },
    ]);
    res.json(chapters.map(c => ({
      chapter_id: c._id.chapter_id,
      topic:      c._id.topic,
      block:      c._id.block,
      counts:     { total: c.total, easy: c.easy, medium: c.medium, hard: c.hard },
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/quant-chapters/seed — seed questions from JSON files (run once)
app.post('/api/quant-chapters/seed', async (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.SEED_SECRET && secret !== 'seed_quant_2024') {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '../../chapter_questions');
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'chapter_questions dir not found' });

    const deleted = await TopicQuestion.deleteMany({ source: 'Arun Sharma QA 8e' });
    const files = fs.readdirSync(dir).filter(f => f.startsWith('ch') && f.endsWith('.json')).sort();

    const curatedPath = path.join(__dirname, '../../curated_selections.json');
    const curated = fs.existsSync(curatedPath)
      ? JSON.parse(fs.readFileSync(curatedPath, 'utf8'))
      : null;

    let total = 0;
    for (const file of files) {
      let data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!data.length) continue;

      if (curated) {
        const chapterId = data[0]?.chapter_id;
        const indices = curated[String(chapterId)];
        if (indices) data = indices.map(i => data[i]).filter(Boolean);
      }

      const docs = data.map(q => ({
        ...q,
        correct_answer: (q.correct_answer || '').toLowerCase().trim().charAt(0),
        solution: q.solution || '',
        directions: q.directions || '',
      }));
      await TopicQuestion.insertMany(docs, { ordered: false });
      total += docs.length;
    }
    res.json({ deleted: deleted.deletedCount, inserted: total, curated: !!curated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/practice/history — user's past practice sessions
app.get('/api/practice/history', authMiddleware, async (req, res) => {
  try {
    const sessions = await PracticeSession.find(
      { user_id: req.user._id, status: 'submitted' },
      'topic lod score finished_at createdAt'
    ).sort({ createdAt: -1 }).limit(50).lean();
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  VARC Mocks (Nishit Sinha VA-RC section tests 1–3)
// ════════════════════════════════════════════════════════════════════════════

// Fields safe to expose before submission (withholds correct_answer + explanation)
const VARC_SAFE_PROJECTION =
  'question_code test section question_type answer_format topic set_id set_position ' +
  'context_passage directions question_text underline options marks_correct marks_incorrect question_number';

function orderedSessionQuestions(session, docs) {
  const map = {};
  docs.forEach(d => { map[String(d._id)] = d; });
  return session.question_ids.map(id => map[String(id)]).filter(Boolean);
}

function normalizeAnswer(ans, format) {
  if (ans == null) return '';
  const s = String(ans).trim();
  if (format === 'sequence') return s.toUpperCase().replace(/[^A-Z]/g, '');
  return s.toLowerCase();
}

// GET /api/varc-tests — list the three tests with question counts
app.get('/api/varc-tests', async (req, res) => {
  try {
    const rows = await VarcQuestion.aggregate([
      { $match: { removed: { $ne: true } } },
      { $group: { _id: '$test', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const byTest = {};
    rows.forEach(r => { byTest[r._id] = r.count; });
    const tests = [1, 2, 3].map(t => ({
      test: t,
      title: `Section Test ${t}`,
      questions: byTest[t] || 0,
      duration_minutes: 60,
      marks: (byTest[t] || 0) * 3,
    }));
    res.json(tests);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/varc/start — resume-first: return the in-progress session if one
// exists for this user+test, otherwise create a fresh one with all 34 questions.
// Body: { test }
app.post('/api/varc/start', authMiddleware, async (req, res) => {
  try {
    const test = Number(req.body.test);
    if (![1, 2, 3].includes(test)) return res.status(400).json({ error: 'invalid test' });

    let session = await VarcSession.findOne({
      user_id: req.user._id, test, status: 'in_progress',
    }).sort({ createdAt: -1 });

    const docs = await VarcQuestion
      .find({ test, removed: { $ne: true } }, VARC_SAFE_PROJECTION)
      .sort({ question_number: 1 })
      .lean();
    if (docs.length === 0) return res.status(404).json({ error: 'No questions for this test' });

    if (!session) {
      session = await VarcSession.create({
        user_id:         req.user._id,
        test,
        status:          'in_progress',
        question_ids:    docs.map(q => q._id),
        question_states: {},
        time_left:       60 * 60,
        started_at:      new Date(),
      });
    }

    const questions = orderedSessionQuestions(session, docs);
    res.json({
      session_id:      session._id,
      test,
      questions,
      question_states: session.question_states || {},
      time_left:       session.time_left,
      status:          session.status,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/varc/active?test=N — resume or read the latest session for this test
app.get('/api/varc/active', authMiddleware, async (req, res) => {
  try {
    const test = Number(req.query.test);
    if (![1, 2, 3].includes(test)) return res.status(400).json({ error: 'invalid test' });

    let session = await VarcSession.findOne({
      user_id: req.user._id, test, status: 'in_progress',
    }).sort({ createdAt: -1 }).lean();
    let isFinished = false;
    if (!session) {
      session = await VarcSession.findOne({
        user_id: req.user._id, test, status: 'submitted',
      }).sort({ finished_at: -1 }).lean();
      isFinished = !!session;
    }
    if (!session) return res.json({ state: 'none' });

    const projection = isFinished ? '' : VARC_SAFE_PROJECTION;
    const docs = await VarcQuestion.find({ _id: { $in: session.question_ids } }, projection).lean();
    const questions = orderedSessionQuestions(session, docs);

    res.json({
      state:           isFinished ? 'finished' : 'in_progress',
      session_id:      session._id,
      test,
      questions,
      question_states: session.question_states || {},
      time_left:       session.time_left,
      score:           isFinished ? (session.score || null) : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/varc/:sid/save — persist question_states + time_left (no scoring)
// Body: { question_states, time_left }
app.post('/api/varc/:sid/save', authMiddleware, async (req, res) => {
  try {
    const { question_states, time_left } = req.body;
    const session = await VarcSession.findOne({ _id: req.params.sid, user_id: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'in_progress') return res.status(400).json({ error: 'Session is not in progress' });

    if (question_states && typeof question_states === 'object') {
      session.question_states = question_states;
      session.markModified('question_states');
    }
    if (typeof time_left === 'number') session.time_left = time_left;
    await session.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/varc/:sid/submit — server-side scoring, then reveal answers
// Body: { question_states, time_left }
app.post('/api/varc/:sid/submit', authMiddleware, async (req, res) => {
  try {
    const { question_states, time_left } = req.body;
    const session = await VarcSession.findOne({ _id: req.params.sid, user_id: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'submitted') return res.status(400).json({ error: 'Session already submitted' });

    if (question_states && typeof question_states === 'object') {
      session.question_states = question_states;
    }
    if (typeof time_left === 'number') session.time_left = time_left;
    const states = session.question_states || {};

    const docs = await VarcQuestion.find({ _id: { $in: session.question_ids } }).lean();
    const qMap = {};
    docs.forEach(d => { qMap[String(d._id)] = d; });

    let correct = 0, incorrect = 0, net = 0, maxScore = 0;
    for (const qId of session.question_ids.map(String)) {
      const q = qMap[qId];
      if (!q) continue;
      maxScore += (q.marks_correct ?? 3);
      const given = normalizeAnswer((states[qId] || {}).answer, q.answer_format);
      if (!given) continue; // not attempted
      const key = normalizeAnswer(q.correct_answer, q.answer_format);
      if (given === key) {
        correct++;
        net += (q.marks_correct ?? 3);
      } else {
        incorrect++;
        net += (q.marks_incorrect ?? -1);
      }
    }

    session.score = {
      total:     net,
      attempted: correct + incorrect,
      correct,
      incorrect,
      max_score: maxScore,
    };
    session.status      = 'submitted';
    session.finished_at = new Date();
    session.markModified('question_states');
    await session.save();

    res.json({ session_id: session._id, score: session.score });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/varc/sessions/:sid — full results (questions WITH answers + explanations)
app.get('/api/varc/sessions/:sid', authMiddleware, async (req, res) => {
  try {
    const session = await VarcSession.findOne({ _id: req.params.sid, user_id: req.user._id }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const reveal = session.status === 'submitted';
    const projection = reveal ? '' : VARC_SAFE_PROJECTION;
    const docs = await VarcQuestion.find({ _id: { $in: session.question_ids } }, projection).lean();
    const ordered = orderedSessionQuestions(session, docs);
    const states = session.question_states || {};

    const questions = ordered.map(q => {
      const st = states[String(q._id)] || {};
      const out = { ...q, user_answer: st.answer || '', user_status: st.status || 'not-visited' };
      if (reveal) {
        out.is_correct =
          !!st.answer &&
          normalizeAnswer(st.answer, q.answer_format) === normalizeAnswer(q.correct_answer, q.answer_format);
      }
      return out;
    });

    res.json({
      session_id: session._id,
      test:       session.test,
      status:     session.status,
      score:      session.score || null,
      time_left:  session.time_left,
      questions,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/varc/history — list this user's submitted VARC sessions
app.get('/api/varc/history', authMiddleware, async (req, res) => {
  try {
    const sessions = await VarcSession.find(
      { user_id: req.user._id, status: 'submitted' },
      'test score finished_at createdAt'
    ).sort({ createdAt: -1 }).limit(50).lean();
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Reading Comprehension routes (mirror VARC; 10 tests, variable length) ─────
const RC_SECONDS_PER_Q = 120; // 2 minutes per question

function rcOrdered(session, docs) {
  const map = {};
  docs.forEach(d => { map[String(d._id)] = d; });
  return session.question_ids.map(id => map[String(id)]).filter(Boolean);
}

// GET /api/rc-tests — list the 10 tests with question counts + duration
app.get('/api/rc-tests', async (req, res) => {
  try {
    const rows = await RcQuestion.aggregate([
      { $match: { removed: { $ne: true } } },
      { $group: { _id: '$test', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const byTest = {};
    rows.forEach(r => { byTest[r._id] = r.count; });
    const tests = RC_TESTS.map(t => {
      const n = byTest[t] || 0;
      return {
        test: t,
        title: `Reading Comprehension Test ${t}`,
        questions: n,
        duration_minutes: Math.round((n * RC_SECONDS_PER_Q) / 60),
        marks: n * 3,
      };
    });
    res.json(tests);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rc/start — resume-first, else create a fresh session for this test
app.post('/api/rc/start', authMiddleware, async (req, res) => {
  try {
    const test = Number(req.body.test);
    if (!RC_TESTS.includes(test)) return res.status(400).json({ error: 'invalid test' });

    let session = await RcSession.findOne({
      user_id: req.user._id, test, status: 'in_progress',
    }).sort({ createdAt: -1 });

    const docs = await RcQuestion
      .find({ test, removed: { $ne: true } }, VARC_SAFE_PROJECTION)
      .sort({ question_number: 1 })
      .lean();
    if (docs.length === 0) return res.status(404).json({ error: 'No questions for this test' });

    if (!session) {
      session = await RcSession.create({
        user_id:         req.user._id,
        test,
        status:          'in_progress',
        question_ids:    docs.map(q => q._id),
        question_states: {},
        time_left:       docs.length * RC_SECONDS_PER_Q,
        started_at:      new Date(),
      });
    }

    const questions = rcOrdered(session, docs);
    res.json({
      session_id:      session._id,
      test,
      questions,
      question_states: session.question_states || {},
      time_left:       session.time_left,
      status:          session.status,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rc/active?test=N — resume or read the latest session for this test
app.get('/api/rc/active', authMiddleware, async (req, res) => {
  try {
    const test = Number(req.query.test);
    if (!RC_TESTS.includes(test)) return res.status(400).json({ error: 'invalid test' });

    let session = await RcSession.findOne({
      user_id: req.user._id, test, status: 'in_progress',
    }).sort({ createdAt: -1 }).lean();
    let isFinished = false;
    if (!session) {
      session = await RcSession.findOne({
        user_id: req.user._id, test, status: 'submitted',
      }).sort({ finished_at: -1 }).lean();
      isFinished = !!session;
    }
    if (!session) return res.json({ state: 'none' });

    const projection = isFinished ? '' : VARC_SAFE_PROJECTION;
    const docs = await RcQuestion.find({ _id: { $in: session.question_ids } }, projection).lean();
    const questions = rcOrdered(session, docs);

    res.json({
      state:           isFinished ? 'finished' : 'in_progress',
      session_id:      session._id,
      test,
      questions,
      question_states: session.question_states || {},
      time_left:       session.time_left,
      score:           isFinished ? (session.score || null) : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rc/:sid/save — persist question_states + time_left (no scoring)
app.post('/api/rc/:sid/save', authMiddleware, async (req, res) => {
  try {
    const { question_states, time_left } = req.body;
    const session = await RcSession.findOne({ _id: req.params.sid, user_id: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'in_progress') return res.status(400).json({ error: 'Session is not in progress' });

    if (question_states && typeof question_states === 'object') {
      session.question_states = question_states;
      session.markModified('question_states');
    }
    if (typeof time_left === 'number') session.time_left = time_left;
    await session.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rc/:sid/submit — server-side scoring, then reveal answers
app.post('/api/rc/:sid/submit', authMiddleware, async (req, res) => {
  try {
    const { question_states, time_left } = req.body;
    const session = await RcSession.findOne({ _id: req.params.sid, user_id: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'submitted') return res.status(400).json({ error: 'Session already submitted' });

    if (question_states && typeof question_states === 'object') {
      session.question_states = question_states;
    }
    if (typeof time_left === 'number') session.time_left = time_left;
    const states = session.question_states || {};

    const docs = await RcQuestion.find({ _id: { $in: session.question_ids } }).lean();
    const qMap = {};
    docs.forEach(d => { qMap[String(d._id)] = d; });

    let correct = 0, incorrect = 0, net = 0, maxScore = 0;
    for (const qId of session.question_ids.map(String)) {
      const q = qMap[qId];
      if (!q) continue;
      maxScore += (q.marks_correct ?? 3);
      const given = normalizeAnswer((states[qId] || {}).answer, q.answer_format);
      if (!given) continue; // not attempted
      const key = normalizeAnswer(q.correct_answer, q.answer_format);
      if (given === key) {
        correct++;
        net += (q.marks_correct ?? 3);
      } else {
        incorrect++;
        net += (q.marks_incorrect ?? -1);
      }
    }

    session.score = {
      total:     net,
      attempted: correct + incorrect,
      correct,
      incorrect,
      max_score: maxScore,
    };
    session.status      = 'submitted';
    session.finished_at = new Date();
    session.markModified('question_states');
    await session.save();

    res.json({ session_id: session._id, score: session.score });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rc/sessions/:sid — full results (questions WITH answers + explanations)
app.get('/api/rc/sessions/:sid', authMiddleware, async (req, res) => {
  try {
    const session = await RcSession.findOne({ _id: req.params.sid, user_id: req.user._id }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const reveal = session.status === 'submitted';
    const projection = reveal ? '' : VARC_SAFE_PROJECTION;
    const docs = await RcQuestion.find({ _id: { $in: session.question_ids } }, projection).lean();
    const ordered = rcOrdered(session, docs);
    const states = session.question_states || {};

    const questions = ordered.map(q => {
      const st = states[String(q._id)] || {};
      const out = { ...q, user_answer: st.answer || '', user_status: st.status || 'not-visited' };
      if (reveal) {
        out.is_correct =
          !!st.answer &&
          normalizeAnswer(st.answer, q.answer_format) === normalizeAnswer(q.correct_answer, q.answer_format);
      }
      return out;
    });

    res.json({
      session_id: session._id,
      test:       session.test,
      status:     session.status,
      score:      session.score || null,
      time_left:  session.time_left,
      questions,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rc/history — list this user's submitted RC sessions
app.get('/api/rc/history', authMiddleware, async (req, res) => {
  try {
    const sessions = await RcSession.find(
      { user_id: req.user._id, status: 'submitted' },
      'test score finished_at createdAt'
    ).sort({ createdAt: -1 }).limit(50).lean();
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  Data Interpretation Mocks (Nishit Sinha LRDI 6e — Practising DI, 3 tiers)
// ════════════════════════════════════════════════════════════════════════════
const DI_SECONDS_PER_Q = 150; // DI is calculation-heavy: 2.5 min per question

// Fields safe to expose before submission (withholds correct_answer + explanation)
const DI_SAFE_PROJECTION =
  'question_code tier test section question_type answer_format topic subtopic set_id set_position ' +
  'context_passage directions question_text underline options marks_correct marks_incorrect question_number';

function diOrdered(session, docs) {
  const map = {};
  docs.forEach(d => { map[String(d._id)] = d; });
  return session.question_ids.map(id => map[String(id)]).filter(Boolean);
}

// GET /api/di-tests — list every test with its tier, counts, duration + marks
app.get('/api/di-tests', async (req, res) => {
  try {
    const rows = await DiQuestion.aggregate([
      { $match: { removed: { $ne: true } } },
      { $group: { _id: { test: '$test', tier: '$tier' }, count: { $sum: 1 } } },
      { $sort: { '_id.test': 1 } },
    ]);
    const tests = rows.map(r => {
      const n = r.count;
      return {
        test: r._id.test,
        tier: r._id.tier,
        questions: n,
        duration_minutes: Math.round((n * DI_SECONDS_PER_Q) / 60),
        marks: n * 3,
      };
    });
    res.json(tests);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/di/image/:setId — serve a data-set's chart/table image (base64 in MongoDB) as a
// PNG. Public + immutable-cached: it's referenced by <img> tags (which can't send auth) and
// the data set isn't secret (answers/explanations remain withheld until submit).
app.get('/api/di/image/:setId', async (req, res) => {
  try {
    const img = await DiImage.findOne({ set_id: req.params.setId }).lean();
    if (!img || !img.b64) return res.status(404).end();
    res.set('Content-Type', img.content_type || 'image/png');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(img.b64, 'base64'));
  } catch {
    res.status(500).end();
  }
});

// POST /api/di/start — resume-first, else create a fresh session for this test
app.post('/api/di/start', authMiddleware, async (req, res) => {
  try {
    const test = Number(req.body.test);
    if (!Number.isInteger(test) || test < 1) return res.status(400).json({ error: 'invalid test' });

    let session = await DiSession.findOne({
      user_id: req.user._id, test, status: 'in_progress',
    }).sort({ createdAt: -1 });

    const docs = await DiQuestion
      .find({ test, removed: { $ne: true } }, DI_SAFE_PROJECTION)
      .sort({ question_number: 1 })
      .lean();
    if (docs.length === 0) return res.status(404).json({ error: 'No questions for this test' });

    if (!session) {
      session = await DiSession.create({
        user_id:         req.user._id,
        tier:            docs[0].tier,
        test,
        status:          'in_progress',
        question_ids:    docs.map(q => q._id),
        question_states: {},
        time_left:       docs.length * DI_SECONDS_PER_Q,
        started_at:      new Date(),
      });
    }

    const questions = diOrdered(session, docs);
    res.json({
      session_id:      session._id,
      test,
      tier:            docs[0].tier,
      questions,
      question_states: session.question_states || {},
      time_left:       session.time_left,
      status:          session.status,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/di/active?test=N — resume or read the latest session for this test
app.get('/api/di/active', authMiddleware, async (req, res) => {
  try {
    const test = Number(req.query.test);
    if (!Number.isInteger(test) || test < 1) return res.status(400).json({ error: 'invalid test' });

    let session = await DiSession.findOne({
      user_id: req.user._id, test, status: 'in_progress',
    }).sort({ createdAt: -1 }).lean();
    let isFinished = false;
    if (!session) {
      session = await DiSession.findOne({
        user_id: req.user._id, test, status: 'submitted',
      }).sort({ finished_at: -1 }).lean();
      isFinished = !!session;
    }
    if (!session) return res.json({ state: 'none' });

    const projection = isFinished ? '' : DI_SAFE_PROJECTION;
    const docs = await DiQuestion.find({ _id: { $in: session.question_ids } }, projection).lean();
    const questions = diOrdered(session, docs);

    res.json({
      state:           isFinished ? 'finished' : 'in_progress',
      session_id:      session._id,
      test,
      tier:            session.tier,
      questions,
      question_states: session.question_states || {},
      time_left:       session.time_left,
      score:           isFinished ? (session.score || null) : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/di/:sid/save — persist question_states + time_left (no scoring)
app.post('/api/di/:sid/save', authMiddleware, async (req, res) => {
  try {
    const { question_states, time_left } = req.body;
    const session = await DiSession.findOne({ _id: req.params.sid, user_id: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'in_progress') return res.status(400).json({ error: 'Session is not in progress' });

    if (question_states && typeof question_states === 'object') {
      session.question_states = question_states;
      session.markModified('question_states');
    }
    if (typeof time_left === 'number') session.time_left = time_left;
    await session.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/di/:sid/submit — server-side scoring, then reveal answers
app.post('/api/di/:sid/submit', authMiddleware, async (req, res) => {
  try {
    const { question_states, time_left } = req.body;
    const session = await DiSession.findOne({ _id: req.params.sid, user_id: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'submitted') return res.status(400).json({ error: 'Session already submitted' });

    if (question_states && typeof question_states === 'object') {
      session.question_states = question_states;
    }
    if (typeof time_left === 'number') session.time_left = time_left;
    const states = session.question_states || {};

    const docs = await DiQuestion.find({ _id: { $in: session.question_ids } }).lean();
    const qMap = {};
    docs.forEach(d => { qMap[String(d._id)] = d; });

    let correct = 0, incorrect = 0, net = 0, maxScore = 0;
    for (const qId of session.question_ids.map(String)) {
      const q = qMap[qId];
      if (!q) continue;
      maxScore += (q.marks_correct ?? 3);
      const given = normalizeAnswer((states[qId] || {}).answer, q.answer_format);
      if (!given) continue; // not attempted
      const key = normalizeAnswer(q.correct_answer, q.answer_format);
      if (given === key) {
        correct++;
        net += (q.marks_correct ?? 3);
      } else {
        incorrect++;
        net += (q.marks_incorrect ?? -1);
      }
    }

    session.score = {
      total:     net,
      attempted: correct + incorrect,
      correct,
      incorrect,
      max_score: maxScore,
    };
    session.status      = 'submitted';
    session.finished_at = new Date();
    session.markModified('question_states');
    await session.save();

    res.json({ session_id: session._id, score: session.score });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/di/sessions/:sid — full results (questions WITH answers + explanations)
app.get('/api/di/sessions/:sid', authMiddleware, async (req, res) => {
  try {
    const session = await DiSession.findOne({ _id: req.params.sid, user_id: req.user._id }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const reveal = session.status === 'submitted';
    const projection = reveal ? '' : DI_SAFE_PROJECTION;
    const docs = await DiQuestion.find({ _id: { $in: session.question_ids } }, projection).lean();
    const ordered = diOrdered(session, docs);
    const states = session.question_states || {};

    const questions = ordered.map(q => {
      const st = states[String(q._id)] || {};
      const out = { ...q, user_answer: st.answer || '', user_status: st.status || 'not-visited' };
      if (reveal) {
        out.is_correct =
          !!st.answer &&
          normalizeAnswer(st.answer, q.answer_format) === normalizeAnswer(q.correct_answer, q.answer_format);
      }
      return out;
    });

    res.json({
      session_id: session._id,
      test:       session.test,
      tier:       session.tier,
      status:     session.status,
      score:      session.score || null,
      time_left:  session.time_left,
      questions,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/di/history — list this user's submitted DI sessions
app.get('/api/di/history', authMiddleware, async (req, res) => {
  try {
    const sessions = await DiSession.find(
      { user_id: req.user._id, status: 'submitted' },
      'test tier score finished_at createdAt'
    ).sort({ createdAt: -1 }).limit(50).lean();
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;
