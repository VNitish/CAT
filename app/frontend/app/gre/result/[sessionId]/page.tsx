'use client';
// Evaluation page for a submitted GRE test (layout from the user's wireframe):
// score summary on top, a 7-per-row grid of question numbers coloured by result
// (green right, red wrong, grey skipped), and the selected question below with
// separate "Answer" and "Show Solution" reveals.
import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import MathText from '@/app/components/MathText';
import QuestionView from '../../QuestionView';
import VerbalQuestionView from '../../VerbalQuestionView';
import { GreSessionView, formatAnswer, formatClock, passageLabel, setLabel } from '@/lib/gre';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';
const COLOR = { right: '#16A34A', wrong: '#DC2626', skipped: '#94A3B8' };

function GreResultInner() {
  const router = useRouter();
  const sid = useParams().sessionId as string;
  const [view, setView] = useState<GreSessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    apiFetch(`/api/gre/sessions/${sid}/result`)
      .then(async r => {
        if (r.status === 401) { router.push('/login'); return; }
        if (!r.ok) throw new Error('Could not load the result');
        setView(await r.json());
      })
      .catch(e => setError(e.message));
  }, [sid, router]);

  const pick = (i: number) => { setSel(i); setShowAnswer(false); setShowSolution(false); };

  if (error) return <div style={{ padding: 40, fontFamily: F, color: '#991B1B' }}>{error}</div>;
  if (!view || !view.score) return <div style={{ padding: 40, fontFamily: F, color: '#64748B' }}>Loading result…</div>;

  const s = view.score;
  const areas = Object.entries(s.by_area).map(([name, a]) => ({ name, ...a, pct: a.correct / a.total }))
    .sort((x, y) => x.pct - y.pct || (y.total - y.correct) - (x.total - x.correct));  // ties: most misses first
  const weakest = areas[0];
  const q = view.questions[sel];
  const st = view.states[q.key];
  const set = q.set_id ? view.sets.find(x => x.set_id === q.set_id) : undefined;
  const verbal = view.subject === 'verbal';
  const passage = q.passage_id ? view.passages?.find(p => p.passage_id === q.passage_id) : undefined;
  const solution = q.solution_latex || q.solution_text;
  const tone = (r: boolean | null | undefined) => (r === true ? COLOR.right : r === false ? COLOR.wrong : COLOR.skipped);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: F, color: '#0F172A' }}>
      <nav style={{ background: '#0F172A', color: '#fff', height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <button onClick={() => router.push(verbal ? '/gre/verbal' : '/gre')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: F }}>← All tests</button>
        <strong style={{ fontSize: 14 }}>GRE {verbal ? 'Verbal' : 'Quant'} · Test {view.display_no} · Evaluation</strong>
      </nav>

      <main style={{ maxWidth: 1700, margin: '0 auto', padding: '24px 32px 64px' }}>
        {/* Score summary */}
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'baseline' }}>
            <div><div style={label}>Score</div><div style={{ fontSize: 34, fontWeight: 800 }}>{s.correct}<span style={{ fontSize: 18, color: '#94A3B8' }}>/{s.total}</span></div></div>
            <div><div style={label}>Time used</div><div style={big}>{formatClock(s.time_used)}</div></div>
            <div><div style={label}>Right · Wrong · Skipped</div><div style={big}>
              <span style={{ color: COLOR.right }}>{s.correct}</span> · <span style={{ color: COLOR.wrong }}>{s.incorrect}</span> · <span style={{ color: COLOR.skipped }}>{s.skipped}</span>
            </div></div>
            {weakest && <div><div style={label}>Weakest</div><div style={{ ...big, color: COLOR.wrong }}>{weakest.name}</div></div>}
          </div>
          <div style={{ marginTop: 16, display: 'grid', gap: 6 }}>
            {areas.map(a => (
              <div key={a.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 210px) 1fr 44px', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ color: '#475569' }}>{a.name}</span>
                <div style={{ height: 8, background: '#E2E8F0' }}><div style={{ width: `${a.pct * 100}%`, height: '100%', background: a.pct >= 0.7 ? COLOR.right : a.pct >= 0.4 ? '#EAB308' : COLOR.wrong }} /></div>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.correct}/{a.total}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Question grid: 7 per row */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
          {view.questions.map((x, i) => (
            <button key={x.key} onClick={() => pick(i)} title={`${x.chapter} · ${x.question_type}`} style={{
              aspectRatio: '2.2', fontWeight: 700, fontSize: 18, cursor: 'pointer', fontFamily: F, color: '#fff',
              background: tone(x.result), border: 'none', outline: i === sel ? '3px solid #0F172A' : 'none', outlineOffset: 2,
            }}>{i + 1}</button>
          ))}
        </section>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748B', marginBottom: 20 }}>
          {(['right', 'wrong', 'skipped'] as const).map(k => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: COLOR[k] }} />{k[0].toUpperCase() + k.slice(1)}</span>
          ))}
        </div>

        {/* Selected question */}
        <section style={{ background: '#fff', border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14, fontSize: 12, color: '#64748B' }}>
            <strong style={{ color: '#0F172A', fontSize: 14 }}>Q{sel + 1}</strong>
            <span style={{ color: tone(q.result), fontWeight: 700 }}>{q.result === true ? 'Right' : q.result === false ? 'Wrong' : 'Skipped'}</span>
            <span>· {q.chapter}</span>
            <span>· {Math.round((st?.time_spent || 0) / 60 * 10) / 10} min spent</span>
          </div>

          {verbal
            ? <VerbalQuestionView q={q} passage={passage} passageLabel={passageLabel(view.questions, q.passage_id)} answer={st?.answer ?? null} reveal={showAnswer} />
            : <QuestionView q={q} set={set} setLabel={setLabel(view.questions, q.set_id)} answer={st?.answer ?? null} reveal={showAnswer} />}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => setShowSolution(v => !v)} style={toggle(showSolution)}>{showSolution ? 'Hide Solution' : 'Show Solution'}</button>
            <button onClick={() => setShowAnswer(v => !v)} style={toggle(showAnswer)}>{showAnswer ? 'Hide Answer' : 'Answer'}</button>
          </div>

          {showAnswer && (
            <div style={{ marginTop: 14, padding: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 19 }}>
              Correct answer: <strong>{formatAnswer(q, q.correct_answer)}</strong>
              <span style={{ color: '#64748B' }}> · Yours: {formatAnswer(q, st?.answer ?? null)}</span>
            </div>
          )}
          {showSolution && solution && (
            <div style={{ marginTop: 14, padding: 16, background: '#F8FAFC', borderLeft: '3px solid #2563EB', fontSize: 20, lineHeight: 1.75 }}>
              <MathText>{solution}</MathText>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
            <button onClick={() => pick(Math.max(0, sel - 1))} disabled={sel === 0} style={toggle(false)}>← Prev</button>
            <button onClick={() => pick(Math.min(view.questions.length - 1, sel + 1))} disabled={sel === view.questions.length - 1} style={toggle(false)}>Next →</button>
          </div>
        </section>
      </main>
    </div>
  );
}

const label: React.CSSProperties = { fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 };
const big: React.CSSProperties = { fontSize: 20, fontWeight: 700 };
function toggle(on: boolean): React.CSSProperties {
  return { padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, background: on ? '#0F172A' : '#fff', color: on ? '#fff' : '#0F172A', border: '1px solid #0F172A' };
}

export default function GreResultPage() {
  return <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}><GreResultInner /></Suspense>;
}
