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
  pattern: string;
  difficulty: string;
  source: string;
  question_type: 'MCQ' | 'TITA';
  answer_format: 'option' | 'numeric';
  context_passage: string;
  set_id: string;
  question_text: string;
  options: VOption[] | null;
  correct_answer: string;
  explanation: string;
  user_answer: string;
  is_correct: boolean;
  time_spent: number;   // seconds
}
interface Score { total: number; attempted: number; correct: number; incorrect: number; max_score: number }

function formatDuration(s: number) {
  const a = Math.abs(s);
  const m = Math.floor(a / 60);
  const sec = a % 60;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

function shortDuration(s: number) {
  const a = Math.max(0, Math.round(s));
  if (a < 60) return `${a}s`;
  return `${Math.floor(a / 60)}m ${String(a % 60).padStart(2, '0')}s`;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function rollup(questions: VResultQ[], key: (q: VResultQ) => string) {
  const map = new Map<string, { total: number; correct: number; incorrect: number; skipped: number; time: number }>();
  questions.forEach(q => {
    const k = key(q);
    const row = map.get(k) || { total: 0, correct: 0, incorrect: 0, skipped: 0, time: 0 };
    row.total++;
    row.time += q.time_spent || 0;
    if (!q.user_answer) row.skipped++;
    else if (q.is_correct) row.correct++;
    else row.incorrect++;
    map.set(k, row);
  });
  return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
}

function DilrtResultsInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const testId = params.testId as string;
  const sid = searchParams.get('sid');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [label, setLabel] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [duration, setDuration] = useState<number>(40 * 60);
  const [questions, setQuestions] = useState<VResultQ[]>([]);
  const [filter, setFilter] = useState<'all' | 'wrong' | 'skipped'>('all');

  useEffect(() => {
    if (!sid) { setError('No session specified'); setLoading(false); return; }
    (async () => {
      try {
        const res = await apiFetch(`/api/dilrt/sessions/${sid}`);
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) throw new Error('Could not load results');
        const data = await res.json();
        setScore(data.score);
        setLabel(data.label || '');
        setTimeLeft(typeof data.time_left === 'number' ? data.time_left : 0);
        setDuration(data.duration_seconds || 40 * 60);
        setQuestions(data.questions || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [sid, router]);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6fa', color: '#312e81', fontWeight: 'bold' }}>Loading results…</div>;
  }
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6fa', color: '#cc3300', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontWeight: 'bold' }}>{error}</div>
        <button onClick={() => router.push('/dilr-tests')} style={{ padding: '8px 20px', background: '#312e81', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Back to LR Sample Tests</button>
      </div>
    );
  }

  const totalQ = questions.length;
  const max = score?.max_score || totalQ * 3;
  const accuracy = score && score.attempted > 0 ? ((score.correct / score.attempted) * 100).toFixed(1) : '0.0';
  const overtime = timeLeft < 0;
  const timeUsed = duration - timeLeft;

  const byTopic = rollup(questions, q => q.topic).sort((a, b) => b.total - a.total);
  const byPattern = rollup(questions, q => q.pattern);
  const weakPatterns = byPattern.filter(p => p.correct === 0).sort((a, b) => a.name.localeCompare(b.name));

  const correctQs = questions.filter(q => q.user_answer && q.is_correct);
  const wrongQs   = questions.filter(q => q.user_answer && !q.is_correct);
  const gaveUpQs  = questions.filter(q => !q.user_answer && (q.time_spent || 0) > 0);
  const untouched = questions.filter(q => !q.user_answer && !(q.time_spent || 0));

  const sum = (xs: VResultQ[]) => xs.reduce((a, q) => a + (q.time_spent || 0), 0);
  const timeOnCorrect = sum(correctQs);
  const timeOnWrong   = sum(wrongQs);
  const timeOnGaveUp  = sum(gaveUpQs);
  const timeTracked   = timeOnCorrect + timeOnWrong + timeOnGaveUp;
  const wastedPct     = timeTracked > 0 ? Math.round(((timeOnWrong + timeOnGaveUp) / timeTracked) * 100) : 0;
  const hasTiming     = timeTracked > 0;

  const slowest = [...questions]
    .filter(q => (q.time_spent || 0) > 0)
    .sort((a, b) => (b.time_spent || 0) - (a.time_spent || 0))
    .slice(0, 5);

  const shown = questions.filter(q => {
    if (filter === 'wrong') return q.user_answer && !q.is_correct;
    if (filter === 'skipped') return !q.user_answer;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fa', color: '#222', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: '#312e81', color: 'white', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 'bold', fontSize: 15 }}>Logical Reasoning {label ? `· ${label}` : ''} — Test {testId} Results</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/dilr-tests')} style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>All Tests</button>
        </div>
      </div>

      {/* Score summary */}
      {score && (
        <div style={{ maxWidth: 880, margin: '24px auto 0', padding: '0 20px' }}>
          <div style={{ background: 'white', borderRadius: 8, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: '#312e81' }}>{score.total}</div>
              <div style={{ fontSize: 16, color: '#888' }}>/ {max}</div>
              <div style={{ marginLeft: 'auto', fontSize: 13, color: '#666' }}>Accuracy: <strong style={{ color: '#312e81' }}>{accuracy}%</strong></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Attempted', val: score.attempted, color: '#312e81' },
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

            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 6, fontSize: 13,
              background: overtime ? '#fff1ee' : '#eefaf4',
              border: `1px solid ${overtime ? '#f5c6ba' : '#b3eedd'}`,
              color: overtime ? '#a01e00' : '#00784f',
            }}>
              {overtime ? (
                <>Took <strong>{formatDuration(timeUsed)}</strong> &mdash; <strong>{formatDuration(timeLeft)}</strong> over the {Math.round(duration / 60)}-minute limit. In the real exam everything after the buzzer would have scored zero.</>
              ) : (
                <>Finished in <strong>{formatDuration(timeUsed)}</strong>, with <strong>{formatDuration(timeLeft)}</strong> to spare on the {Math.round(duration / 60)}-minute limit.</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Breakdown by topic */}
      <div style={{ maxWidth: 880, margin: '20px auto 0', padding: '0 20px' }}>
        <div style={{ background: 'white', borderRadius: 8, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 14, color: '#312e81', margin: '0 0 14px' }}>By topic</h2>
          {byTopic.map(t => {
            const pct = t.total ? (t.correct / t.total) * 100 : 0;
            return (
              <div key={t.name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ color: '#333', fontWeight: 600 }}>{t.name}</span>
                  <span style={{ color: '#666' }}>
                    <strong style={{ color: '#228B22' }}>{t.correct}</strong> correct ·{' '}
                    <strong style={{ color: '#cc3300' }}>{t.incorrect}</strong> wrong ·{' '}
                    <strong style={{ color: '#999' }}>{t.skipped}</strong> skipped &nbsp;of {t.total}
                    {t.time > 0 && <span style={{ color: '#aaa' }}> &nbsp;·&nbsp; {formatDuration(t.time)}</span>}
                  </span>
                </div>
                <div style={{ height: 7, background: '#eef0f4', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${pct}%`, background: '#228B22' }} />
                  <div style={{ width: `${t.total ? (t.incorrect / t.total) * 100 : 0}%`, background: '#e57373' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Where the clock went */}
      {hasTiming && (
        <div style={{ maxWidth: 880, margin: '20px auto 0', padding: '0 20px' }}>
          <div style={{ background: 'white', borderRadius: 8, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 14, color: '#312e81', margin: '0 0 6px' }}>Where your time went</h2>
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px' }}>
              Measured per question, from when you opened it to when you moved on. {formatDuration(timeTracked)} tracked across {questions.length - untouched.length} questions you actually opened.
            </p>

            <div style={{ height: 12, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 10, background: '#eef0f4' }}>
              <div style={{ width: `${(timeOnCorrect / timeTracked) * 100}%`, background: '#228B22' }} title={`Correct: ${formatDuration(timeOnCorrect)}`} />
              <div style={{ width: `${(timeOnWrong / timeTracked) * 100}%`, background: '#e05a4a' }} title={`Wrong: ${formatDuration(timeOnWrong)}`} />
              <div style={{ width: `${(timeOnGaveUp / timeTracked) * 100}%`, background: '#c0c6d0' }} title={`Gave up: ${formatDuration(timeOnGaveUp)}`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'On correct answers', n: correctQs.length, t: timeOnCorrect, color: '#228B22' },
                { label: 'On wrong answers', n: wrongQs.length, t: timeOnWrong, color: '#cc3300' },
                { label: 'Opened, then left blank', n: gaveUpQs.length, t: timeOnGaveUp, color: '#777' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f8f9fb', border: '1px solid #eee', borderRadius: 6, padding: '12px 14px' }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: s.color }}>{formatDuration(s.t)}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                    {s.n} question{s.n !== 1 ? 's' : ''}{s.n > 0 ? ` · ${shortDuration(s.t / s.n)} avg` : ''}
                  </div>
                </div>
              ))}
            </div>

            {(timeOnWrong + timeOnGaveUp) > 0 && (
              <div style={{ background: '#fff8f6', border: '1px solid #f5d3c9', borderRadius: 6, padding: '10px 14px', fontSize: 12.5, color: '#8a3520', lineHeight: 1.6, marginBottom: 14 }}>
                <strong>{wastedPct}% of your working time</strong> ({formatDuration(timeOnWrong + timeOnGaveUp)}) went into questions that scored you nothing
                {wrongQs.length > 0 && <> &mdash; and the {wrongQs.length} wrong {wrongQs.length === 1 ? 'answer' : 'answers'} cost {wrongQs.filter(q => q.question_type === 'MCQ').length} negative {wrongQs.filter(q => q.question_type === 'MCQ').length === 1 ? 'mark' : 'marks'} on top</>}.
                {correctQs.length > 0 && <> Your correct answers averaged <strong>{shortDuration(avg(correctQs.map(q => q.time_spent)))}</strong> each.</>}
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: '#312e81', marginBottom: 8 }}>Longest single questions</div>
            {slowest.map(q => {
              const outcome = !q.user_answer ? 'left blank' : q.is_correct ? 'correct' : 'wrong';
              const col = !q.user_answer ? '#888' : q.is_correct ? '#00a876' : '#dc2626';
              return (
                <div key={q._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f2f4f7', fontSize: 12.5 }}>
                  <span style={{ fontWeight: 700, color: '#312e81', width: 34, flexShrink: 0 }}>Q{q.question_number}</span>
                  <span style={{ color: '#555', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.pattern}</span>
                  <span style={{ color: col, fontWeight: 600, flexShrink: 0 }}>{outcome}</span>
                  <span style={{ fontWeight: 700, color: '#333', fontVariantNumeric: 'tabular-nums', width: 66, textAlign: 'right', flexShrink: 0 }}>{shortDuration(q.time_spent)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Patterns to revisit */}
      {weakPatterns.length > 0 && (
        <div style={{ maxWidth: 880, margin: '20px auto 0', padding: '0 20px' }}>
          <div style={{ background: 'white', borderRadius: 8, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 14, color: '#312e81', margin: '0 0 6px' }}>Patterns to revisit</h2>
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 14px' }}>
              Techniques you did not get a single mark on in this test &mdash; {weakPatterns.length} of {byPattern.length}.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {weakPatterns.map(p => (
                <span key={p.name} style={{
                  fontSize: 11.5, padding: '5px 10px', borderRadius: 4,
                  background: p.skipped === p.total ? '#f5f5f5' : '#fff1ee',
                  border: `1px solid ${p.skipped === p.total ? '#e2e2e2' : '#f5c6ba'}`,
                  color: p.skipped === p.total ? '#777' : '#a01e00',
                }}>
                  {p.name}{p.skipped === p.total ? ' · skipped' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Question review */}
      <div style={{ maxWidth: 880, margin: '24px auto', padding: '0 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, color: '#312e81', margin: 0 }}>Question Review</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {([
              ['all', `All ${questions.length}`],
              ['wrong', `Wrong ${questions.filter(q => q.user_answer && !q.is_correct).length}`],
              ['skipped', `Skipped ${questions.filter(q => !q.user_answer).length}`],
            ] as const).map(([key, label2]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '5px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                  background: filter === key ? '#312e81' : 'white',
                  color: filter === key ? 'white' : '#555',
                  border: `1px solid ${filter === key ? '#312e81' : '#d6dbe4'}`,
                }}
              >
                {label2}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 && (
          <div style={{ background: 'white', border: '1px solid #e4e8ef', borderRadius: 8, padding: '30px 20px', textAlign: 'center', color: '#888', fontSize: 13 }}>
            Nothing in this bucket.
          </div>
        )}

        {shown.map(q => {
          const userAns = q.user_answer || '';
          const attempted = !!userAns;
          const correct = q.is_correct;
          const borderColor = !attempted ? '#ddd' : correct ? '#b3eedd' : '#fca5a5';
          const badgeBg = !attempted ? '#f0f0f0' : correct ? '#e6faf5' : '#fef2f2';
          const badgeColor = !attempted ? '#888' : correct ? '#00a876' : '#dc2626';
          const badgeText = !attempted ? 'Not Attempted' : correct ? 'Correct' : 'Incorrect';
          return (
            <div key={q._id} style={{ background: 'white', border: `1px solid ${borderColor}`, borderRadius: 8, padding: '16px 20px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#312e81' }}>Q{q.question_number} · {q.topic}</span>
                <span style={{ fontSize: 11, fontWeight: 700, background: badgeBg, color: badgeColor, padding: '3px 10px', borderRadius: 12, flexShrink: 0 }}>{badgeText}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, fontSize: 10.5 }}>
                <span style={{ background: '#eef0ff', border: '1px solid #d3d6f7', color: '#3730a3', fontWeight: 600, padding: '2px 7px', borderRadius: 3 }}>{q.pattern}</span>
                <span style={{ background: '#f4f6fa', border: '1px solid #e2e7f0', color: '#666', padding: '2px 7px', borderRadius: 3 }}>{q.question_type}</span>
                <span style={{ background: '#f4f6fa', border: '1px solid #e2e7f0', color: '#666', padding: '2px 7px', borderRadius: 3 }}>{q.difficulty}</span>
                <span style={{ background: '#f4f6fa', border: '1px solid #e2e7f0', color: '#666', padding: '2px 7px', borderRadius: 3 }}>{q.source}</span>
                {(q.time_spent || 0) > 0 && (
                  <span style={{ background: '#f4f6fa', border: '1px solid #e2e7f0', color: '#444', fontWeight: 600, padding: '2px 7px', borderRadius: 3, fontVariantNumeric: 'tabular-nums' }}>
                    ⏱ {shortDuration(q.time_spent)}
                  </span>
                )}
              </div>

              {q.context_passage && (
                <details style={{ marginBottom: 10 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 11.5, color: '#3730a3', fontWeight: 600 }}>Show scenario</summary>
                  <div style={{ marginTop: 8, background: '#f9f9fb', border: '1px solid #e4e8ef', borderRadius: 4, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.7, color: '#333' }}>
                    <MathText>{q.context_passage}</MathText>
                  </div>
                </details>
              )}

              <div style={{ fontSize: 14, lineHeight: 1.7, color: '#111', marginBottom: 12 }}><MathText>{q.question_text}</MathText></div>

              {q.question_type === 'MCQ' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {q.options.map((opt, oi) => {
                    const isCorrectOpt = opt.label.toLowerCase() === (q.correct_answer || '').toLowerCase();
                    const isUserOpt = opt.label.toLowerCase() === userAns.toLowerCase();
                    let bg = '#fafafa', border = '1px solid #eee', col = '#333';
                    if (isCorrectOpt) { bg = '#e6faf5'; border = '1px solid #b3eedd'; col = '#00a876'; }
                    if (isUserOpt && !isCorrectOpt) { bg = '#fef2f2'; border = '1px solid #fca5a5'; col = '#dc2626'; }
                    return (
                      <div key={oi} style={{ background: bg, border, borderRadius: 4, padding: '8px 12px', fontSize: 13.5, color: col, display: 'flex', gap: 8 }}>
                        <strong>{opt.label}.</strong>
                        <span style={{ flex: 1 }}><MathText inline>{opt.text}</MathText></span>
                        {isCorrectOpt && <span style={{ fontSize: 11, fontWeight: 700 }}>✓ correct</span>}
                        {isUserOpt && !isCorrectOpt && <span style={{ fontSize: 11, fontWeight: 700 }}>your answer</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {q.question_type === 'TITA' && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px', background: '#e6faf5', border: '1px solid #b3eedd', borderRadius: 4, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10.5, color: '#00784f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Correct answer</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#00a876', fontVariantNumeric: 'tabular-nums' }}>{q.correct_answer}</div>
                  </div>
                  <div style={{
                    flex: '1 1 160px', borderRadius: 4, padding: '8px 12px',
                    background: !attempted ? '#f5f5f5' : correct ? '#e6faf5' : '#fef2f2',
                    border: `1px solid ${!attempted ? '#e2e2e2' : correct ? '#b3eedd' : '#fca5a5'}`,
                  }}>
                    <div style={{ fontSize: 10.5, color: '#777', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Your answer</div>
                    <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: !attempted ? '#999' : correct ? '#00a876' : '#dc2626' }}>
                      {attempted ? userAns : '—'}
                    </div>
                  </div>
                </div>
              )}

              {q.explanation && q.explanation.trim() && (
                <div style={{ marginTop: 12, background: '#f4f6ff', border: '1px solid #d6dcff', borderRadius: 4, padding: '10px 14px', fontSize: 13, lineHeight: 1.7, color: '#234' }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: '#312e81', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Solution</div>
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

export default function DilrtResultsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6fa', color: '#312e81', fontWeight: 'bold' }}>Loading results…</div>}>
      <DilrtResultsInner />
    </Suspense>
  );
}
