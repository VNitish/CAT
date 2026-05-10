const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 12;
const FREE_PAPERS = new Set(['CAT_2025_S1', 'CAT_2025_S2', 'CAT_2025_S3']);

// ── MongoDB connection ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_STRING)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err.message));

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

const Question     = mongoose.model('Question', questionSchema);
const QuestionPaper = mongoose.model('QuestionPaper', paperSchema);
const ExamPaper    = mongoose.model('ExamPaper', examPaperSchema);
const User         = mongoose.model('User', userSchema);
const Attempt      = mongoose.model('Attempt', attemptSchema);

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
