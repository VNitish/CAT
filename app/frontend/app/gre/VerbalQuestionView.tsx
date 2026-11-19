'use client';
// Renders one GRE Verbal question: Text Completion (one column of choices per
// blank), Sentence Equivalence (pick exactly two of six), and Reading
// Comprehension (one answer, select-all, or select-a-sentence in the passage).
// RC questions show the passage on the left and the question on the right, as on
// the GRE. Interactive during the test (onChange); read-only on the evaluation
// page, where `reveal` marks the correct choice(s) and the candidate's pick.
import MathText from '@/app/components/MathText';
import { GreAnswer, GrePassage, GreQuestion } from '@/lib/gre';

const BLUE = '#2563EB';
const GREEN = '#16A34A';
const RED = '#DC2626';
const MARKER = /\*\*\[\d+\]\*\*\s*/g; // line markers like **[10]** inserted for "line N" questions

interface Props {
  q: GreQuestion;
  passage?: GrePassage;
  passageLabel?: string;
  answer: GreAnswer;
  onChange?: (a: GreAnswer) => void;
  reveal?: boolean;
}

// Split a paragraph into sentences for select-in-passage questions. The value of a
// sentence is its text without line markers, which is what the answer key stores.
function sentences(paragraph: string) {
  return paragraph.split(/(?<=[.!?][”"’)]?)\s+(?=[“"(*A-Z])/).filter(Boolean)
    .map(raw => ({ raw, value: raw.replace(MARKER, '').replace(/\s+/g, ' ').trim() }));
}
const norm = (s: string) => s.replace(MARKER, '').replace(/\s+/g, ' ').trim();

export default function VerbalQuestionView({ q, passage, passageLabel, answer, onChange, reveal }: Props) {
  const t = q.question_type;
  const correct = q.correct_answer;
  const list = Array.isArray(answer) ? answer : [];

  const choose = (k: string) => {
    if (!onChange) return;
    if (t === 'SE') {
      const cur = list.filter(Boolean) as string[];
      if (cur.includes(k)) onChange(cur.filter(x => x !== k));
      else if (cur.length < 2) onChange([...cur, k].sort());
    } else if (t === 'RC_MULTI') {
      const cur = list.filter(Boolean) as string[];
      onChange(cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k].sort());
    } else {
      onChange(answer === k ? null : k);
    }
  };
  const chooseBlank = (bi: number, k: string) => {
    if (!onChange || !q.blanks) return;
    const cur = q.blanks.map((_, i) => (Array.isArray(answer) ? answer[i] ?? null : null));
    cur[bi] = cur[bi] === k ? null : k;
    onChange(cur.some(Boolean) ? cur : null);
  };

  const body = (
    <div>
      {q.question_text && <div style={{ marginBottom: 18 }}><MathText>{q.question_text}</MathText></div>}

      {t === 'TC' && q.blanks && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${q.blanks.length}, minmax(0, 1fr))`, gap: 16, maxWidth: q.blanks.length === 1 ? 420 : undefined }}>
          {q.blanks.map((b, bi) => (
            <div key={bi} style={{ border: '1px solid #CBD5E1' }}>
              {q.blanks!.length > 1 && <div style={{ padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#475569', background: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>{b.label}</div>}
              {Object.entries(b.options).map(([k, text]) => {
                const sel = Array.isArray(answer) && answer[bi] === k;
                const right = reveal && Array.isArray(correct) && correct[bi] === k;
                return (
                  <button key={k} type="button" onClick={() => chooseBlank(bi, k)} disabled={!onChange} style={{
                    display: 'block', width: '100%', textAlign: 'center', padding: '12px 14px', font: 'inherit', color: 'inherit',
                    borderTop: '1px solid #E2E8F0', borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
                    background: right ? '#DCFCE7' : sel ? (reveal ? '#FEE2E2' : '#DBEAFE') : '#fff',
                    outline: sel ? `2px solid ${reveal && !right ? RED : BLUE}` : right ? `2px solid ${GREEN}` : 'none', outlineOffset: -2,
                    cursor: onChange ? 'pointer' : 'default',
                  }}>
                    <MathText inline>{text}</MathText>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {(t === 'SE' || t === 'RC_MCQ' || t === 'RC_MULTI') && q.options && (
        <>
          {t !== 'RC_MCQ' && (
            <div style={{ fontSize: 17, color: '#64748B', marginBottom: 10 }}>
              {t === 'SE' ? 'Select exactly two answer choices that complete the sentence with the same meaning.' : 'Consider each answer choice separately and select all that apply.'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(q.options).map(([k, text]) => {
              const multi = t !== 'RC_MCQ';
              const sel = multi ? list.includes(k) : answer === k;
              const right = reveal && (Array.isArray(correct) ? correct.includes(k) : correct === k);
              const border = reveal ? (right ? `2px solid ${GREEN}` : sel ? `2px solid ${RED}` : '1px solid #E2E8F0') : sel ? `2px solid ${BLUE}` : '1px solid #E2E8F0';
              const bg = reveal ? (right ? '#F0FDF4' : sel ? '#FEF2F2' : '#fff') : sel ? '#EFF6FF' : '#fff';
              return (
                <button key={k} type="button" onClick={() => choose(k)} disabled={!onChange}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', padding: '14px 18px', border, background: bg, cursor: onChange ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }}>
                  <span style={{
                    width: 26, height: 26, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: `1.5px solid ${sel ? BLUE : '#94A3B8'}`, borderRadius: multi ? 3 : '50%', background: sel ? BLUE : '#fff', color: '#fff', fontSize: 14, fontWeight: 700,
                  }}>{sel ? (multi ? '✓' : '●') : ''}</span>
                  <span style={{ flex: 1 }}><MathText inline>{text}</MathText></span>
                  {reveal && right && <span style={{ fontSize: 15, color: GREEN, fontWeight: 700 }}>Correct</span>}
                  {reveal && sel && !right && <span style={{ fontSize: 15, color: RED, fontWeight: 700 }}>Your pick</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {t === 'RC_SELECT' && (
        <div style={{ fontSize: 17, color: '#64748B' }}>
          Click the sentence in the passage that answers the question.
          {typeof answer === 'string' && <div style={{ marginTop: 10, color: '#0F172A' }}>Selected: <em>“{answer}”</em></div>}
        </div>
      )}
    </div>
  );

  if (!passage) return <div style={{ fontSize: 22, lineHeight: 1.65, color: '#111' }}>{body}</div>;

  const selectable = t === 'RC_SELECT';
  return (
    <div style={{ fontSize: 22, lineHeight: 1.65, color: '#111', display: 'grid', gap: 28, alignItems: 'start', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))' }}>
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px 20px', position: 'sticky', top: 0, maxHeight: '75vh', overflow: 'auto', fontSize: 20 }}>
        {passageLabel && <div style={{ fontSize: 15, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{passageLabel}</div>}
        {passage.text.split(/\n\s*\n/).map((para, pi) => (
          <p key={pi} style={{ margin: '0 0 14px' }}>
            {selectable
              ? sentences(para).map((s, si) => {
                  const sel = typeof answer === 'string' && norm(answer) === s.value;
                  const right = reveal && typeof correct === 'string' && norm(correct) === s.value;
                  return (
                    <span key={si} onClick={() => onChange?.(sel ? null : s.value)} style={{
                      cursor: onChange ? 'pointer' : 'default', padding: '1px 0',
                      background: right ? '#BBF7D0' : sel ? (reveal ? '#FECACA' : '#BFDBFE') : 'transparent',
                    }}><MathText inline>{s.raw}</MathText>{' '}</span>
                  );
                })
              : <MathText inline>{para}</MathText>}
          </p>
        ))}
      </div>
      {body}
    </div>
  );
}
