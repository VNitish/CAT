'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/auth';
import MathText from '@/app/components/MathText';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

interface Opt { label: string; text: string; }
interface Card {
  _id: string; order: number; difficulty: string;
  setup: string; set_id: string | null;
  question_text: string; figure: string;
  options: Opt[]; answer_format: string;
  correct_answer: string; solution_steps: string[];
  attempt: { chosen: string; correct: boolean } | null;
}
interface TopicMeta {
  slug: string; name: string; accent: string; tagline: string;
  concept_title: string; concept_explanation: string; approach_steps: string[];
}

const DIFF_COLOR: Record<string, string> = { Easy: '#228B22', Moderate: '#C57A00', Hard: '#C0392B' };

export default function LrDeckPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.topic as string;
  const { user } = useAuth();

  const [topic, setTopic] = useState<TopicMeta | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const [i, setI] = useState(0);
  const [conceptOpen, setConceptOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  // per-card local record { chosen, correct } (seeded from server attempt)
  const [results, setResults] = useState<Record<string, { chosen: string; correct: boolean }>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiFetch(`/api/lr/topic/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.topic) {
          setTopic(d.topic); setCards(d.questions || []);
          const seed: Record<string, { chosen: string; correct: boolean }> = {};
          (d.questions || []).forEach((q: Card) => { if (q.attempt) seed[q._id] = q.attempt; });
          setResults(seed);
          setStatus('ok');
        } else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [slug]);

  const card = cards[i];
  const acc = topic?.accent || '#7B2FBE';

  // reset per-card interaction when moving between cards
  useEffect(() => {
    if (!card) return;
    const prior = results[card._id];
    setSelected(prior ? prior.chosen : null);
    setRevealed(!!prior);
    setConceptOpen(i === 0);
  }, [i, card]); // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = useCallback((chosen: string | null) => {
    if (!card) return;
    const correct = chosen === card.correct_answer;
    setRevealed(true);
    if (chosen) {
      setResults(r => ({ ...r, [card._id]: { chosen, correct } }));
      // persist (silently no-ops if not logged in)
      apiFetch('/api/lr/attempt', {
        method: 'POST',
        body: JSON.stringify({ question_id: card._id, chosen, correct }),
      }).catch(() => {});
    }
  }, [card]);

  const goNext = useCallback(() => {
    if (i < cards.length - 1) setI(i + 1);
    else setDone(true);
  }, [i, cards.length]);

  // keyboard: 1-4 select, Enter check/next
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (done || !card) return;
      if (!revealed && ['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (card.options[idx]) setSelected(card.options[idx].label);
      } else if (e.key === 'Enter') {
        if (!revealed && selected) reveal(selected);
        else if (revealed) goNext();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [card, revealed, selected, done, reveal, goNext]);

  if (status === 'loading') return <Shell><div style={{ padding: 60, textAlign: 'center', color: '#888' }}>Loading...</div></Shell>;
  if (status === 'error' || !topic) return <Shell><div style={{ padding: 60, textAlign: 'center', color: '#cc3300' }}>Could not load this topic.</div></Shell>;

  const attemptedCount = Object.keys(results).length;
  const correctCount = Object.values(results).filter(r => r.correct).length;

  // ---------- SUMMARY ----------
  if (done) {
    const accuracy = attemptedCount ? Math.round((correctCount / attemptedCount) * 100) : 0;
    return (
      <Shell accent={acc} name={topic.name} onBack={() => router.push('/lr')}>
        <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🎉</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 4px' }}>{topic.name} deck complete</h2>
          <p style={{ color: '#666', margin: '0 0 24px' }}>Nice work. Here is how this run went.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 28 }}>
            <Stat label="Attempted" value={`${attemptedCount} / ${cards.length}`} />
            <Stat label="Correct" value={String(correctCount)} color="#228B22" />
            <Stat label="Accuracy" value={`${accuracy}%`} color={acc} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => { setI(0); setDone(false); }} style={btn(acc)}>Review from start</button>
            <button onClick={() => router.push('/lr')} style={btnGhost}>Back to topics</button>
          </div>
          {!user && <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>Log in to save this progress across sessions.</p>}
        </div>
      </Shell>
    );
  }

  // ---------- CARD ----------
  const chosenResult = results[card._id];
  const progressPct = ((i + (revealed ? 1 : 0)) / cards.length) * 100;

  return (
    <Shell accent={acc} name={topic.name} onBack={() => router.push('/lr')}>
      {/* progress */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#555' }}>Question {i + 1} of {cards.length}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: DIFF_COLOR[card.difficulty] || '#777', background: `${DIFF_COLOR[card.difficulty] || '#777'}18`, padding: '3px 10px', borderRadius: 99 }}>{card.difficulty}</span>
        </div>
        <div style={{ height: 5, background: '#e9ebee', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: acc, borderRadius: 99, transition: 'width .3s' }} />
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '18px 20px 60px' }}>
        {/* CONCEPT panel */}
        <div style={{ border: `1px solid ${acc}33`, background: `${acc}0d`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
          <div onClick={() => setConceptOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 15px', cursor: 'pointer' }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: acc }}>💡 Concept · {topic.concept_title}</span>
            <span style={{ fontSize: 12, color: acc, fontWeight: 600 }}>{conceptOpen ? 'Hide' : 'Show'}</span>
          </div>
          {conceptOpen && (
            <div style={{ padding: '0 16px 14px', fontSize: 13.5, color: '#333', lineHeight: 1.6 }}>
              <div className="lr-md"><MathText>{topic.concept_explanation}</MathText></div>
              {topic.approach_steps?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: acc, marginBottom: 5 }}>How to approach</div>
                  <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {topic.approach_steps.map((s, k) => <li key={k} style={{ marginBottom: 3 }}>{s}</li>)}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CARD */}
        <div style={{ background: '#fff', border: '1px solid #e4e4e4', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {card.setup && (
            <div style={{ background: '#f6f7f9', border: '1px solid #e8eaed', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13.5, color: '#333' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>Setup</div>
              <div className="lr-md"><MathText>{card.setup}</MathText></div>
            </div>
          )}
          {card.figure && <div style={{ margin: '4px 0 14px', textAlign: 'center' }}><MathText>{card.figure}</MathText></div>}

          <div className="lr-md" style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.6, marginBottom: 16, color: '#1c1c1c' }}>
            <MathText>{card.question_text}</MathText>
          </div>

          {/* options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {card.options.map((o, idx) => {
              const isSel = selected === o.label;
              const isCorrect = o.label === card.correct_answer;
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
              <span style={{ fontSize: 11.5, color: '#aaa', marginLeft: 'auto' }}>press 1-{card.options.length} to pick, Enter to check</span>
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              {/* verdict */}
              {chosenResult ? (
                <div style={{ fontSize: 14, fontWeight: 700, color: chosenResult.correct ? '#228B22' : '#C0392B', marginBottom: 12 }}>
                  {chosenResult.correct ? '✓ Correct' : `✕ Not quite. The answer is (${card.correct_answer}).`}
                </div>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 12 }}>Answer: ({card.correct_answer})</div>
              )}
              {/* solution */}
              <div style={{ background: '#fafbfc', border: '1px solid #eceef1', borderRadius: 10, padding: '13px 16px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: acc, marginBottom: 7 }}>Solution</div>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {card.solution_steps.map((s, k) => (
                    <li key={k} style={{ marginBottom: 6, fontSize: 13.5, lineHeight: 1.55, color: '#333' }}><span className="lr-md"><MathText>{s}</MathText></span></li>
                  ))}
                </ol>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={goNext} style={btn(acc)}>{i < cards.length - 1 ? 'Next question →' : 'Finish deck →'}</button>
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
      </div>
      <style>{`.lr-md p{margin:0 0 .5em}.lr-md p:last-child{margin-bottom:0}.lr-md strong{font-weight:700}.lr-md ul,.lr-md ol{margin:.3em 0;padding-left:1.1em}`}</style>
    </Shell>
  );
}

function Shell({ children, accent = '#7B2FBE', name, onBack }: { children: React.ReactNode; accent?: string; name?: string; onBack?: () => void; }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: F, color: '#222' }}>
      <div style={{ background: '#121212', color: '#fff', padding: '13px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={onBack} style={{ fontSize: 13, color: '#bbb', cursor: 'pointer' }}>← Topics</div>
        <div style={{ width: 8, height: 8, borderRadius: 99, background: accent }} />
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{name || 'Logical Reasoning'}</div>
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
