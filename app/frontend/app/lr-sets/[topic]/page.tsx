'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/auth';
import MathText from '@/app/components/MathText';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

interface Opt { label: string; text: string; }
interface Q {
  q_slug: string; order: number; question_text: string; figure: string;
  options: Opt[]; answer_format: string; correct_answer: string; solution_steps: string[];
  attempt: { chosen: string; correct: boolean } | null;
}
interface SetT {
  set_slug: string; order: number; difficulty: string; pattern_type: string;
  title: string; setup: string; figure: string; source: string; questions: Q[];
}
interface TopicMeta { slug: string; name: string; accent: string; tagline: string; pattern_types: string[]; }

// a flattened work item: one sub-question plus its parent set
interface Item extends Q { set: SetT; idxInSet: number; setSize: number; isFirstInSet: boolean; }

const DIFF_COLOR: Record<string, string> = { Moderate: '#C57A00', Advanced: '#C0392B' };

export default function LrSetPlayer() {
  const router = useRouter();
  const params = useParams();
  const slug = params.topic as string;
  const { user } = useAuth();

  const [topic, setTopic] = useState<TopicMeta | null>(null);
  const [sets, setSets] = useState<SetT[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const [i, setI] = useState(0);
  const [setupOpen, setSetupOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Record<string, { chosen: string; correct: boolean }>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiFetch(`/api/lrp/topic/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.topic) {
          setTopic(d.topic); setSets(d.sets || []);
          const seed: Record<string, { chosen: string; correct: boolean }> = {};
          (d.sets || []).forEach((s: SetT) => (s.questions || []).forEach(q => { if (q.attempt) seed[q.q_slug] = q.attempt; }));
          setResults(seed);
          setStatus('ok');
        } else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [slug]);

  // flatten sets -> items
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    sets.forEach(s => (s.questions || []).forEach((q, k) => {
      out.push({ ...q, set: s, idxInSet: k, setSize: s.questions.length, isFirstInSet: k === 0 });
    }));
    return out;
  }, [sets]);

  const item = items[i];
  const acc = topic?.accent || '#378ADD';

  useEffect(() => {
    if (!item) return;
    const prior = results[item.q_slug];
    setSelected(prior ? prior.chosen : null);
    setRevealed(!!prior);
    setSetupOpen(true); // scenario is needed to answer, so keep it open
  }, [i, item]); // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = useCallback((chosen: string | null) => {
    if (!item) return;
    const correct = chosen === item.correct_answer;
    setRevealed(true);
    if (chosen) {
      setResults(r => ({ ...r, [item.q_slug]: { chosen, correct } }));
      apiFetch('/api/lrp/attempt', {
        method: 'POST',
        body: JSON.stringify({ q_slug: item.q_slug, topic_slug: slug, set_slug: item.set.set_slug, chosen, correct }),
      }).catch(() => {});
    }
  }, [item, slug]);

  const goNext = useCallback(() => {
    if (i < items.length - 1) setI(i + 1);
    else setDone(true);
  }, [i, items.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (done || !item) return;
      if (!revealed && ['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (item.options[idx]) setSelected(item.options[idx].label);
      } else if (e.key === 'Enter') {
        if (!revealed && selected) reveal(selected);
        else if (revealed) goNext();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [item, revealed, selected, done, reveal, goNext]);

  if (status === 'loading') return <Shell><div style={{ padding: 60, textAlign: 'center', color: '#888' }}>Loading...</div></Shell>;
  if (status === 'error' || !topic) return <Shell><div style={{ padding: 60, textAlign: 'center', color: '#cc3300' }}>Could not load this topic.</div></Shell>;

  const attemptedCount = Object.keys(results).length;
  const correctCount = Object.values(results).filter(r => r.correct).length;

  // ---------- SUMMARY ----------
  if (done) {
    const accuracy = attemptedCount ? Math.round((correctCount / attemptedCount) * 100) : 0;
    return (
      <Shell accent={acc} name={topic.name} onBack={() => router.push('/lr-sets')}>
        <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🎯</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 4px' }}>{topic.name} — sets complete</h2>
          <p style={{ color: '#666', margin: '0 0 24px' }}>Here is how this run went.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
            <Stat label="Attempted" value={`${attemptedCount} / ${items.length}`} />
            <Stat label="Correct" value={String(correctCount)} color="#228B22" />
            <Stat label="Accuracy" value={`${accuracy}%`} color={acc} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => { setI(0); setDone(false); }} style={btn(acc)}>Review from start</button>
            <button onClick={() => router.push('/lr-sets')} style={btnGhost}>Back to topics</button>
          </div>
          {!user && <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>Log in to save this progress across sessions.</p>}
        </div>
      </Shell>
    );
  }

  // ---------- QUESTION ----------
  const chosenResult = results[item.q_slug];
  const progressPct = ((i + (revealed ? 1 : 0)) / items.length) * 100;
  const diffC = DIFF_COLOR[item.set.difficulty] || '#777';

  return (
    <Shell accent={acc} name={topic.name} onBack={() => router.push('/lr-sets')}>
      {/* progress */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#555' }}>Question {i + 1} of {items.length}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: diffC, background: `${diffC}18`, padding: '3px 10px', borderRadius: 99 }}>{item.set.difficulty}</span>
        </div>
        <div style={{ height: 5, background: '#e9ebee', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: acc, borderRadius: 99, transition: 'width .3s' }} />
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '18px 20px 60px' }}>
        {/* SET scenario panel */}
        <div style={{ border: `1px solid ${acc}33`, background: `${acc}0d`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
          <div onClick={() => setSetupOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 15px', cursor: 'pointer' }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: acc }}>
              📋 {item.set.title}
              <span style={{ fontWeight: 600, fontSize: 11.5, color: acc, opacity: 0.85, marginLeft: 8 }}>· {item.set.pattern_type}</span>
            </span>
            <span style={{ fontSize: 12, color: acc, fontWeight: 600 }}>{setupOpen ? 'Hide' : 'Show'} scenario</span>
          </div>
          {setupOpen && (
            <div style={{ padding: '0 16px 14px', fontSize: 13.5, color: '#333', lineHeight: 1.6 }}>
              <div className="lr-md"><MathText>{item.set.setup}</MathText></div>
              {item.set.figure && <div style={{ margin: '10px 0 2px', textAlign: 'center' }}><MathText>{item.set.figure}</MathText></div>}
              <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>Question {item.idxInSet + 1} of {item.setSize} in this set</div>
            </div>
          )}
        </div>

        {/* QUESTION card */}
        <div style={{ background: '#fff', border: '1px solid #e4e4e4', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {item.figure && <div style={{ margin: '4px 0 14px', textAlign: 'center' }}><MathText>{item.figure}</MathText></div>}

          <div className="lr-md" style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.6, marginBottom: 16, color: '#1c1c1c' }}>
            <MathText>{item.question_text}</MathText>
          </div>

          {/* options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {item.options.map((o) => {
              const isSel = selected === o.label;
              const isCorrect = o.label === item.correct_answer;
              let bd = '#e0e2e6', bg = '#fff', badge = acc;
              if (revealed) {
                if (isCorrect) { bd = '#228B22'; bg = '#f0f9f0'; badge = '#228B22'; }
                else if (isSel) { bd = '#C0392B'; bg = '#fbeeec'; badge = '#C0392B'; }
              } else if (isSel) { bd = acc; bg = `${acc}0d`; }
              return (
                <div key={o.label}
                  onClick={() => { if (!revealed) setSelected(o.label); }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 14px',
                    border: `1.5px solid ${bd}`, background: bg, borderRadius: 10,
                    cursor: revealed ? 'default' : 'pointer', transition: 'all .12s',
                  }}>
                  <span style={{ flex: '0 0 auto', width: 22, height: 22, borderRadius: 6, background: (isSel || (revealed && isCorrect)) ? badge : '#eef0f2', color: (isSel || (revealed && isCorrect)) ? '#fff' : '#666', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase', marginTop: 1 }}>{o.label}</span>
                  <span style={{ fontSize: 14, color: '#2a2a2a', lineHeight: 1.45, flex: 1 }}>{o.text}</span>
                  {revealed && isCorrect && <span style={{ color: '#228B22', fontWeight: 700, fontSize: 13 }}>✓</span>}
                  {revealed && isSel && !isCorrect && <span style={{ color: '#C0392B', fontWeight: 700, fontSize: 13 }}>✕</span>}
                </div>
              );
            })}
          </div>

          {/* actions */}
          {!revealed ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
              <button disabled={!selected} onClick={() => reveal(selected)}
                style={{ ...btn(acc), opacity: selected ? 1 : 0.45, cursor: selected ? 'pointer' : 'not-allowed' }}>Check answer</button>
              <button onClick={() => reveal(null)} style={btnGhost}>Show solution</button>
              <span style={{ fontSize: 11.5, color: '#aaa', marginLeft: 'auto' }}>press 1-{item.options.length} to pick, Enter to check</span>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              {chosenResult ? (
                <div style={{ fontSize: 14, fontWeight: 700, color: chosenResult.correct ? '#228B22' : '#C0392B', marginBottom: 12 }}>
                  {chosenResult.correct ? '✓ Correct' : `✕ Not quite. The answer is (${item.correct_answer}).`}
                </div>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 12 }}>Answer: ({item.correct_answer})</div>
              )}
              <div style={{ background: '#fafbfc', border: '1px solid #eceef1', borderRadius: 10, padding: '13px 16px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: acc, marginBottom: 7 }}>Solution</div>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {item.solution_steps.map((s, k) => (
                    <li key={k} style={{ marginBottom: 6, fontSize: 13.5, lineHeight: 1.55, color: '#333' }}><span className="lr-md"><MathText>{s}</MathText></span></li>
                  ))}
                </ol>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={goNext} style={btn(acc)}>{i < items.length - 1 ? 'Next question →' : 'Finish →'}</button>
                {i > 0 && <button onClick={() => setI(i - 1)} style={btnGhost}>← Previous</button>}
              </div>
            </div>
          )}
        </div>

        {/* footer nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12.5, color: '#999' }}>
          <span onClick={() => i > 0 && setI(i - 1)} style={{ cursor: i > 0 ? 'pointer' : 'default', opacity: i > 0 ? 1 : 0.4 }}>← Previous</span>
          <span>{attemptedCount} attempted · {correctCount} correct</span>
          <span onClick={goNext} style={{ cursor: 'pointer' }}>Next →</span>
        </div>
        <div style={{ marginTop: 18, fontSize: 11, color: '#bbb', textAlign: 'center' }}>{item.set.source}</div>
      </div>
      <style>{`.lr-md p{margin:0 0 .5em}.lr-md p:last-child{margin-bottom:0}.lr-md strong{font-weight:700}.lr-md ul,.lr-md ol{margin:.3em 0;padding-left:1.1em}`}</style>
    </Shell>
  );
}

function Shell({ children, accent = '#378ADD', name, onBack }: { children: React.ReactNode; accent?: string; name?: string; onBack?: () => void; }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: F, color: '#222' }}>
      <div style={{ background: '#121212', color: '#fff', padding: '13px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={onBack} style={{ fontSize: 13, color: '#bbb', cursor: 'pointer' }}>← Topics</div>
        <div style={{ width: 8, height: 8, borderRadius: 99, background: accent }} />
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{name || 'LR Practice Sets'}</div>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color = '#222' }: { label: string; value: string; color?: string; }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e4', borderRadius: 12, padding: '16px 22px', minWidth: 110 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#888', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: F });
const btnGhost: React.CSSProperties = { background: '#fff', color: '#555', border: '1px solid #d8dade', borderRadius: 9, padding: '10px 16px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: F };
