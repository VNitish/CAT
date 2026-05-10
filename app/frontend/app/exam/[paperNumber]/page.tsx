'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Question, QuestionState, QuestionStatus, SectionName, ExamState } from '@/lib/types';
import { DEMO_QUESTIONS } from '@/lib/demoData';
import { apiFetch } from '@/lib/auth';

const SECTION_ORDER: SectionName[] = ['VARC', 'DILR', 'QA'];
const SECTION_TIME = 40 * 60; // 40 minutes in seconds

// ── Calculator ────────────────────────────────────────────────────────────────
function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [waitNext, setWaitNext] = useState(false);

  const handleNum = (n: string) => {
    if (waitNext) { setDisplay(n); setWaitNext(false); return; }
    setDisplay(display === '0' ? n : display + n);
  };
  const handleDot = () => {
    if (waitNext) { setDisplay('0.'); setWaitNext(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  };
  const handleOp = (o: string) => {
    setPrev(display); setOp(o); setWaitNext(true);
  };
  const handleEq = () => {
    if (!prev || !op) return;
    const a = parseFloat(prev), b = parseFloat(display);
    let res = 0;
    if (op === '+') res = a + b;
    else if (op === '-') res = a - b;
    else if (op === '×') res = a * b;
    else if (op === '÷') res = b !== 0 ? a / b : 0;
    else if (op === '%') res = a % b;
    setDisplay(String(parseFloat(res.toFixed(10))));
    setPrev(null); setOp(null); setWaitNext(true);
  };
  const handleClear = () => { setDisplay('0'); setPrev(null); setOp(null); setWaitNext(false); };
  const handleBack = () => { setDisplay(display.length > 1 ? display.slice(0, -1) : '0'); };
  const handleSign = () => { setDisplay(String(-parseFloat(display))); };

  const btn = (label: string, onClick: () => void, bg = '#e0e0e0', color = '#111') => (
    <button key={label} onClick={onClick} style={{
      padding: '10px 0', background: bg, color, border: '1px solid #bbb',
      borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 'bold', width: '100%',
    }}>{label}</button>
  );

  return (
    <div style={{
      position: 'fixed', top: 80, right: 20, zIndex: 1000,
      background: '#f5f5f5', border: '2px solid #003366',
      borderRadius: 8, width: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ background: '#003366', color: 'white', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '6px 6px 0 0' }}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Calculator</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ background: 'white', border: '1px solid #ccc', borderRadius: 4, padding: '8px 10px', textAlign: 'right', fontSize: 20, fontWeight: 'bold', marginBottom: 8, minHeight: 40, wordBreak: 'break-all' }}>
          {display}
        </div>
        {op && prev && <div style={{ fontSize: 11, color: '#666', textAlign: 'right', marginBottom: 4 }}>{prev} {op}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
          {btn('C', handleClear, '#ffcccc', '#900')}
          {btn('+/-', handleSign)}
          {btn('%', () => handleOp('%'))}
          {btn('÷', () => handleOp('÷'), '#003366', 'white')}
          {btn('7', () => handleNum('7'))}
          {btn('8', () => handleNum('8'))}
          {btn('9', () => handleNum('9'))}
          {btn('×', () => handleOp('×'), '#003366', 'white')}
          {btn('4', () => handleNum('4'))}
          {btn('5', () => handleNum('5'))}
          {btn('6', () => handleNum('6'))}
          {btn('-', () => handleOp('-'), '#003366', 'white')}
          {btn('1', () => handleNum('1'))}
          {btn('2', () => handleNum('2'))}
          {btn('3', () => handleNum('3'))}
          {btn('+', () => handleOp('+'), '#003366', 'white')}
          {btn('⌫', handleBack)}
          {btn('0', () => handleNum('0'))}
          {btn('.', handleDot)}
          {btn('=', handleEq, '#cc6600', 'white')}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function statusClass(s: QuestionStatus) {
  if (s === 'not-visited') return 'q-not-visited';
  if (s === 'not-answered') return 'q-not-answered';
  if (s === 'answered') return 'q-answered';
  if (s === 'marked') return 'q-marked';
  return 'q-answered-marked';
}

function initExamState(sections: Record<SectionName, Question[]>, paperNumber: string): ExamState {
  const questionStates: Record<string, QuestionState> = {};
  Object.values(sections).flat().forEach(q => {
    questionStates[q._id] = { status: 'not-visited', answer: null };
  });
  return {
    paperNumber,
    sections: {
      VARC: { questions: sections.VARC, timeLeft: SECTION_TIME, submitted: false },
      DILR: { questions: sections.DILR, timeLeft: SECTION_TIME, submitted: false },
      QA:   { questions: sections.QA,   timeLeft: SECTION_TIME, submitted: false },
    },
    questionStates,
    currentSection: 'VARC',
    currentQuestionIndex: 0,
    started: true,
    finished: false,
  };
}

// ── Main component ────────────────────────────────────────────────────────────
function ExamPageInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const paperCode = params.paperNumber as string;
  const isDemo = searchParams.get('demo') === 'true';

  const [examState, setExamState] = useState<ExamState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [tiitaInput, setTitaInput] = useState('');
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showSectionSubmitConfirm, setShowSectionSubmitConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load questions
  useEffect(() => {
    const load = async () => {
      try {
        if (isDemo) throw new Error('demo');
        const res = await apiFetch(`/api/papers/${paperCode}/questions`);
        if (res.status === 401) { router.push('/login'); return; }
        if (res.status === 403) { router.push('/pricing'); return; }
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        const hasQuestions = Object.values(data.sections as Record<string, unknown[]>).some(arr => arr.length > 0);
        if (!hasQuestions) throw new Error('empty paper');
        setExamState(initExamState(data.sections, paperCode));
      } catch {
        setExamState(initExamState(DEMO_QUESTIONS, paperCode));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [paperCode, isDemo]);

  // Timer
  useEffect(() => {
    if (!examState || examState.finished) return;
    timerRef.current = setInterval(() => {
      setExamState(prev => {
        if (!prev) return prev;
        const sec = prev.currentSection;
        const tl = prev.sections[sec].timeLeft;
        if (tl <= 1) {
          // auto-submit section
          const newSections = { ...prev.sections, [sec]: { ...prev.sections[sec], timeLeft: 0, submitted: true } };
          const sectionIdx = SECTION_ORDER.indexOf(sec);
          if (sectionIdx < SECTION_ORDER.length - 1) {
            const nextSection = SECTION_ORDER[sectionIdx + 1];
            // Mark current first question of next section as not-visited (already default)
            return { ...prev, sections: newSections, currentSection: nextSection, currentQuestionIndex: 0 };
          } else {
            if (timerRef.current) clearInterval(timerRef.current);
            return { ...prev, sections: newSections, finished: true };
          }
        }
        return { ...prev, sections: { ...prev.sections, [sec]: { ...prev.sections[sec], timeLeft: tl - 1 } } };
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [examState?.currentSection, examState?.finished]);

  // Sync TITA input when navigating
  useEffect(() => {
    if (!examState) return;
    const q = currentQuestion(examState);
    if (q?.question_type === 'TITA') {
      const ans = examState.questionStates[q._id]?.answer;
      setTitaInput(ans || '');
      setPendingAnswer(ans);
    } else {
      setTitaInput('');
      setPendingAnswer(examState.questionStates[currentQuestion(examState)?._id || '']?.answer || null);
    }
  }, [examState?.currentQuestionIndex, examState?.currentSection]);

  // Navigate to finished page
  useEffect(() => {
    if (examState?.finished) {
      const qs = encodeURIComponent(JSON.stringify(examState.questionStates));
      router.push(`/results/${paperCode}?demo=${isDemo}&qs=${qs}`);
    }
  }, [examState?.finished]);

  const currentQuestion = (state: ExamState) => {
    const qs = state.sections[state.currentSection].questions;
    return qs[state.currentQuestionIndex] || null;
  };

  const goToQuestion = useCallback((idx: number) => {
    setExamState(prev => {
      if (!prev) return prev;
      const q = prev.sections[prev.currentSection].questions[prev.currentQuestionIndex];
      // Mark as not-answered if was not-visited and we didn't save
      const curState = prev.questionStates[q._id];
      let newQStates = { ...prev.questionStates };
      if (curState.status === 'not-visited') {
        newQStates[q._id] = { ...curState, status: 'not-answered' };
      }
      const nextQ = prev.sections[prev.currentSection].questions[idx];
      if (newQStates[nextQ._id].status === 'not-visited') {
        newQStates[nextQ._id] = { ...newQStates[nextQ._id], status: 'not-visited' };
      }
      return { ...prev, questionStates: newQStates, currentQuestionIndex: idx };
    });
    setPendingAnswer(null);
    setTitaInput('');
  }, []);

  const saveAndNext = useCallback((markForReview = false) => {
    setExamState(prev => {
      if (!prev) return prev;
      const sec = prev.currentSection;
      const qs = prev.sections[sec].questions;
      const idx = prev.currentQuestionIndex;
      const q = qs[idx];
      const ans = pendingAnswer;
      let newStatus: QuestionStatus;
      if (markForReview) {
        newStatus = ans ? 'answered-marked' : 'marked';
      } else {
        newStatus = ans ? 'answered' : 'not-answered';
      }
      const newQStates = { ...prev.questionStates, [q._id]: { status: newStatus, answer: ans } };
      const nextIdx = idx < qs.length - 1 ? idx + 1 : idx;
      // Mark next as not-answered if it was not-visited
      const nextQ = qs[nextIdx];
      if (nextIdx !== idx && newQStates[nextQ._id].status === 'not-visited') {
        newQStates[nextQ._id] = { ...newQStates[nextQ._id], status: 'not-answered' };
      }
      return { ...prev, questionStates: newQStates, currentQuestionIndex: nextIdx };
    });
    setPendingAnswer(null);
    setTitaInput('');
  }, [pendingAnswer]);

  const clearResponse = useCallback(() => {
    setPendingAnswer(null);
    setTitaInput('');
    setExamState(prev => {
      if (!prev) return prev;
      const q = currentQuestion(prev);
      if (!q) return prev;
      return { ...prev, questionStates: { ...prev.questionStates, [q._id]: { status: 'not-answered', answer: null } } };
    });
  }, []);

  const submitSection = useCallback(() => {
    setExamState(prev => {
      if (!prev) return prev;
      const sec = prev.currentSection;
      const newSections = { ...prev.sections, [sec]: { ...prev.sections[sec], submitted: true, timeLeft: 0 } };
      const sectionIdx = SECTION_ORDER.indexOf(sec);
      if (sectionIdx < SECTION_ORDER.length - 1) {
        const next = SECTION_ORDER[sectionIdx + 1];
        return { ...prev, sections: newSections, currentSection: next, currentQuestionIndex: 0 };
      } else {
        return { ...prev, sections: newSections, finished: true };
      }
    });
    setShowSectionSubmitConfirm(false);
    setShowSubmitConfirm(false);
  }, []);

  const handleSubmitAll = useCallback(() => {
    setExamState(prev => {
      if (!prev) return prev;
      const newSections = { ...prev.sections };
      SECTION_ORDER.forEach(s => { newSections[s] = { ...newSections[s], submitted: true }; });
      return { ...prev, sections: newSections, finished: true };
    });
    setShowSubmitConfirm(false);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8e8', color: '#111111', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '4px solid #003366', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ color: '#003366', fontWeight: 'bold', fontSize: 16 }}>Loading exam paper…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!examState) return null;

  const state = examState;
  const sec = state.currentSection;
  const sectionData = state.sections[sec];
  const questions = sectionData.questions;
  const q = questions[state.currentQuestionIndex];
  if (!q) return null;
  const timeLeft = sectionData.timeLeft;
  const timePercent = (timeLeft / SECTION_TIME) * 100;
  const timeColor = timeLeft < 300 ? '#cc0000' : timeLeft < 600 ? '#ff8800' : '#003366';

  // Stats for palette header
  const sectionQStates = questions.map(qq => state.questionStates[qq._id]);
  const answeredCount = sectionQStates.filter(s => s.status === 'answered' || s.status === 'answered-marked').length;
  const notAnsweredCount = sectionQStates.filter(s => s.status === 'not-answered').length;
  const markedCount = sectionQStates.filter(s => s.status === 'marked').length;
  const notVisitedCount = sectionQStates.filter(s => s.status === 'not-visited').length;
  const answMarkedCount = sectionQStates.filter(s => s.status === 'answered-marked').length;

  // Find set context passage — show if current q has one, or set siblings do
  const passage = q.context_passage;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#d6d6d6', color: '#111111', fontFamily: 'Arial, Helvetica, sans-serif' }}>

      {/* ── Top Bar ── */}
      <div style={{ background: '#003366', color: 'white', padding: '0 12px', display: 'flex', alignItems: 'stretch', borderBottom: '2px solid #cc6600', minHeight: 44, flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ width: 30, height: 30, background: '#cc6600', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 13 }}>C</div>
          <div style={{ fontSize: 12, fontWeight: 'bold', lineHeight: 1.2 }}>CAT Mock<br /><span style={{ color: '#aac4ff', fontSize: 10, fontWeight: 'normal' }}>{paperCode.replace(/_/g, ' ')}</span></div>
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, paddingLeft: 8 }}>
          {SECTION_ORDER.map(s => {
            const isActive = s === sec;
            const isSubmitted = state.sections[s].submitted;
            return (
              <div key={s} style={{
                display: 'flex', alignItems: 'center', padding: '0 16px', cursor: 'default',
                background: isActive ? '#cc6600' : 'transparent',
                borderBottom: isActive ? '3px solid #ff9900' : '3px solid transparent',
                color: isActive ? 'white' : isSubmitted ? '#88a8cc' : '#aac4ff',
                fontSize: 13, fontWeight: isActive ? 'bold' : 'normal',
                transition: 'all 0.15s', userSelect: 'none',
              }}>
                {s} {isSubmitted && !isActive ? '✓' : ''}
              </div>
            );
          })}
        </div>

        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#aac4ff' }}>Time Left</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: timeColor === '#003366' ? 'white' : timeColor, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
              {formatTime(timeLeft)}
            </div>
          </div>
          {/* Time bar */}
          <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${timePercent}%`, height: '100%', background: timeLeft < 300 ? '#ff4444' : timeLeft < 600 ? '#ffaa00' : '#4caf50', transition: 'width 1s' }} />
          </div>
        </div>

        {/* User + buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
          <button onClick={() => setShowCalc(v => !v)} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
            🧮 Calc
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 30, height: 30, background: '#cc6600', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 13 }}>S</div>
            <div style={{ fontSize: 11, lineHeight: 1.3 }}>
              <div style={{ fontWeight: 'bold' }}>Student</div>
              <div style={{ color: '#aac4ff', fontSize: 10 }}>Mock Exam</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Marks info bar ── */}
      <div style={{ background: '#e8f0fe', borderBottom: '1px solid #c5d5f5', padding: '4px 16px', fontSize: 11, color: '#333', display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
        <span>Marks for correct answer: <strong style={{ color: '#228B22' }}>+{q.marks_correct}</strong></span>
        <span>|</span>
        <span>Negative Marks: <strong style={{ color: '#cc3300' }}>{q.marks_incorrect}</strong></span>
        <span style={{ marginLeft: 'auto', color: '#555' }}>Section: <strong>{sec}</strong> · Q {state.currentQuestionIndex + 1} of {questions.length}</span>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left: Question Area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', background: 'white' }}>

            {/* Context passage */}
            {passage && (
              <div style={{ background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 4, padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.8, color: '#222', maxHeight: 280, overflow: 'auto' }}>
                <div style={{ fontWeight: 'bold', fontSize: 11, color: '#003366', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Read the passage carefully and answer the questions that follow:</div>
                <div style={{ whiteSpace: 'pre-line' }}>{passage}</div>
              </div>
            )}

            {/* Question */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 10, color: '#003366' }}>Question No. {state.currentQuestionIndex + 1}</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: '#111', marginBottom: 16 }}>{q.question_text}</div>

              {/* MCQ options */}
              {q.question_type === 'MCQ' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {q.options.map(opt => {
                    const selected = pendingAnswer === opt.label;
                    return (
                      <label key={opt.label} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                        padding: '10px 14px', borderRadius: 4, fontSize: 14,
                        background: selected ? '#e8f0fe' : '#f9f9f9',
                        border: selected ? '2px solid #003399' : '1px solid #ddd',
                        transition: 'all 0.1s',
                      }}>
                        <input
                          type="radio"
                          name="mcq"
                          checked={selected}
                          onChange={() => setPendingAnswer(opt.label)}
                          style={{ marginTop: 2, accentColor: '#003399', width: 16, height: 16, flexShrink: 0 }}
                        />
                        <span><strong>{opt.label}.</strong> {opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* TITA input */}
              {q.question_type === 'TITA' && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#555' }}>
                    Enter your answer (numbers only):
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tiitaInput}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.\-]/g, '');
                      setTitaInput(val);
                      setPendingAnswer(val || null);
                    }}
                    style={{
                      border: '2px solid #003399', borderRadius: 4, padding: '10px 14px',
                      fontSize: 18, fontWeight: 'bold', width: 180, outline: 'none',
                      color: '#003366',
                    }}
                    placeholder="Type answer here"
                  />
                  <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>No negative marking for TITA questions</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom action buttons ── */}
          <div style={{ background: '#f0f0f0', borderTop: '2px solid #ccc', padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={() => saveAndNext(true)}
              style={{ padding: '8px 16px', background: '#7B2FBE', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
            >
              Mark for Review &amp; Next
            </button>
            <button
              onClick={clearResponse}
              style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
            >
              Clear Response
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => saveAndNext(false)}
              style={{ padding: '8px 20px', background: '#228B22', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
            >
              Save &amp; Next
            </button>
            <button
              onClick={() => {
                const sectionIdx = SECTION_ORDER.indexOf(sec);
                if (sectionIdx < SECTION_ORDER.length - 1) setShowSectionSubmitConfirm(true);
                else setShowSubmitConfirm(true);
              }}
              style={{ padding: '8px 20px', background: '#003366', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
            >
              Submit
            </button>
          </div>
        </div>

        {/* ── Right: Question Palette ── */}
        {!paletteCollapsed ? (
          <div style={{ width: 220, background: '#e8e8e8', borderLeft: '2px solid #ccc', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            {/* Collapse button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#003366', color: 'white' }}>
              <span style={{ fontSize: 12, fontWeight: 'bold' }}>{sec}</span>
              <button onClick={() => setPaletteCollapsed(true)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', color: 'white', borderRadius: 3, cursor: 'pointer', fontSize: 11, padding: '1px 6px' }}>◀</button>
            </div>

            {/* Stats */}
            <div style={{ padding: '8px 10px', background: 'white', borderBottom: '1px solid #ccc', fontSize: 11 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="q-answered" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{answeredCount} Answered</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="q-not-answered" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{notAnsweredCount} Not Ans.</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="q-marked" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{markedCount} Marked</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="q-not-visited" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{notVisitedCount} Not Visited</span></div>
                {answMarkedCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4, gridColumn: '1/-1' }}><span className="q-answered-marked" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{answMarkedCount} Ans+Marked</span></div>}
              </div>
            </div>

            {/* Choose a question header */}
            <div style={{ padding: '6px 10px', background: '#f0f0f0', borderBottom: '1px solid #ccc', fontSize: 11, fontWeight: 'bold', color: '#003366' }}>
              Choose a Question
            </div>

            {/* Question grid */}
            <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
                {questions.map((qq, idx) => {
                  const qs = state.questionStates[qq._id];
                  const isCurrent = idx === state.currentQuestionIndex;
                  return (
                    <button
                      key={qq._id}
                      onClick={() => goToQuestion(idx)}
                      className={statusClass(qs.status)}
                      style={{
                        width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', borderRadius: '50%', cursor: 'pointer',
                        fontSize: 12, fontWeight: 'bold',
                        outline: isCurrent ? '3px solid #cc6600' : 'none',
                        outlineOffset: 1,
                        border: isCurrent ? '2px solid #cc6600' : undefined,
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div style={{ padding: '8px 10px', background: 'white', borderTop: '1px solid #ccc', fontSize: 10 }}>
              {[
                { cls: 'q-not-visited', label: 'Not Visited' },
                { cls: 'q-not-answered', label: 'Not Answered' },
                { cls: 'q-answered', label: 'Answered' },
                { cls: 'q-marked', label: 'Marked for Review' },
                { cls: 'q-answered-marked', label: 'Answered & Marked' },
              ].map(item => (
                <div key={item.cls} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span className={item.cls} style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', flexShrink: 0 }} />
                  <span style={{ color: '#333' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ width: 24, background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderLeft: '2px solid #ccc' }}>
            <button onClick={() => setPaletteCollapsed(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', writingMode: 'vertical-rl', fontSize: 11, fontWeight: 'bold', padding: 4 }}>▶ Palette</button>
          </div>
        )}
      </div>

      {/* ── Calculator ── */}
      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}

      {/* ── Section Submit Confirm Modal ── */}
      {showSectionSubmitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', borderRadius: 8, padding: 28, maxWidth: 440, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#003366' }}>Submit Section: {sec}?</h3>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
              <p style={{ margin: '0 0 8px' }}>You are about to submit <strong>{sec}</strong> and move to the next section. This action cannot be undone.</p>
            </div>
            <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
              <div>Answered: <strong>{answeredCount + answMarkedCount}</strong></div>
              <div>Not Answered: <strong>{notAnsweredCount}</strong></div>
              <div>Marked for Review: <strong>{markedCount}</strong></div>
              <div>Not Visited: <strong>{notVisitedCount}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSectionSubmitConfirm(false)} style={{ padding: '8px 20px', background: '#666', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={submitSection} style={{ padding: '8px 20px', background: '#003366', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>Submit &amp; Continue →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Final Submit Confirm Modal ── */}
      {showSubmitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', borderRadius: 8, padding: 28, maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#cc3300' }}>Submit Entire Exam?</h3>
            <p style={{ fontSize: 13, color: '#555', margin: '0 0 16px' }}>You are about to submit the complete exam. This cannot be undone. Please review your attempt summary below.</p>
            <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
              {SECTION_ORDER.map(s => {
                const sqs = state.sections[s].questions.map(qq => state.questionStates[qq._id]);
                const ans = sqs.filter(ss => ss.status === 'answered' || ss.status === 'answered-marked').length;
                const notAns = sqs.filter(ss => ss.status === 'not-answered').length;
                const mrk = sqs.filter(ss => ss.status === 'marked').length;
                const nv = sqs.filter(ss => ss.status === 'not-visited').length;
                return (
                  <div key={s} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: s !== 'QA' ? '1px solid #ddd' : 'none' }}>
                    <strong style={{ color: '#003366' }}>{s}</strong>: {ans} answered, {notAns} not answered, {mrk} marked, {nv} not visited
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSubmitConfirm(false)} style={{ padding: '8px 20px', background: '#666', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSubmitAll} style={{ padding: '8px 24px', background: '#cc3300', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>Submit Exam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8e8', color: '#111111', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '4px solid #003366', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ color: '#003366', fontWeight: 'bold', fontSize: 16 }}>Loading exam paper…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <ExamPageInner />
    </Suspense>
  );
}
