'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import MathText from '@/app/components/MathText';
import Calculator from '@/app/components/Calculator';

const DEFAULT_TIME = 40 * 60; // placeholder until the server returns the real per-test time

type QStatus = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'answered-marked';
interface VOption { label: string; text: string; }
interface VQuestion {
  _id: string;
  question_code: string;
  question_type: 'MCQ' | 'TITA';
  answer_format: 'option' | 'sequence';
  topic: string;
  set_id: string;
  set_position: number;
  context_passage: string;
  directions: string;
  question_text: string;
  underline?: string;
  options: VOption[] | null;
  marks_correct: number;
  marks_incorrect: number;
  question_number: number;
}
interface QState { status: QStatus; answer: string | null }

function formatTime(s: number) {
  const neg = s < 0;
  const a = Math.abs(s);
  const m = Math.floor(a / 60);
  const sec = a % 60;
  return `${neg ? '-' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function QuestionText({ text, underline }: { text: string; underline?: string }) {
  if (underline && text.includes(underline)) {
    const i = text.indexOf(underline);
    return (
      <span>
        {text.slice(0, i)}
        <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{underline}</span>
        {text.slice(i + underline.length)}
      </span>
    );
  }
  return <MathText>{text}</MathText>;
}

function statusClass(s: QStatus) {
  if (s === 'not-visited') return 'q-not-visited';
  if (s === 'not-answered') return 'q-not-answered';
  if (s === 'answered') return 'q-answered';
  if (s === 'marked') return 'q-marked';
  return 'q-answered-marked';
}

function RcExamInner() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<VQuestion[]>([]);
  const [qStates, setQStates] = useState<Record<string, QState>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME);
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const [seqInput, setSeqInput] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeLeftRef = useRef(DEFAULT_TIME);
  const qStatesRef = useRef<Record<string, QState>>({});
  const submittedRef = useRef(false);
  timeLeftRef.current = timeLeft;
  qStatesRef.current = qStates;

  // ── Load (resume-first) ──
  useEffect(() => {
    const test = Number(testId);
    if (!(Number.isInteger(test) && test >= 1 && test <= 10)) { setError('Invalid test'); setLoading(false); return; }
    (async () => {
      try {
        const res = await apiFetch('/api/rc/start', {
          method: 'POST',
          body: JSON.stringify({ test }),
        });
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) throw new Error('Could not start the test');
        const data = await res.json();
        const qs: VQuestion[] = data.questions || [];
        const states: Record<string, QState> = { ...(data.question_states || {}) };
        qs.forEach(q => { if (!states[q._id]) states[q._id] = { status: 'not-visited', answer: null }; });
        setQuestions(qs);
        setQStates(states);
        setSessionId(data.session_id);
        setTimeLeft(typeof data.time_left === 'number' ? data.time_left : DEFAULT_TIME);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  // ── Timer: count down, allow negative, never auto-submit ──
  useEffect(() => {
    if (loading || error || !sessionId) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => t - 1);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, error, sessionId]);

  // ── Persist helper ──
  const persist = useCallback(async () => {
    if (!sessionId || submittedRef.current) return;
    setSaveState('saving');
    try {
      const res = await apiFetch(`/api/rc/${sessionId}/save`, {
        method: 'POST',
        body: JSON.stringify({ question_states: qStatesRef.current, time_left: timeLeftRef.current }),
      });
      setSaveState(res.ok ? 'saved' : 'idle');
    } catch {
      setSaveState('idle');
    }
  }, [sessionId]);

  // ── Debounced save when answers/states change ──
  useEffect(() => {
    if (!sessionId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(persist, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [qStates, sessionId, persist]);

  // ── Periodic save of the clock (so resume restores remaining time) ──
  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(persist, 20000);
    return () => clearInterval(id);
  }, [sessionId, persist]);

  // ── Sync pending answer when navigating ──
  const q: VQuestion | undefined = questions[currentIdx];
  useEffect(() => {
    if (!q) return;
    const ans = qStates[q._id]?.answer ?? null;
    setPendingAnswer(ans);
    if (q.answer_format === 'sequence') setSeqInput(ans || '');
    else setSeqInput('');
    setQStates(prev => {
      const cur = prev[q._id];
      if (cur && cur.status === 'not-visited') {
        return { ...prev, [q._id]: { ...cur, status: 'not-answered' } };
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, q?._id]);

  const goTo = useCallback((idx: number) => {
    setCurrentIdx(idx);
  }, []);

  const commit = useCallback((markForReview: boolean, advance: boolean) => {
    if (!q) return;
    const ans = pendingAnswer;
    const status: QStatus = markForReview
      ? (ans ? 'answered-marked' : 'marked')
      : (ans ? 'answered' : 'not-answered');
    setQStates(prev => ({ ...prev, [q._id]: { status, answer: ans } }));
    if (advance && currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1);
  }, [q, pendingAnswer, currentIdx, questions.length]);

  const clearResponse = useCallback(() => {
    if (!q) return;
    setPendingAnswer(null);
    setSeqInput('');
    setQStates(prev => ({ ...prev, [q._id]: { status: 'not-answered', answer: null } }));
  }, [q]);

  const saveAndExit = useCallback(async () => {
    commit(false, false);
    setTimeout(async () => { await persist(); router.push('/rc'); }, 100);
  }, [commit, persist, router]);

  const doSubmit = useCallback(async () => {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    submittedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    const finalStates: Record<string, QState> = { ...qStatesRef.current };
    if (q) {
      const existing = finalStates[q._id];
      const ans = pendingAnswer;
      const status: QStatus = ans ? (existing?.status === 'marked' || existing?.status === 'answered-marked' ? 'answered-marked' : 'answered') : (existing?.status || 'not-answered');
      finalStates[q._id] = { status, answer: ans };
    }
    try {
      const res = await apiFetch(`/api/rc/${sessionId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ question_states: finalStates, time_left: timeLeftRef.current }),
      });
      if (!res.ok) throw new Error('submit failed');
      router.push(`/rc/${testId}/results?sid=${sessionId}`);
    } catch {
      setSubmitting(false);
      submittedRef.current = false;
      setError('Submission failed. Please try again.');
    }
  }, [sessionId, submitting, q, pendingAnswer, router, testId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8e8', color: '#003366', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '4px solid #003366', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontWeight: 'bold', fontSize: 16 }}>Loading test…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8e8', color: '#cc3300', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontWeight: 'bold' }}>{error}</div>
        <button onClick={() => router.push('/rc')} style={{ padding: '8px 20px', background: '#003366', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Back to RC</button>
      </div>
    );
  }
  if (!q) return null;

  const states = questions.map(qq => qStates[qq._id] || { status: 'not-visited', answer: null });
  const answeredCount = states.filter(s => s.status === 'answered' || s.status === 'answered-marked').length;
  const notAnsweredCount = states.filter(s => s.status === 'not-answered').length;
  const markedCount = states.filter(s => s.status === 'marked').length;
  const notVisitedCount = states.filter(s => s.status === 'not-visited').length;
  const answMarkedCount = states.filter(s => s.status === 'answered-marked').length;

  const overtime = timeLeft < 0;
  const timeColor = overtime ? '#cc6600' : 'white';
  const passage = q.context_passage;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#d6d6d6', color: '#111111', fontFamily: 'Arial, Helvetica, sans-serif' }}>

      {/* Top Bar */}
      <div style={{ background: '#003366', color: 'white', padding: '0 12px', display: 'flex', alignItems: 'stretch', borderBottom: '2px solid #cc6600', minHeight: 44, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ width: 30, height: 30, background: '#cc6600', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 13 }}>C</div>
          <div style={{ fontSize: 12, fontWeight: 'bold', lineHeight: 1.2 }}>RC Mock<br /><span style={{ color: '#aac4ff', fontSize: 10, fontWeight: 'normal' }}>Test {testId}</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, paddingLeft: 16 }}>
          <div style={{ padding: '0 16px', background: '#cc6600', display: 'flex', alignItems: 'center', height: '100%', fontSize: 13, fontWeight: 'bold' }}>Reading Comprehension</div>
        </div>

        {/* Save indicator */}
        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 14, fontSize: 11, color: '#aac4ff' }}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : ''}
        </div>

        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 8 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#aac4ff' }}>{overtime ? 'Overtime' : 'Time Left'}</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: timeColor, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* Calc */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.2)', marginLeft: 12 }}>
          <button onClick={() => setShowCalc(v => !v)} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>🧮 Calc</button>
        </div>
      </div>

      {/* Marks info bar */}
      <div style={{ background: '#e8f0fe', borderBottom: '1px solid #c5d5f5', padding: '4px 16px', fontSize: 11, color: '#333', display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
        <span>Marks for correct answer: <strong style={{ color: '#228B22' }}>+{q.marks_correct}</strong></span>
        <span>|</span>
        <span>Negative Marks: <strong style={{ color: '#cc3300' }}>{q.marks_incorrect}</strong></span>
        <span style={{ marginLeft: 'auto', color: '#555' }}>{q.topic} · Q {currentIdx + 1} of {questions.length}</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Question Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', background: 'white' }}>

            {q.directions && (
              <div style={{ fontSize: 12, fontStyle: 'italic', color: '#555', marginBottom: 10 }}>
                <MathText inline>{q.directions}</MathText>
              </div>
            )}

            {passage && (
              <div style={{ background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 4, padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.8, color: '#222', maxHeight: 320, overflow: 'auto' }}>
                <div style={{ fontWeight: 'bold', fontSize: 11, color: '#003366', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Passage</div>
                <div style={{ whiteSpace: 'pre-line' }}>{passage}</div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 10, color: '#003366' }}>Question No. {currentIdx + 1}</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: '#111', marginBottom: 16 }}><QuestionText text={q.question_text} underline={q.underline} /></div>

              {q.answer_format === 'option' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {q.options.map(opt => {
                    const selected = pendingAnswer === opt.label;
                    return (
                      <label key={opt.label} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                        padding: '10px 14px', borderRadius: 4, fontSize: 14,
                        background: selected ? '#e8f0fe' : '#f9f9f9',
                        border: selected ? '2px solid #003399' : '1px solid #ddd',
                      }}>
                        <input
                          type="radio"
                          name="mcq"
                          checked={selected}
                          onChange={() => setPendingAnswer(opt.label)}
                          style={{ marginTop: 2, accentColor: '#003399', width: 16, height: 16, flexShrink: 0 }}
                        />
                        <span><strong>{opt.label}.</strong> <MathText inline>{opt.text}</MathText></span>
                      </label>
                    );
                  })}
                </div>
              )}

              {q.answer_format === 'sequence' && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#555' }}>
                    Type the correct order of the labelled sentences (e.g. CBADE):
                  </label>
                  <input
                    type="text"
                    value={seqInput}
                    onChange={e => {
                      const val = e.target.value.toUpperCase().replace(/[^A-E]/g, '');
                      setSeqInput(val);
                      setPendingAnswer(val || null);
                    }}
                    style={{
                      border: '2px solid #003399', borderRadius: 4, padding: '10px 14px',
                      fontSize: 18, fontWeight: 'bold', width: 220, outline: 'none',
                      color: '#003366', letterSpacing: 4, textTransform: 'uppercase',
                    }}
                    placeholder="e.g. CBADE"
                  />
                  <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>No negative marking for this question type</div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom action buttons */}
          <div style={{ background: '#f0f0f0', borderTop: '2px solid #ccc', padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={() => commit(true, true)} style={{ padding: '8px 16px', background: '#7B2FBE', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
              Mark for Review &amp; Next
            </button>
            <button onClick={clearResponse} style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
              Clear Response
            </button>
            <button onClick={saveAndExit} style={{ padding: '8px 16px', background: '#0a7', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
              Save &amp; Exit
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => commit(false, true)} style={{ padding: '8px 20px', background: '#228B22', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
              Save &amp; Next
            </button>
            <button onClick={() => { commit(false, false); setShowSubmitConfirm(true); }} style={{ padding: '8px 20px', background: '#003366', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
              Submit
            </button>
          </div>
        </div>

        {/* Palette */}
        {!paletteCollapsed ? (
          <div style={{ width: 220, background: '#e8e8e8', borderLeft: '2px solid #ccc', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#003366', color: 'white' }}>
              <span style={{ fontSize: 12, fontWeight: 'bold' }}>Reading Comprehension</span>
              <button onClick={() => setPaletteCollapsed(true)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', color: 'white', borderRadius: 3, cursor: 'pointer', fontSize: 11, padding: '1px 6px' }}>◀</button>
            </div>
            <div style={{ padding: '8px 10px', background: 'white', borderBottom: '1px solid #ccc', fontSize: 11 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="q-answered" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{answeredCount} Answered</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="q-not-answered" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{notAnsweredCount} Not Ans.</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="q-marked" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{markedCount} Marked</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="q-not-visited" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{notVisitedCount} Not Visited</span></div>
                {answMarkedCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4, gridColumn: '1/-1' }}><span className="q-answered-marked" style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%' }} /><span>{answMarkedCount} Ans+Marked</span></div>}
              </div>
            </div>
            <div style={{ padding: '6px 10px', background: '#f0f0f0', borderBottom: '1px solid #ccc', fontSize: 11, fontWeight: 'bold', color: '#003366' }}>Choose a Question</div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
                {questions.map((qq, idx) => {
                  const st = qStates[qq._id] || { status: 'not-visited', answer: null };
                  const isCurrent = idx === currentIdx;
                  return (
                    <button
                      key={qq._id}
                      onClick={() => goTo(idx)}
                      className={statusClass(st.status)}
                      style={{
                        width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', borderRadius: '50%', cursor: 'pointer',
                        fontSize: 12, fontWeight: 'bold',
                        outline: isCurrent ? '3px solid #cc6600' : 'none', outlineOffset: 1,
                        border: isCurrent ? '2px solid #cc6600' : undefined,
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
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

      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}

      {showSubmitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', borderRadius: 8, padding: 28, maxWidth: 460, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#cc3300' }}>Submit Test?</h3>
            <p style={{ fontSize: 13, color: '#555', margin: '0 0 16px' }}>You are about to submit Reading Comprehension Test {testId}. This cannot be undone.</p>
            <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
              <div>Answered: <strong>{answeredCount + answMarkedCount}</strong></div>
              <div>Not Answered: <strong>{notAnsweredCount}</strong></div>
              <div>Marked for Review: <strong>{markedCount}</strong></div>
              <div>Not Visited: <strong>{notVisitedCount}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSubmitConfirm(false)} disabled={submitting} style={{ padding: '8px 20px', background: '#666', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={doSubmit} disabled={submitting} style={{ padding: '8px 24px', background: '#cc3300', color: 'white', border: 'none', borderRadius: 4, cursor: submitting ? 'wait' : 'pointer', fontSize: 13, fontWeight: 'bold' }}>{submitting ? 'Submitting…' : 'Submit Test'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RcExamPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8e8', color: '#003366', fontWeight: 'bold' }}>Loading test…</div>
    }>
      <RcExamInner />
    </Suspense>
  );
}
