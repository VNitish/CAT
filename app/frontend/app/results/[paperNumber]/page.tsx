'use client';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { QuestionState, SectionName } from '@/lib/types';
import { DEMO_QUESTIONS } from '@/lib/demoData';
import MathText from '@/app/components/MathText';

const SECTION_ORDER: SectionName[] = ['VARC', 'DILR', 'QA'];
const MARKS_CORRECT = 3;
const MARKS_INCORRECT = -1;

// Truncate without cutting inside a `$...$` math span.
function mathSafePreview(text: string, max = 120): string {
  if (!text) return '';
  if (text.length <= max) return text;
  let s = text.slice(0, max);
  if (((s.match(/\$/g) || []).length) % 2 === 1) {
    const i = s.lastIndexOf('$');
    if (i > 0) s = s.slice(0, i);
  }
  return s + '…';
}

interface SectionScore {
  attempted: number;
  correct: number;
  incorrect: number;
  notAttempted: number;
  score: number;
  maxScore: number;
  totalQ: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const paperCode = params.paperNumber as string;
  const isDemo = searchParams.get('demo') === 'true';
  const qsParam = searchParams.get('qs');

  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({});
  const [activeSection, setActiveSection] = useState<SectionName | 'all'>('all');
  const [showExplanation, setShowExplanation] = useState<string | null>(null);

  useEffect(() => {
    if (qsParam) {
      try {
        setQuestionStates(JSON.parse(decodeURIComponent(qsParam)));
      } catch { /* fallback to empty */ }
    }
  }, [qsParam]);

  const allQuestions = [
    ...DEMO_QUESTIONS.VARC,
    ...DEMO_QUESTIONS.DILR,
    ...DEMO_QUESTIONS.QA,
  ];

  const calcSectionScore = (section: SectionName): SectionScore => {
    const qs = DEMO_QUESTIONS[section];
    let correct = 0, incorrect = 0, notAttempted = 0;
    qs.forEach(q => {
      const st = questionStates[q._id];
      if (!st || st.status === 'not-visited' || st.status === 'not-answered' || st.answer === null || st.answer === '') {
        notAttempted++;
      } else {
        const userAns = (st.answer || '').trim().toLowerCase();
        const correctAns = (q.correct_answer || '').trim().toLowerCase();
        if (userAns === correctAns) correct++;
        else incorrect++;
      }
    });
    const score = correct * MARKS_CORRECT + (incorrect * (qs[0]?.marks_incorrect ?? MARKS_INCORRECT));
    return { attempted: correct + incorrect, correct, incorrect, notAttempted, score, maxScore: qs.length * MARKS_CORRECT, totalQ: qs.length };
  };

  const scores = {
    VARC: calcSectionScore('VARC'),
    DILR: calcSectionScore('DILR'),
    QA:   calcSectionScore('QA'),
  };

  const totalScore = scores.VARC.score + scores.DILR.score + scores.QA.score;
  const totalMax = scores.VARC.maxScore + scores.DILR.maxScore + scores.QA.maxScore;
  const totalAttempted = scores.VARC.attempted + scores.DILR.attempted + scores.QA.attempted;
  const totalCorrect = scores.VARC.correct + scores.DILR.correct + scores.QA.correct;
  const totalIncorrect = scores.VARC.incorrect + scores.DILR.incorrect + scores.QA.incorrect;
  const totalQ = scores.VARC.totalQ + scores.DILR.totalQ + scores.QA.totalQ;
  const accuracy = totalAttempted > 0 ? ((totalCorrect / totalAttempted) * 100).toFixed(1) : '0.0';
  const scorePercent = Math.max(0, (totalScore / totalMax) * 100).toFixed(1);

  const scoreColor = (s: number, max: number) => {
    const pct = s / max;
    if (pct >= 0.7) return 'var(--color-success)';
    if (pct >= 0.4) return 'var(--color-brand)';
    return 'var(--color-danger)';
  };

  const scoreColorHex = (s: number, max: number) => {
    const pct = s / max;
    if (pct >= 0.7) return '#228B22';
    if (pct >= 0.4) return '#cc6600';
    return '#cc3300';
  };

  const displayQuestions = activeSection === 'all' ? allQuestions : DEMO_QUESTIONS[activeSection];

  void isDemo;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-page)', fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{
        background: 'var(--color-bg-header)',
        color: 'var(--color-text-primary)',
        padding: 'var(--space-3) var(--space-5)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '3px solid var(--color-brand)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--color-brand)',
            borderRadius: 'var(--radius-full)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: 'var(--text-body)',
          }}>C</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 'var(--text-body)' }}>CAT Mock Exam — Results</div>
            <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--color-text-label)' }}>{paperCode.replace(/_/g, ' ')} · Performance Report</div>
          </div>
        </div>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'var(--color-brand)',
            color: 'var(--color-text-primary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-2) var(--space-5)',
            cursor: 'pointer',
            fontSize: 'var(--text-body-sm)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 'bold',
          }}
        >
          ← Back to Home
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>

        {/* Score Hero */}
        <div style={{
          background: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6) var(--space-8)',
          marginBottom: 'var(--space-6)',
          border: '1px solid var(--color-border-default)',
        }}>
          <h2 style={{
            margin: '0 0 var(--space-5)',
            fontSize: 'var(--text-h3)',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
          }}>Your Scorecard</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-10)', flexWrap: 'wrap' }}>
            {/* Score circle */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 120, height: 120, borderRadius: 'var(--radius-full)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-2)',
                background: `conic-gradient(${scoreColorHex(totalScore, totalMax)} ${scorePercent}%, rgba(255,255,255,0.08) 0)`,
                boxShadow: 'var(--shadow-md)',
              }}>
                <div style={{
                  width: 90, height: 90, borderRadius: 'var(--radius-full)',
                  background: 'var(--color-bg-card)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ fontSize: 26, fontWeight: 'bold', color: scoreColor(totalScore, totalMax), lineHeight: 1 }}>{totalScore}</div>
                  <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--color-text-muted)' }}>/ {totalMax}</div>
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>Total Score</div>
              <div style={{ fontSize: 'var(--text-label)', color: 'var(--color-text-muted)' }}>{scorePercent}% of max</div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3) var(--space-6)' }}>
              {[
                { label: 'Total Questions', value: totalQ, color: 'var(--color-text-secondary)' },
                { label: 'Attempted', value: totalAttempted, color: 'var(--color-text-muted)' },
                { label: 'Correct', value: totalCorrect, color: 'var(--color-success)' },
                { label: 'Incorrect', value: totalIncorrect, color: 'var(--color-danger)' },
                { label: 'Not Attempted', value: totalQ - totalAttempted, color: 'var(--color-text-disabled)' },
                { label: 'Accuracy', value: `${accuracy}%`, color: 'var(--color-brand)' },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'var(--color-bg-card-hover)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                  minWidth: 130,
                  border: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          {SECTION_ORDER.map(s => {
            const sc = scores[s];
            const pct = Math.max(0, (sc.score / sc.maxScore) * 100).toFixed(0);
            return (
              <div key={s} style={{
                background: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4) var(--space-5)',
                border: '1px solid var(--color-border-default)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>{s}</div>
                    <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--color-text-muted)' }}>{sc.totalQ} questions · 40 min</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 'bold', color: scoreColor(sc.score, sc.maxScore) }}>{sc.score}</div>
                    <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--color-text-muted)' }}>/ {sc.maxScore}</div>
                  </div>
                </div>
                {/* Mini progress bar */}
                <div style={{ height: 6, background: 'var(--color-border-default)', borderRadius: 'var(--radius-full)', marginBottom: 'var(--space-3)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: scoreColorHex(sc.score, sc.maxScore), borderRadius: 'var(--radius-full)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-1)', fontSize: 'var(--text-tiny)', textAlign: 'center' }}>
                  <div style={{ background: 'var(--color-success-subtle)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-1) 0' }}>
                    <div style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>{sc.correct}</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>Correct</div>
                  </div>
                  <div style={{ background: 'var(--color-danger-subtle)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-1) 0' }}>
                    <div style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>{sc.incorrect}</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>Wrong</div>
                  </div>
                  <div style={{ background: 'var(--color-bg-card-hover)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-1) 0', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ color: 'var(--color-text-disabled)', fontWeight: 'bold' }}>{sc.notAttempted}</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>Skipped</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Question review */}
        <div style={{
          background: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-default)',
          overflow: 'hidden',
        }}>
          {/* Review header */}
          <div style={{
            background: 'var(--color-bg-header)',
            padding: 'var(--space-3) var(--space-5)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap',
            borderBottom: '1px solid var(--color-border-default)',
          }}>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold', fontSize: 'var(--text-body-sm)' }}>Question Review</span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {(['all', ...SECTION_ORDER] as const).map(s => (
                <button key={s} onClick={() => setActiveSection(s)} style={{
                  padding: 'var(--space-1) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-label)',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  border: 'none',
                  background: activeSection === s ? 'var(--color-brand)' : 'rgba(255,255,255,0.1)',
                  color: 'var(--color-text-primary)',
                  transition: 'background var(--duration-hover)',
                }}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          <div>
            {displayQuestions.map((q, idx) => {
              const st = questionStates[q._id];
              const userAns = st?.answer?.trim() ?? null;
              const correctAns = q.correct_answer.trim();
              const attempted = userAns !== null && userAns !== '';
              const isCorrect = attempted && userAns?.toLowerCase() === correctAns.toLowerCase();
              const isWrong = attempted && !isCorrect;
              const isExpanded = showExplanation === q._id;

              const rowBg = isCorrect
                ? 'rgba(34,139,34,0.08)'
                : isWrong
                ? 'rgba(204,0,0,0.06)'
                : 'transparent';

              const badge = isCorrect
                ? { text: '+' + q.marks_correct, color: 'var(--color-success)' }
                : isWrong
                ? { text: String(q.marks_incorrect), color: 'var(--color-danger)' }
                : { text: '0', color: 'var(--color-text-disabled)' };

              return (
                <div key={q._id} style={{ borderBottom: '1px solid var(--color-border-subtle)', background: rowBg }}>
                  <div
                    onClick={() => setShowExplanation(isExpanded ? null : q._id)}
                    style={{ padding: 'var(--space-3) var(--space-5)', cursor: 'pointer', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}
                  >
                    {/* Number badge */}
                    <div style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-full)',
                      background: 'var(--color-primary)', color: 'var(--color-text-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--text-tiny)', fontWeight: 'bold', flexShrink: 0, marginTop: 1,
                    }}>
                      {idx + 1}
                    </div>

                    {/* Question text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-2)' }}>
                        <MathText inline>{mathSafePreview(q.question_text)}</MathText>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: 'var(--text-tiny)' }}>
                        <span style={{ background: 'rgba(0,51,153,0.25)', color: 'var(--color-text-label)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)', fontWeight: 'bold' }}>{q.section}</span>
                        <span style={{ background: 'var(--color-bg-card-hover)', color: 'var(--color-text-muted)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)' }}>{q.question_type}</span>
                        {attempted && (
                          <span style={{ color: 'var(--color-text-muted)' }}>Your answer: <strong style={{ color: isCorrect ? 'var(--color-success)' : 'var(--color-danger)' }}>{userAns}</strong></span>
                        )}
                        {!attempted && <span style={{ color: 'var(--color-text-disabled)' }}>Not attempted</span>}
                        {attempted && <span style={{ color: 'var(--color-text-muted)' }}>Correct: <strong style={{ color: 'var(--color-success)' }}>{correctAns}</strong></span>}
                      </div>
                    </div>

                    {/* Score badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                      <div style={{
                        background: isCorrect ? 'var(--color-success-subtle)' : isWrong ? 'var(--color-danger-subtle)' : 'var(--color-bg-card-hover)',
                        color: badge.color,
                        border: `1px solid ${isCorrect ? 'rgba(34,139,34,0.3)' : isWrong ? 'rgba(204,0,0,0.3)' : 'var(--color-border-default)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: 'var(--space-1) var(--space-3)',
                        fontSize: 'var(--text-body-sm)',
                        fontWeight: 'bold',
                        minWidth: 36,
                        textAlign: 'center',
                      }}>
                        {badge.text}
                      </div>
                      <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--color-text-muted)' }}>{isExpanded ? '▲ Hide' : '▼ View'}</div>
                    </div>
                  </div>

                  {/* Expanded explanation */}
                  {isExpanded && (
                    <div style={{ padding: '0 var(--space-5) var(--space-4) 60px' }}>
                      {q.context_passage && (
                        <div style={{
                          background: 'var(--color-bg-card-hover)',
                          border: '1px solid var(--color-border-default)',
                          borderRadius: 'var(--radius-sm)',
                          padding: 'var(--space-3) var(--space-4)',
                          marginBottom: 'var(--space-3)',
                          fontSize: 'var(--text-tiny)',
                          lineHeight: 1.7,
                          maxHeight: 200, overflow: 'auto',
                          whiteSpace: 'pre-line',
                          fontFamily: 'var(--font-reading)',
                          color: 'var(--color-text-secondary)',
                        }}>
                          <strong style={{ color: 'var(--color-text-label)' }}>Passage:</strong><br />{q.context_passage}
                        </div>
                      )}
                      {q.options && (
                        <div style={{ marginBottom: 'var(--space-3)' }}>
                          {q.options.map(opt => {
                            const isCorrectOpt = opt.label.toLowerCase() === correctAns.toLowerCase();
                            const isUserOpt = userAns?.toLowerCase() === opt.label.toLowerCase();
                            return (
                              <div key={opt.label} style={{
                                fontSize: 'var(--text-tiny)',
                                padding: 'var(--space-1) var(--space-3)',
                                marginBottom: 'var(--space-1)',
                                borderRadius: 'var(--radius-sm)',
                                background: isCorrectOpt ? 'var(--color-success-subtle)' : isUserOpt ? 'var(--color-danger-subtle)' : 'transparent',
                                border: isCorrectOpt ? '1px solid rgba(34,139,34,0.4)' : isUserOpt ? '1px solid rgba(204,0,0,0.4)' : '1px solid transparent',
                                display: 'flex', gap: 'var(--space-2)', alignItems: 'center',
                                color: 'var(--color-text-secondary)',
                              }}>
                                <span style={{ fontWeight: 'bold', color: isCorrectOpt ? 'var(--color-success)' : isUserOpt ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>({opt.label})</span>
                                <span><MathText inline>{opt.text}</MathText></span>
                                {isCorrectOpt && <span style={{ color: 'var(--color-success)', fontWeight: 'bold', marginLeft: 'auto' }}>✓ Correct</span>}
                                {isUserOpt && !isCorrectOpt && <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', marginLeft: 'auto' }}>✗ Your answer</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{
                        background: 'var(--color-warning-subtle)',
                        border: '1px solid rgba(255,136,0,0.3)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 'var(--space-3) var(--space-4)',
                        fontSize: 'var(--text-tiny)',
                        lineHeight: 1.6,
                        color: 'var(--color-text-secondary)',
                      }}>
                        <strong style={{ color: 'var(--color-warning)' }}>Explanation: </strong>{q.explanation}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              background: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--text-body)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 'bold',
              transition: 'background var(--duration-hover)',
            }}
          >
            ← Take Another Mock
          </button>
          <button
            onClick={() => window.print()}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              background: 'var(--color-bg-input)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--text-body)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 'bold',
              transition: 'background var(--duration-hover)',
            }}
          >
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
}
