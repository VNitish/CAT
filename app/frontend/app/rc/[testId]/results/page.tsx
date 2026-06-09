'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import MathText from '@/app/components/MathText';

interface VOption { label: string; text: string }
interface VResultQ {
  _id: string;
  question_number: number;
  topic: string;
  question_type: 'MCQ' | 'TITA';
  answer_format: 'option' | 'sequence';
  context_passage: string;
  directions: string;
  question_text: string;
  underline?: string;
  options: VOption[] | null;
  correct_answer: string;
  explanation: string;
  user_answer: string;
  is_correct: boolean;
}
interface Score { total: number; attempted: number; correct: number; incorrect: number; max_score: number }

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

function RcResultsInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const testId = params.testId as string;
  const sid = searchParams.get('sid');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [questions, setQuestions] = useState<VResultQ[]>([]);

  useEffect(() => {
    if (!sid) { setError('No session specified'); setLoading(false); return; }
    (async () => {
      try {
        const res = await apiFetch(`/api/rc/sessions/${sid}`);
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) throw new Error('Could not load results');
        const data = await res.json();
        setScore(data.score);
        setQuestions(data.questions || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [sid, router]);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6fa', color: '#003366', fontWeight: 'bold' }}>Loading results…</div>;
  }
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6fa', color: '#cc3300', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontWeight: 'bold' }}>{error}</div>
        <button onClick={() => router.push('/rc')} style={{ padding: '8px 20px', background: '#003366', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Back to RC</button>
      </div>
    );
  }

  const totalQ = questions.length;
  const max = score?.max_score || totalQ * 3;
  const accuracy = score && score.attempted > 0 ? ((score.correct / score.attempted) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fa', color: '#222', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: '#003366', color: 'white', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 'bold', fontSize: 15 }}>Reading Comprehension Test {testId} — Results</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/rc')} style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>All Tests</button>
        </div>
      </div>

      {/* Score summary */}
      {score && (
        <div style={{ maxWidth: 880, margin: '24px auto 0', padding: '0 20px' }}>
          <div style={{ background: 'white', borderRadius: 8, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: '#003366' }}>{score.total}</div>
              <div style={{ fontSize: 16, color: '#888' }}>/ {max}</div>
              <div style={{ marginLeft: 'auto', fontSize: 13, color: '#666' }}>Accuracy: <strong style={{ color: '#003366' }}>{accuracy}%</strong></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Attempted', val: score.attempted, color: '#003366' },
                { label: 'Correct', val: score.correct, color: '#228B22' },
                { label: 'Incorrect', val: score.incorrect, color: '#cc3300' },
                { label: 'Unattempted', val: totalQ - score.attempted, color: '#888' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f8f9fb', border: '1px solid #eee', borderRadius: 6, padding: '12px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Question review */}
      <div style={{ maxWidth: 880, margin: '24px auto', padding: '0 20px 60px' }}>
        <h2 style={{ fontSize: 16, color: '#003366', marginBottom: 14 }}>Question Review</h2>
        {questions.map(q => {
          const userAns = q.user_answer || '';
          const attempted = !!userAns;
          const correct = q.is_correct;
          const borderColor = !attempted ? '#ddd' : correct ? '#b3eedd' : '#fca5a5';
          const badgeBg = !attempted ? '#f0f0f0' : correct ? '#e6faf5' : '#fef2f2';
          const badgeColor = !attempted ? '#888' : correct ? '#00a876' : '#dc2626';
          const badgeText = !attempted ? 'Not Attempted' : correct ? 'Correct' : 'Incorrect';
          return (
            <div key={q._id} style={{ background: 'white', border: `1px solid ${borderColor}`, borderRadius: 8, padding: '16px 20px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#003366' }}>Q{q.question_number} · {q.topic}</span>
                <span style={{ fontSize: 11, fontWeight: 700, background: badgeBg, color: badgeColor, padding: '3px 10px', borderRadius: 12 }}>{badgeText}</span>
              </div>

              {q.context_passage && (
                <details style={{ marginBottom: 10 }}>
                  <summary style={{ fontSize: 12, color: '#666', cursor: 'pointer' }}>Show passage</summary>
                  <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 4, padding: '10px 12px', marginTop: 6, fontSize: 12.5, lineHeight: 1.7, color: '#333', whiteSpace: 'pre-line' }}>{q.context_passage}</div>
                </details>
              )}

              <div style={{ fontSize: 14, lineHeight: 1.6, color: '#111', marginBottom: 12 }}><QuestionText text={q.question_text} underline={q.underline} /></div>

              {q.answer_format === 'option' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {q.options.map(opt => {
                    const isCorrectOpt = opt.label.toLowerCase() === (q.correct_answer || '').toLowerCase();
                    const isUserOpt = opt.label.toLowerCase() === userAns.toLowerCase();
                    let bg = '#fafafa', border = '1px solid #eee', col = '#333';
                    if (isCorrectOpt) { bg = '#e6faf5'; border = '1px solid #b3eedd'; col = '#00a876'; }
                    if (isUserOpt && !isCorrectOpt) { bg = '#fef2f2'; border = '1px solid #fca5a5'; col = '#dc2626'; }
                    return (
                      <div key={opt.label} style={{ background: bg, border, borderRadius: 4, padding: '8px 12px', fontSize: 13.5, color: col, display: 'flex', gap: 8 }}>
                        <strong>{opt.label}.</strong>
                        <span style={{ flex: 1 }}><MathText inline>{opt.text}</MathText></span>
                        {isCorrectOpt && <span style={{ fontSize: 11, fontWeight: 700 }}>✓ correct</span>}
                        {isUserOpt && !isCorrectOpt && <span style={{ fontSize: 11, fontWeight: 700 }}>your answer</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {q.answer_format === 'sequence' && (
                <div style={{ display: 'flex', gap: 24, fontSize: 13.5, marginTop: 4 }}>
                  <div>Your answer: <strong style={{ color: correct ? '#00a876' : userAns ? '#dc2626' : '#888', letterSpacing: 2 }}>{userAns || '—'}</strong></div>
                  <div>Correct order: <strong style={{ color: '#00a876', letterSpacing: 2 }}>{q.correct_answer}</strong></div>
                </div>
              )}

              {q.explanation && q.explanation.trim() && (
                <div style={{ marginTop: 12, background: '#f4f8ff', border: '1px solid #d6e4ff', borderRadius: 4, padding: '10px 14px', fontSize: 13, lineHeight: 1.6, color: '#234' }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: '#003366', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Explanation</div>
                  <MathText>{q.explanation}</MathText>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RcResultsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6fa', color: '#003366', fontWeight: 'bold' }}>Loading results…</div>}>
      <RcResultsInner />
    </Suspense>
  );
}
