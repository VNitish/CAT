'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/auth';
import MathText from '@/app/components/MathText';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

const LOD_COLOR: Record<number, string> = { 1: '#00C48C', 2: '#378ADD', 3: '#9B6DFF' };
const LOD_LABEL: Record<number, string>  = { 1: 'LOD I', 2: 'LOD II', 3: 'LOD III' };

interface Options { a: string; b: string; c: string; d: string; }

interface PracticeQ {
  _id: string;
  question: string;
  question_latex?: string;
  question_type: string;
  options: Options;
  options_latex?: Options;
  lod: number;
  difficulty: string;
  question_number: number;
  directions?: string;
  directions_latex?: string;
  correct_answer?: string;
  solution?: string;
  solution_latex?: string;
  user_answer?: string;
  is_correct?: boolean;
}

interface ChapterInfo {
  chapter_id: number;
  topic: string;
  block: string;
  counts: { total: number; easy: number; medium: number; hard: number };
}

interface Score { total: number; correct: number; incorrect: number; skipped: number; }

type Phase = 'loading' | 'practicing' | 'submitting' | 'results';

export default function QuantChapterPage() {
  const router  = useRouter();
  const params  = useParams();
  const chapId  = Number(params?.chapterId);

  const { user, loading: authLoading } = useAuth();

  const [phase,     setPhase]     = useState<Phase>('loading');
  const [chapter,   setChapter]   = useState<ChapterInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PracticeQ[]>([]);
  const [answers,   setAnswers]   = useState<Record<string, string>>({});
  const [score,     setScore]     = useState<Score | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [retryKey,  setRetryKey]  = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Debounced incremental save of in-progress answers
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule a save whenever answers change while practicing
  useEffect(() => {
    if (phase !== 'practicing') return;
    if (!sessionId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/practice/${sessionId}/save`, {
          method: 'POST',
          body: JSON.stringify({ responses: answers }),
        });
        if (res.ok) setSaveState('saved');
        else setSaveState('idle');
      } catch {
        setSaveState('idle');
      }
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [answers, sessionId, phase]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    setPhase('loading');
    setError(null);
    setAnswers({});
    setScore(null);
    setQuestions([]);
    setSessionId(null);

    fetch('/api/quant-chapters')
      .then(r => r.json())
      .then(async (chs: ChapterInfo[]) => {
        const ch = chs.find(c => c.chapter_id === chapId);
        if (!ch) { setError('Chapter not found'); setPhase('results'); return; }
        setChapter(ch);

        // 1) Try to resume an existing session for this topic
        const activeRes = await apiFetch(`/api/practice/active?topic=${encodeURIComponent(ch.topic)}`);
        if (activeRes.ok) {
          const active = await activeRes.json();
          if (active.state === 'in_progress') {
            setSessionId(active.session_id);
            setQuestions(active.questions);
            setAnswers(active.responses || {});
            setPhase('practicing');
            return;
          }
          if (active.state === 'finished') {
            setSessionId(active.session_id);
            setQuestions(active.questions);
            setScore(active.score);
            setPhase('results');
            return;
          }
        }

        // 2) No existing session — create a fresh one
        const res = await apiFetch('/api/practice/start', {
          method: 'POST',
          body: JSON.stringify({ topic: ch.topic, lod: null, limit: 30 }),
        });
        if (!res.ok) { setError('Failed to load questions — is the question bank seeded?'); setPhase('results'); return; }
        const data = await res.json();
        setSessionId(data.session_id);
        setQuestions(data.questions);
        setPhase('practicing');
      })
      .catch(() => { setError('Connection error — is the backend running?'); setPhase('results'); });
  }, [authLoading, user, chapId, retryKey, router]);

  const handleSubmit = async () => {
    if (!sessionId) return;
    // Flush any pending debounced save first
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    setPhase('submitting');
    try {
      const res = await apiFetch(`/api/practice/${sessionId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ responses: answers }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setScore(data.score);
      setQuestions(data.questions);
      setPhase('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setPhase('practicing');
    }
  };

  const handlePracticeAgain = async () => {
    if (!chapter) return;
    // Reset UI state + start a brand-new session on the server (abandons any prior in-progress)
    setAnswers({});
    setScore(null);
    setQuestions([]);
    setSessionId(null);
    setRetryKey(k => k + 1);
    // The effect on [retryKey] will re-fetch active (which will be 'none' after start) and POST /start.
    // Force-create here directly so we skip the "show finished session" branch:
    setPhase('loading');
    try {
      const res = await apiFetch('/api/practice/start', {
        method: 'POST',
        body: JSON.stringify({ topic: chapter.topic, lod: null, limit: 30 }),
      });
      if (!res.ok) { setError('Failed to start new session'); setPhase('results'); return; }
      const data = await res.json();
      setSessionId(data.session_id);
      setQuestions(data.questions);
      setAnswers({});
      setPhase('practicing');
    } catch {
      setError('Connection error');
      setPhase('results');
    }
  };

  const answered = Object.keys(answers).length;

  if (authLoading || phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 22, height: 22, border: '2px solid #378ADD', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, color: '#777', fontFamily: F }}>Loading questions…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: F, color: '#222222' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#121212', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>P</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: -0.3 }}>PaperRoom</span>
          </div>
          <div style={{ width: 1, height: 16, background: '#2a2a2a' }} />
          <span onClick={() => router.push('/quant')} style={{ fontSize: 13, color: '#555555', cursor: 'pointer' }}>Quant Practice</span>
          {chapter && (
            <>
              <div style={{ width: 1, height: 16, background: '#2a2a2a' }} />
              <span style={{ fontSize: 13, color: '#888888' }}>{chapter.topic}</span>
            </>
          )}
        </div>
        {phase === 'practicing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: saveState === 'saving' ? '#777' : '#00C48C', minWidth: 38, fontFamily: F }}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : ''}
            </span>
            <span style={{ fontSize: 12, color: '#555' }}>{answered} / {questions.length} answered</span>
            <button
              onClick={handleSubmit}
              style={{ padding: '7px 18px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer', transition: 'background 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#00a876'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#00C48C'; }}
            >
              Submit
            </button>
          </div>
        )}
      </nav>

      {/* Chapter header */}
      {chapter && phase !== 'results' && (
        <div style={{ borderBottom: '1px solid #e4e4e4', background: '#ffffff' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#aaaaaa', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{chapter.block} · Ch {chapId}</div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#121212', letterSpacing: -0.3 }}>{chapter.topic}</h1>
            </div>
            <div style={{ fontSize: 13, color: '#777' }}>{questions.length} questions &nbsp;·&nbsp; Unlimited time</div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 40px 100px' }}>

        {/* Error state */}
        {error && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 16 }}>{error}</div>
            <button onClick={() => router.push('/quant')} style={{ padding: '9px 20px', background: '#378ADD', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
              Back to chapters
            </button>
          </div>
        )}

        {/* Results summary bar */}
        {phase === 'results' && score && (
          <div style={{ background: '#121212', padding: '28px 32px', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>Result — {chapter?.topic}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#ffffff', letterSpacing: -0.5 }}>
                {score.correct} <span style={{ fontSize: 16, color: '#555', fontWeight: 400 }}>/ {score.total}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 28 }}>
              {[
                { label: 'Correct',   val: score.correct,   color: '#00C48C' },
                { label: 'Incorrect', val: score.incorrect, color: '#ef4444' },
                { label: 'Skipped',   val: score.skipped,   color: '#555555' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push('/quant')}
              style={{ padding: '9px 20px', background: 'transparent', color: '#666', border: '1px solid #2a2a2a', fontSize: 12, fontFamily: F, cursor: 'pointer' }}
            >
              All chapters
            </button>
          </div>
        )}

        {/* Question list */}
        {questions.map((q, idx) => {
          const isResults  = phase === 'results';
          const selected   = answers[q._id];
          const correct    = q.correct_answer;
          const isCorrect  = q.is_correct;
          const userAns    = q.user_answer;

          return (
            <div
              key={q._id}
              id={`q-${idx + 1}`}
              style={{
                background: '#ffffff',
                border: isResults
                  ? `1px solid ${isCorrect ? '#b3eedd' : userAns ? '#fca5a5' : '#e4e4e4'}`
                  : '1px solid #e4e4e4',
                marginBottom: 16,
                overflow: 'hidden',
              }}
            >
              {/* Question header strip */}
              <div style={{
                padding: '10px 18px',
                background: isResults
                  ? (isCorrect ? '#e6faf5' : userAns ? '#fef2f2' : '#f9fafb')
                  : '#f9fafb',
                borderBottom: '1px solid #eeeeee',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#999', minWidth: 28 }}>Q{idx + 1}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: LOD_COLOR[q.lod],
                  background: `${LOD_COLOR[q.lod]}18`,
                  border: `1px solid ${LOD_COLOR[q.lod]}44`,
                  padding: '2px 7px', letterSpacing: 0.4,
                }}>
                  {LOD_LABEL[q.lod] ?? q.difficulty}
                </span>
                {isResults && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 11, fontWeight: 700,
                    color: isCorrect ? '#00a876' : userAns ? '#dc2626' : '#999',
                  }}>
                    {isCorrect ? '✓ Correct' : userAns ? '✗ Incorrect' : '— Skipped'}
                  </span>
                )}
                {!isResults && selected && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#378ADD', fontWeight: 600 }}>
                    Selected {selected.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: '18px 20px 22px' }}>
                {(q.directions_latex || q.directions) && (
                  <div style={{ fontSize: 12, color: '#777', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.6 }}>
                    <MathText>{q.directions_latex || q.directions || ''}</MathText>
                  </div>
                )}
                <div style={{ fontSize: 14, color: '#111', lineHeight: 1.7, marginBottom: 18 }}>
                  <MathText>{q.question_latex || q.question}</MathText>
                </div>

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {(['a', 'b', 'c', 'd'] as const).map(opt => {
                    const text = (q.options_latex && q.options_latex[opt]) || q.options[opt];
                    if (!text) return null;

                    const isSelectedOpt  = isResults ? userAns === opt : selected === opt;
                    const isCorrectOpt   = isResults && correct === opt;
                    const isWrongOpt     = isResults && isSelectedOpt && !isCorrectOpt;

                    let bg = '#FAFAFA', borderCol = '#eeeeee', textCol = '#333333';
                    if (!isResults && isSelectedOpt) { bg = '#eef5ff'; borderCol = '#c0d9f7'; textCol = '#378ADD'; }
                    if (isCorrectOpt)  { bg = '#e6faf5'; borderCol = '#b3eedd'; textCol = '#00a876'; }
                    if (isWrongOpt)    { bg = '#fef2f2'; borderCol = '#fca5a5'; textCol = '#dc2626'; }

                    return (
                      <div
                        key={opt}
                        onClick={() => { if (!isResults) setAnswers(prev => ({ ...prev, [q._id]: opt })); }}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 14px',
                          background: bg, border: `1px solid ${borderCol}`,
                          cursor: isResults ? 'default' : 'pointer',
                          transition: 'background 100ms, border-color 100ms',
                        }}
                        onMouseEnter={e => {
                          if (!isResults && !isSelectedOpt)
                            (e.currentTarget as HTMLDivElement).style.background = '#f0f4ff';
                        }}
                        onMouseLeave={e => {
                          if (!isResults && !isSelectedOpt)
                            (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA';
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: textCol, minWidth: 14, marginTop: 2, flexShrink: 0 }}>{opt.toUpperCase()}</span>
                        <span style={{ fontSize: 13, color: textCol, lineHeight: 1.55 }}>
                          <MathText inline>{text}</MathText>
                        </span>
                        {isCorrectOpt && (
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#00a876', flexShrink: 0 }}>✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Solution */}
                {isResults && (q.solution_latex || q.solution) && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: '#f9fafb', border: '1px solid #eeeeee', borderLeft: '3px solid #378ADD' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>Solution</div>
                    <div style={{ fontSize: 13, color: '#444', lineHeight: 1.65 }}>
                      <MathText>{q.solution_latex || q.solution || ''}</MathText>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Try again after results */}
        {phase === 'results' && !error && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              onClick={handlePracticeAgain}
              style={{ padding: '10px 24px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
            >
              Practice again with fresh questions
            </button>
            <button
              onClick={() => router.push('/quant')}
              style={{ padding: '10px 24px', background: 'transparent', color: '#555', border: '1px solid #e4e4e4', fontSize: 13, fontFamily: F, cursor: 'pointer' }}
            >
              All chapters
            </button>
          </div>
        )}
      </main>

      {/* Sticky submit bar */}
      {(phase === 'practicing' || phase === 'submitting') && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: '#121212', padding: '14px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: '#555', fontFamily: F }}>
            {answered} of {questions.length} answered
            {answered < questions.length && (
              <span style={{ color: '#3a3a3a' }}> &nbsp;·&nbsp; unanswered counted as skipped</span>
            )}
          </span>
          <button
            onClick={handleSubmit}
            disabled={phase === 'submitting'}
            style={{
              padding: '10px 28px',
              background: phase === 'submitting' ? '#333' : '#00C48C',
              color: phase === 'submitting' ? '#666' : '#fff',
              border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F,
              cursor: phase === 'submitting' ? 'not-allowed' : 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => { if (phase !== 'submitting') e.currentTarget.style.background = '#00a876'; }}
            onMouseLeave={e => { if (phase !== 'submitting') e.currentTarget.style.background = '#00C48C'; }}
          >
            {phase === 'submitting' ? 'Submitting…' : `Submit ${questions.length} questions`}
          </button>
        </div>
      )}
    </div>
  );
}
