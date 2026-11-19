'use client';
// Renders one GRE question in any of the five formats. Interactive during the
// test (onChange given); read-only on the evaluation page, where `reveal`
// outlines the correct choice(s) and the candidate's pick.
import MathText from '@/app/components/MathText';
import { GreAnswer, GreQuestion, GreSet, optionsFor } from '@/lib/gre';

const BLUE = '#2563EB';

interface Props {
  q: GreQuestion;
  set?: GreSet;
  answer: GreAnswer;
  onChange?: (a: GreAnswer) => void;
  reveal?: boolean;
  setLabel?: string;               // e.g. "Questions 25–28 refer to the data below"
}

export default function QuestionView({ q, set, answer, onChange, reveal, setLabel }: Props) {
  const opts = optionsFor(q);
  const correct = q.correct_answer;
  const isMulti = q.question_type === 'MULTI';
  const picked = (k: string) => (Array.isArray(answer) ? answer.includes(k) : answer === k);
  const isRight = (k: string) => reveal && (Array.isArray(correct) ? correct.includes(k) : correct === k);

  const choose = (k: string) => {
    if (!onChange) return;
    if (isMulti) {
      const cur = Array.isArray(answer) ? answer : [];
      onChange(cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k].sort());
    } else {
      onChange(answer === k ? null : k);
    }
  };

  return (
    // Data Interpretation: chart on the left, question on the right (stacks on narrow screens), as on the GRE.
    <div style={{ fontSize: 23, lineHeight: 1.65, color: '#111', display: 'grid', gap: 24, alignItems: 'start',
      gridTemplateColumns: set ? 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))' : '1fr' }}>
      {set && (
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 14, position: 'sticky', top: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            {setLabel || 'The following questions refer to the data below'}
          </div>
          {set.intro_latex && <MathText>{set.intro_latex}</MathText>}
          {set.images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', margin: '10px auto 0' }} />
          ))}
        </div>
      )}
      <div>

      {q.common_info_latex && <div style={{ marginBottom: 12 }}><MathText>{q.common_info_latex}</MathText></div>}

      {q.images?.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" style={{ display: 'block', maxWidth: '100%', margin: '0 auto 14px' }} />
      ))}

      {q.question_type === 'QC' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '8px 0 22px' }}>
          {[['Quantity A', q.quantity_a_latex], ['Quantity B', q.quantity_b_latex]].map(([label, body]) => (
            <div key={label} style={{ border: '1px solid #CBD5E1', padding: '18px 20px', textAlign: 'center', background: '#fff' }}>
              <div style={{ fontWeight: 700, textDecoration: 'underline', marginBottom: 6 }}>{label}</div>
              <MathText>{body || ''}</MathText>
            </div>
          ))}
        </div>
      ) : null}
      {q.question_latex && <div style={{ marginBottom: 16 }}><MathText>{q.question_latex}</MathText></div>}

      {isMulti && (
        <div style={{ fontSize: 18, color: '#64748B', marginBottom: 10 }}>
          {q.select_count === 'all' ? 'Select all that apply.' : `Select exactly ${q.select_count}.`}
        </div>
      )}

      {Object.keys(opts).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(opts).map(([k, text]) => {
            const sel = picked(k);
            const right = isRight(k);
            const border = reveal ? (right ? '2px solid #16A34A' : sel ? '2px solid #DC2626' : '1px solid #E2E8F0') : sel ? `2px solid ${BLUE}` : '1px solid #E2E8F0';
            const bg = reveal ? (right ? '#F0FDF4' : sel ? '#FEF2F2' : '#fff') : sel ? '#EFF6FF' : '#fff';
            return (
              <button key={k} type="button" onClick={() => choose(k)} disabled={!onChange}
                style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '16px 20px', border, background: bg, cursor: onChange ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }}>
                <span style={{
                  width: 28, height: 28, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `1.5px solid ${sel ? BLUE : '#94A3B8'}`, borderRadius: isMulti ? 3 : '50%',
                  background: sel ? BLUE : '#fff', color: '#fff', fontSize: 14, fontWeight: 700,
                }}>{sel ? (isMulti ? '✓' : '●') : ''}</span>
                <span style={{ fontWeight: 700, color: '#64748B', width: 18 }}>{k.toUpperCase()}</span>
                <span style={{ flex: 1 }}><MathText inline>{text}</MathText></span>
                {reveal && right && <span style={{ fontSize: 16, color: '#16A34A', fontWeight: 700 }}>Correct</span>}
                {reveal && sel && !right && <span style={{ fontSize: 16, color: '#DC2626', fontWeight: 700 }}>Your pick</span>}
              </button>
            );
          })}
        </div>
      )}

      {q.question_type === 'NUMERIC' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {q.answer_prefix && <span style={{ fontSize: 24 }}>{q.answer_prefix}</span>}
          <input value={typeof answer === 'string' ? answer : ''} readOnly={!onChange} inputMode="decimal" autoComplete="off"
            onChange={e => onChange?.(e.target.value.replace(/[^0-9.,\-]/g, '') || null)}
            style={entryStyle(260)} />
          {q.answer_unit && <span>{q.answer_unit}</span>}
        </div>
      )}

      {q.question_type === 'FRACTION' && (() => {
        const f = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : { num: '', den: '' };
        const setPart = (part: 'num' | 'den', v: string) => {
          const next = { ...f, [part]: v.replace(/[^0-9\-]/g, '') };
          onChange?.(next.num === '' && next.den === '' ? null : next);
        };
        return (
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <input value={f.num} readOnly={!onChange} inputMode="numeric" onChange={e => setPart('num', e.target.value)} style={entryStyle(150)} aria-label="numerator" />
            <div style={{ width: 160, height: 2, background: '#111' }} />
            <input value={f.den} readOnly={!onChange} inputMode="numeric" onChange={e => setPart('den', e.target.value)} style={entryStyle(150)} aria-label="denominator" />
          </div>
        );
      })()}
      </div>
    </div>
  );
}

function entryStyle(width: number): React.CSSProperties {
  return { width, padding: '12px 14px', fontSize: 24, fontWeight: 600, border: `2px solid ${BLUE}`, background: '#F8FAFF', fontVariantNumeric: 'tabular-nums' };
}
