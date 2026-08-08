'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/auth';
import {
  C, F, Shell, TopBar, Frame, Prose, Formula, Arrow, Overlay, CheckIcon, CloseIcon,
  btnAccent, btnCyan, btnQuiet, btnBare,
} from '../ui';

interface Opt { label: string; text: string }
interface Row { label: string; value: string }
interface Card {
  kind: 'foundation' | 'trap' | 'plain';
  eyebrow: string;
  headline: string;
  subheadline: string;
  chips: string[];
  lines: string[];
  rows: Row[];
  note: string;
}
interface SheetItem { title: string; body: string; highlight: boolean }
interface ChapterMeta {
  slug: string; name: string; status: 'ready' | 'coming_soon';
  tagline: string; intro: string; hero_image: string;
  overview_cards: Card[];
  formula_sheet: { hero: { label: string; value: string }; items: SheetItem[] };
}
interface Question {
  _id: string; order: number; tag: string; difficulty: string;
  question_text: string; figure: string; options: Opt[];
  correct_answer: string; concept: string; answer_display: string; solution: string;
  attempt: { chosen: string; correct: boolean } | null;
}
interface Result { tag: string; answer: string; correct: boolean }

type Screen = 'overview' | 'session' | 'done';

export default function RevisionChapterPage() {
  const router = useRouter();
  const slug = useParams().chapter as string;
  const { user } = useAuth();

  const [chapter, setChapter] = useState<ChapterMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const [screen, setScreen] = useState<Screen>('overview');
  const [qIndex, setQIndex] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const [openCard, setOpenCard] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch(`/api/revision/chapter/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.chapter) { setChapter(d.chapter); setQuestions(d.questions || []); setStatus('ok'); }
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [slug]);

  // Which concept cards this chapter has already been marked "reviewed" for —
  // stored locally per chapter, since it's a personal recall checklist, not a score.
  useEffect(() => {
    if (!slug) return;
    try {
      const raw = localStorage.getItem(`revision:reviewed:${slug}`);
      setReviewed(new Set(raw ? JSON.parse(raw) : []));
    } catch { setReviewed(new Set()); }
  }, [slug]);

  const toggleReviewed = useCallback((eyebrow: string) => {
    setReviewed(prev => {
      const next = new Set(prev);
      next.has(eyebrow) ? next.delete(eyebrow) : next.add(eyebrow);
      try { localStorage.setItem(`revision:reviewed:${slug}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [slug]);

  useEffect(() => {
    if (openCard === null) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenCard(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [openCard]);

  const total = questions.length;
  const q = questions[qIndex];
  const answerOf = useCallback(
    (x: Question) => x.answer_display || x.options.find(o => o.label === x.correct_answer)?.text || x.correct_answer,
    []
  );

  const backHome = useCallback(() => router.push('/revision'), [router]);
  const startPractice = useCallback(() => {
    setScreen('session'); setQIndex(0); setSel(null); setResults([]);
  }, []);

  const pick = useCallback((label: string) => {
    if (sel !== null || !q) return;
    const correct = label === q.correct_answer;
    setSel(label);
    setResults(r => [...r, { tag: q.tag, answer: answerOf(q), correct }]);
    // Anonymous runs stay local — the attempt endpoint needs a token.
    if (user) {
      apiFetch('/api/revision/attempt', {
        method: 'POST',
        body: JSON.stringify({ question_id: q._id, chosen: label, correct }),
      }).catch(() => {});
    }
  }, [sel, q, answerOf, user]);

  const next = useCallback(() => {
    if (qIndex + 1 >= total) setScreen('done');
    else { setQIndex(qIndex + 1); setSel(null); }
  }, [qIndex, total]);

  // 1-4 to pick, Enter to advance once answered.
  useEffect(() => {
    if (screen !== 'session') return;
    const h = (e: KeyboardEvent) => {
      if (!q) return;
      if (sel === null) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && q.options[idx]) pick(q.options[idx].label);
      } else if (e.key === 'Enter') next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen, q, sel, pick, next]);

  const correctCount = results.filter(r => r.correct).length;
  const missed = results.filter(r => !r.correct);

  const crumb = useMemo(() => {
    if (!chapter) return 'Loading';
    if (screen === 'overview') return `${chapter.name}, chapter overview`;
    if (screen === 'done') return `${chapter.name}, complete`;
    return chapter.name;
  }, [chapter, screen]);

  if (status === 'loading') {
    return <Shell><TopBar crumb="Loading" /><Msg>Loading chapter...</Msg></Shell>;
  }
  if (status === 'error' || !chapter) {
    return (
      <Shell>
        <TopBar crumb="Not found" right={<button onClick={backHome} style={btnBare}>Back</button>} />
        <Msg tone="error">Could not load this chapter.</Msg>
      </Shell>
    );
  }
  if (total === 0) {
    return (
      <Shell>
        <TopBar crumb={chapter.name} right={<button onClick={backHome} style={btnBare}>Back</button>} />
        <Msg>{chapter.name} is not ready yet. Come back once its overview and questions are in.</Msg>
      </Shell>
    );
  }

  /* ── top bar right slot ─────────────────────────────────────────────────── */
  let right: React.ReactNode = null;
  if (screen === 'overview') {
    right = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => window.print()} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 15px', borderRadius: 10,
          border: 'none', background: C.panel, color: C.text, font: `600 12.5px ${F}`, cursor: 'pointer',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 4v11M7 11l5 5 5-5M5 20h14" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download sheet
        </button>
        <button onClick={backHome} style={btnBare}>Back</button>
      </div>
    );
  } else if (screen === 'session') {
    right = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ font: `600 12px/1 ${F}`, color: C.muted, whiteSpace: 'nowrap' }}>Question {qIndex + 1} of {total}</span>
        <div style={{ width: 150, height: 6, borderRadius: 3, background: C.line2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: C.accent, width: `${Math.round(((qIndex + 1) / total) * 100)}%`, transition: 'width .3s' }} />
        </div>
        <button onClick={backHome} style={btnBare}>Exit</button>
      </div>
    );
  }

  return (
    <Shell>
      <TopBar crumb={crumb} right={right} />

      {/* ═══ OVERVIEW ═══ */}
      {screen === 'overview' && (
        <div style={{ padding: '44px 56px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ maxWidth: 660, marginBottom: 24 }}>
            <div style={{ font: `600 11px/1 ${F}`, letterSpacing: '.16em', color: C.accent, textTransform: 'uppercase', marginBottom: 14 }}>
              Chapter overview
            </div>
            <h1 style={{ margin: '0 0 12px', font: `800 36px/1.08 ${F}`, color: C.textHi, letterSpacing: '-.03em' }}>{chapter.name}</h1>
            {chapter.intro && (
              <p className="rv-md" style={{ margin: 0, font: `400 15.5px/1.6 ${F}`, color: C.muted }}>
                <Prose>{chapter.intro}</Prose>
              </p>
            )}
          </div>

          <div style={{ height: 200, borderRadius: 18, overflow: 'hidden', border: `1px solid ${C.line2}`, marginBottom: 22 }}>
            <Frame src={chapter.hero_image} alt="" />
          </div>

          <div className="rv-noprint" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ font: `600 11px/1 ${F}`, letterSpacing: '.1em', color: C.dim, textTransform: 'uppercase' }}>
              {chapter.overview_cards.length} concepts — tap one to open it
            </span>
            <span style={{ font: `700 12px ${F}`, color: C.accent }}>
              {reviewed.size} of {chapter.overview_cards.length} reviewed
            </span>
          </div>

          {/* Screen: title-only tiles that expand into a focused pop-up. */}
          <div className="rv-screen-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {chapter.overview_cards.map((card, i) => (
              <ConceptTile key={i} card={card} done={reviewed.has(card.eyebrow)} onOpen={() => setOpenCard(i)} />
            ))}
          </div>

          {/* Print: the full worked detail, so "Download sheet" still yields something useful offline. */}
          <div className="rv-print-only" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {chapter.overview_cards.map((card, i) => <OverviewCard key={i} card={card} />)}
          </div>

          {openCard !== null && chapter.overview_cards[openCard] && (
            <Overlay onClose={() => setOpenCard(null)} maxWidth={720}>
              <div style={{ padding: '30px 32px 32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ font: `700 11.5px/1 ${F}`, letterSpacing: '.14em', color: C.accent, textTransform: 'uppercase' }}>Concept</span>
                  <button
                    onClick={() => setOpenCard(null)}
                    aria-label="Close"
                    style={{ background: C.panel, border: 'none', borderRadius: 10, width: 34, height: 34, display: 'grid', placeItems: 'center', color: C.muted, cursor: 'pointer' }}
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>
                <OverviewCard card={chapter.overview_cards[openCard]} detail />
                <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
                  {(() => {
                    const eyebrow = chapter.overview_cards[openCard].eyebrow;
                    const done = reviewed.has(eyebrow);
                    return (
                      <button
                        onClick={() => toggleReviewed(eyebrow)}
                        style={{ ...(done ? btnQuiet : btnAccent), display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        {done && <CheckIcon size={15} color={C.accent} />}
                        {done ? 'Marked as reviewed' : 'Mark as done'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </Overlay>
          )}

          <div className="rv-noprint" style={{
            position: 'sticky', bottom: 0, margin: '24px -56px 0', padding: '20px 56px',
            background: `linear-gradient(180deg, rgba(23,24,26,0), ${C.shell} 38%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            borderTop: `1px solid ${C.line}`,
          }}>
            <span style={{ font: `500 14px/1.4 ${F}`, color: C.muted }}>
              Feel like it is all back in place? Lock it in with the questions.
            </span>
            <button onClick={startPractice} style={btnCyan}>
              Start practice, {total} question{total === 1 ? '' : 's'}
              <Arrow size={16} color={C.onCyan} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ SESSION ═══ */}
      {screen === 'session' && q && (
        <div style={{ display: 'grid', gridTemplateColumns: '.86fr 1.14fr', flex: 1 }}>
          {/* concept: the tool this specific question needs, not its worked steps */}
          <div style={{ padding: '30px 28px 32px', borderRight: `1px solid ${C.line}`, background: C.bar }}>
            <div style={{ font: `700 11px/1 ${F}`, letterSpacing: '.12em', color: C.accent, textTransform: 'uppercase', marginBottom: 16 }}>
              Concept
            </div>
            {q.concept ? (
              <div style={{ background: C.panel, borderRadius: 16, padding: '20px 22px' }}>
                {q.tag && (
                  <div style={{ font: `700 13.5px/1.3 ${F}`, color: C.cyan, marginBottom: 13 }}>{q.tag}</div>
                )}
                <div className="rv-md" style={{ font: `500 13.5px/1.6 ${F}`, color: C.textMid }}>
                  <Prose inline={false}>{q.concept}</Prose>
                </div>
              </div>
            ) : (
              <>
                {chapter.formula_sheet?.hero?.value && (
                  <div style={{ background: C.panel, borderRadius: 16, padding: '18px 20px', marginBottom: 12 }}>
                    <div style={{ font: `500 11.5px/1 ${F}`, color: C.dim, marginBottom: 9 }}>{chapter.formula_sheet.hero.label}</div>
                    <div className="rv-md" style={{ font: `700 22px/1.2 ${F}`, color: C.text }}>
                      <Formula>{chapter.formula_sheet.hero.value}</Formula>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {(chapter.formula_sheet?.items || []).map((it, i) => (
                    <div key={i} style={{
                      background: it.highlight ? 'rgba(140,231,239,.1)' : C.panel,
                      border: it.highlight ? '1px solid rgba(140,231,239,.25)' : '1px solid transparent',
                      borderRadius: 16, padding: '15px 17px',
                    }}>
                      <div style={{ font: `600 12.5px ${F}`, color: it.highlight ? C.cyan : '#eef0ee', marginBottom: 5 }}>{it.title}</div>
                      <div className="rv-md" style={{ font: `500 12.5px/1.55 ${F}`, color: it.highlight ? '#bfe6ea' : C.muted }}>
                        <Prose inline={false}>{it.body}</Prose>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* question */}
          <div style={{ padding: '32px 34px 30px', display: 'flex', flexDirection: 'column' }}>
            {q.tag && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(140,231,239,.12)', color: C.cyan, font: `600 11px ${F}`, letterSpacing: '.02em' }}>
                  {q.tag}
                </span>
              </div>
            )}
            <p className="rv-md" style={{ margin: '0 0 22px', font: `600 21px/1.45 ${F}`, color: C.text, letterSpacing: '-.01em' }}>
              <Prose>{q.question_text}</Prose>
            </p>
            {q.figure && <div style={{ marginBottom: 18 }}><Prose inline={false}>{q.figure}</Prose></div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {q.options.map(o => {
                const answered = sel !== null;
                const isCorrect = o.label === q.correct_answer;
                const isSel = o.label === sel;
                // Answered: the right option turns green, the wrong pick turns red,
                // the rest fade out. Unanswered: every option sits neutral.
                const state = !answered ? 'idle' : isCorrect ? 'right' : isSel ? 'wrong' : 'muted';
                const edge = state === 'right' ? C.accent : state === 'wrong' ? C.red : C.line2;

                const row: React.CSSProperties = {
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 14,
                  border: `1.5px solid ${edge}`, cursor: answered ? 'default' : 'pointer',
                  background: state === 'right' ? 'rgba(62,229,139,.12)' : state === 'wrong' ? 'rgba(255,107,94,.1)' : C.panel,
                  color: state === 'right' ? '#c9f7dd' : state === 'wrong' ? '#ffcfc9' : C.textMid,
                  opacity: state === 'muted' ? 0.42 : 1,
                  font: `500 15.5px/1.3 ${F}`, width: '100%', textAlign: 'left',
                  outline: 'none', WebkitAppearance: 'none',
                  transition: 'border-color .15s, background .15s, opacity .15s',
                };
                const badge: React.CSSProperties = {
                  flex: 'none', width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center',
                  font: `700 13px ${F}`, textTransform: 'uppercase',
                  background: state === 'right' ? C.accent : state === 'wrong' ? C.red : '#303134',
                  color: state === 'right' ? C.onAccent : state === 'wrong' ? '#2a0d0a' : C.muted,
                };
                const mark = state === 'right' ? 'Correct answer' : state === 'wrong' ? 'Your choice' : '';
                const markStyle: React.CSSProperties = {
                  flex: 'none', font: `700 10.5px ${F}`, letterSpacing: '.06em', textTransform: 'uppercase',
                  color: state === 'right' ? C.accent : C.red,
                };
                return (
                  <button key={o.label} style={row} onClick={() => pick(o.label)} disabled={answered}>
                    <span style={badge}>{o.label}</span>
                    <span className="rv-md" style={{ flex: 1 }}><Prose>{o.text}</Prose></span>
                    {mark && <span style={markStyle}>{mark}</span>}
                  </button>
                );
              })}
            </div>

            {sel !== null && q.solution && (
              <div style={{ marginTop: 20, background: C.panel, borderRadius: 16, padding: '18px 20px', borderLeft: `3px solid ${C.accent}` }}>
                <div style={{ font: `700 11px/1 ${F}`, letterSpacing: '.1em', color: C.accent, textTransform: 'uppercase', marginBottom: 10 }}>
                  Solution &nbsp;&middot;&nbsp; {answerOf(q)}
                </div>
                <div className="rv-md" style={{ font: `400 14.5px/1.6 ${F}`, color: C.textSoft }}>
                  <Prose inline={false}>{q.solution}</Prose>
                </div>
              </div>
            )}

            <div style={{ flex: 1, minHeight: 18 }} />

            {sel !== null && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={next} style={btnAccent}>
                  {qIndex + 1 >= total ? 'Finish session' : 'Next question'}
                  <Arrow size={16} color={C.onAccent} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ DONE ═══ */}
      {screen === 'done' && (
        <div style={{ padding: 56, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: C.accent, display: 'grid', placeItems: 'center', marginBottom: 24 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7" stroke={C.onAccent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ font: `600 11px/1 ${F}`, letterSpacing: '.16em', color: C.accent, textTransform: 'uppercase', marginBottom: 12 }}>
            Session complete
          </div>
          <h1 style={{ margin: '0 0 12px', font: `800 32px/1.14 ${F}`, color: C.textHi, letterSpacing: '-.03em' }}>
            You revised all {total} question{total === 1 ? '' : 's'}
          </h1>
          <p style={{ margin: '0 0 32px', font: `400 15px/1.55 ${F}`, color: C.muted, maxWidth: 460 }}>
            You answered <strong style={{ color: C.text }}>{correctCount} of {total}</strong> correctly on the first try.
            The ones you missed are queued to return, which is what makes them stick.
          </p>

          <div style={{ width: '100%', maxWidth: 520, background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, overflow: 'hidden', marginBottom: 28, textAlign: 'left' }}>
            <div style={{ padding: '16px 20px 13px', font: `700 11px/1 ${F}`, letterSpacing: '.1em', color: C.dim, textTransform: 'uppercase', borderBottom: `1px solid ${C.line}` }}>
              Bring back tomorrow
            </div>
            {missed.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 20px', borderBottom: `1px solid ${C.line}` }}>
                <span style={{ flex: 'none', width: 7, height: 7, borderRadius: 2, background: C.cyan }} />
                <span style={{ font: `600 14px/1.3 ${F}`, color: C.textMid, flex: 1 }}>{m.tag || 'Question'}</span>
                <span style={{ font: `500 12.5px ${F}`, color: C.dim }}>{m.answer}</span>
              </div>
            ))}
            {missed.length === 0 && (
              <div style={{ padding: '16px 20px', font: `500 14px/1.4 ${F}`, color: C.accent }}>
                A clean sweep. Nothing to repeat, come back for the next set.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={startPractice} style={btnAccent}>Revise again</button>
            <button onClick={backHome} style={btnQuiet}>Back to chapters</button>
          </div>
          {!user && (
            <p style={{ marginTop: 20, font: `500 12px ${F}`, color: C.dim }}>Log in to keep this progress across sessions.</p>
          )}
        </div>
      )}
    </Shell>
  );
}

/* Collapsed view of a concept: title only, plus a reviewed dot. The full
 * card (OverviewCard) only renders once this is tapped open, inside an Overlay. */
function ConceptTile({ card, done, onOpen }: { card: Card; done: boolean; onOpen: () => void }) {
  const bg = card.kind === 'foundation' ? C.accent : card.kind === 'trap' ? C.cyan : C.panel;
  const fg = card.kind === 'foundation' ? C.onAccent : card.kind === 'trap' ? C.onCyan : C.textMid;
  return (
    <button
      onClick={onOpen}
      style={{
        position: 'relative', textAlign: 'left', cursor: 'pointer', border: 'none',
        background: bg, borderRadius: 16, padding: '18px 40px 18px 18px', minHeight: 66,
        display: 'flex', alignItems: 'center', font: `700 13.5px/1.35 ${F}`, color: fg,
        transition: 'transform .12s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
    >
      {card.eyebrow}
      <span style={{
        position: 'absolute', top: 12, right: 12, width: 21, height: 21, borderRadius: '50%',
        display: 'grid', placeItems: 'center', flex: 'none',
        background: done ? C.accent : 'rgba(255,255,255,.14)',
        border: done ? 'none' : '1.5px solid rgba(255,255,255,.24)',
      }}>
        {done && <CheckIcon size={11} color={C.onAccent} />}
      </span>
    </button>
  );
}

/* ── overview cards ──────────────────────────────────────────────────────────
 * 'foundation' fills with the accent, 'trap' with the secondary, 'plain' is a
 * neutral panel. Each renders only the fields the chapter actually set.
 * `detail` is used for the pop-up: same content, scaled up for a focused read. */
function OverviewCard({ card, detail = false }: { card: Card; detail?: boolean }) {
  const filled = card.kind === 'foundation' || card.kind === 'trap';
  const bg      = card.kind === 'foundation' ? C.accent : card.kind === 'trap' ? C.cyan : C.panel;
  const eyebrow = card.kind === 'foundation' ? C.onAccent2 : card.kind === 'trap' ? C.onCyan : C.accent;
  const strong  = card.kind === 'foundation' ? C.onAccent : card.kind === 'trap' ? C.onCyan : '#eef0ee';
  const noteCol = filled ? (card.kind === 'foundation' ? C.onAccent2 : C.onCyan2) : (detail ? C.textSoft : C.muted);
  // Bold spans (**like this**) pick up this color via the .rv-md strong CSS var, so
  // "Why it works" pops against whatever background the card actually has —
  // white on the dark panel, the darkest on-brand shade on a filled card.
  const boldCol = filled ? strong : (detail ? C.text : C.textMid);
  const rowLabelCol = filled ? strong : (detail ? C.textSoft : '#d6d8d6');
  const rowValueCol = filled ? strong : (detail ? C.text : C.accent);

  return (
    <div style={{
      background: bg, borderRadius: 20, padding: detail ? (filled ? '36px 38px' : '34px 36px') : (filled ? '24px 26px' : '22px 24px'),
      ...({ '--rv-strong': boldCol } as React.CSSProperties),
    }}>
      {card.eyebrow && (
        <div style={{ font: `700 ${detail ? 13 : 11}px/1.3 ${F}`, letterSpacing: '.1em', color: eyebrow, textTransform: 'uppercase', marginBottom: detail ? 20 : 14 }}>
          {card.eyebrow}
        </div>
      )}

      {card.headline && (
        <div className="rv-md" style={{
          font: card.kind === 'foundation' ? `700 ${detail ? 38 : 30}px/1.15 ${F}` : card.kind === 'trap' ? `700 ${detail ? 25 : 19}px/1.35 ${F}` : `600 ${detail ? 21 : 16}px/1.4 ${F}`,
          color: strong,
          marginBottom: card.kind === 'trap' && card.subheadline ? (detail ? 9 : 6) : 0,
        }}>
          <Formula>{card.headline}</Formula>
        </div>
      )}

      {card.kind === 'trap' && card.subheadline && (
        <div className="rv-md" style={{ font: `700 ${detail ? 25 : 19}px/1.35 ${F}`, color: strong }}>
          <Formula>{card.subheadline}</Formula>
        </div>
      )}

      {card.chips?.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: detail ? 22 : 16, flexWrap: 'wrap' }}>
          {card.chips.map((chip, i) => (
            <span key={i} className="rv-md" style={{
              padding: detail ? '10px 16px' : '8px 13px', borderRadius: 10,
              background: card.kind === 'foundation' ? 'rgba(6,42,24,.12)' : 'rgba(255,255,255,.08)',
              font: `600 ${detail ? 16 : 14}px ${F}`, color: card.kind === 'foundation' ? C.onAccent2 : strong,
            }}>
              <Formula>{chip}</Formula>
            </span>
          ))}
        </div>
      )}

      {card.lines?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: detail ? 12 : 9, marginTop: card.headline ? (detail ? 18 : 12) : 0 }}>
          {card.lines.map((line, i) => (
            <div key={i} className="rv-md" style={{ font: `600 ${detail ? 18.5 : 15}px/1.45 ${F}`, color: filled ? strong : (detail ? C.text : strong) }}><Formula>{line}</Formula></div>
          ))}
          {card.kind === 'plain' && card.subheadline && (
            <div className="rv-md" style={{ font: `600 ${detail ? 17 : 14}px ${F}`, color: C.accent, marginTop: 2 }}>
              <Formula>{card.subheadline}</Formula>
            </div>
          )}
        </div>
      )}

      {card.rows?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: detail ? 15 : 11, marginTop: card.headline || card.lines?.length ? (detail ? 18 : 12) : 0 }}>
          {card.rows.map((r, i) => {
            const last = i === card.rows.length - 1;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', gap: 16,
                borderBottom: last ? 'none' : `1px solid ${filled ? 'rgba(6,42,24,.15)' : C.line3}`,
                paddingBottom: last ? 0 : (detail ? 14 : 10),
              }}>
                <span style={{ font: `500 ${detail ? 17 : 14}px/1.45 ${F}`, color: rowLabelCol }}>{r.label}</span>
                <span className="rv-md" style={{ font: `700 ${detail ? 17 : 14}px/1.45 ${F}`, color: rowValueCol, textAlign: 'right' }}>
                  <Formula>{r.value}</Formula>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {card.note && (
        <div className="rv-md" style={{ marginTop: detail ? 22 : 14, font: `${filled ? 500 : 400} ${detail ? 16.5 : 13}px/${detail ? 1.78 : 1.55} ${F}`, color: noteCol }}>
          <Prose inline={false}>{card.note}</Prose>
        </div>
      )}
    </div>
  );
}

function Msg({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 60, textAlign: 'center', font: `500 14px ${F}`, color: tone === 'error' ? C.red : C.dim }}>
      {children}
    </div>
  );
}
