'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

const STATS = [
  { label: 'Mock tests taken', value: 18400, suffix: '+' },
  { label: 'Students registered', value: 6200, suffix: '+' },
  { label: 'Real CAT questions', value: 1830, suffix: '' },
  { label: 'Years of papers', value: 8, suffix: '' },
];

const TESTIMONIALS = [
  {
    name: 'Rohan Mehta',
    college: 'IIM Ahmedabad, PGP 2025',
    score: '99.4 percentile',
    text: 'I attempted every single paper on this platform before my CAT. The interface is identical to the real thing — no surprises on exam day. The section timer and palette work exactly as they do in the actual test.',
  },
  {
    name: 'Priya Iyer',
    college: 'IIM Bangalore, PGP 2025',
    score: '98.7 percentile',
    text: 'What sets this apart is the quality of questions. These are real past year papers, not recreations. I used it to identify my weak areas in DILR and improved my score by 12 marks in two months.',
  },
  {
    name: 'Arjun Nair',
    college: 'IIM Calcutta, PGP 2026',
    score: '99.1 percentile',
    text: 'The performance report after each mock is genuinely useful. Section-wise breakdown, accuracy by type — it gives you exactly what you need to study smarter, not harder.',
  },
  {
    name: 'Sneha Kulkarni',
    college: 'FMS Delhi, MBA 2025',
    score: '97.8 percentile',
    text: 'I was preparing on a tight budget and the free CAT 2025 papers were a lifesaver. Three full slots, complete and timed — more than enough to understand the exact exam pattern.',
  },
];

// Demo questions for the animated preview
const DEMO_Q = [
  {
    section: 'VARC',
    num: 3,
    text: 'The author\'s primary purpose in the passage is to:',
    options: ['A. Critique contemporary academic discourse', 'B. Argue for a revised historical interpretation', 'C. Describe the evolution of a literary movement', 'D. Compare two conflicting philosophical schools'],
    answer: 1,
  },
  {
    section: 'DILR',
    num: 14,
    text: 'If the total output of factory B in week 3 was 240 units, what was the percentage increase from week 2?',
    options: ['A. 15%', 'B. 20%', 'C. 25%', 'D. 30%'],
    answer: 1,
  },
  {
    section: 'QA',
    num: 22,
    text: 'A train travels from A to B at 60 km/h and returns at 40 km/h. What is the average speed for the entire journey?',
    options: ['A. 48 km/h', 'B. 50 km/h', 'C. 52 km/h', 'D. 45 km/h'],
    answer: 0,
  },
];

// Palette colours matching real CAT
const Q_STATES = ['not-visited', 'answered', 'answered', 'not-answered', 'answered', 'marked', 'answered', 'answered', 'not-visited', 'not-visited', 'answered', 'not-visited', 'answered', 'marked', 'not-visited', 'answered'];
const qColor = (s: string) => {
  if (s === 'answered') return { bg: '#228B22', color: '#fff' };
  if (s === 'not-answered') return { bg: '#cc3300', color: '#fff' };
  if (s === 'marked') return { bg: '#7B2FBE', color: '#fff' };
  return { bg: '#d0d0d0', color: '#333' };
};

const CALC_BUTTONS = [
  ['C', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

function Calculator() {
  const [display, setDisplay] = useState('0');
  const [expr, setExpr] = useState('');

  const press = (v: string) => {
    if (v === 'C') { setDisplay('0'); setExpr(''); return; }
    if (v === '=') {
      try {
        const raw = expr.replace('×','*').replace('÷','/').replace('−','-');
        const result = Function('"use strict"; return (' + raw + ')')();
        const formatted = parseFloat(result.toFixed(6)).toString();
        setDisplay(formatted);
        setExpr(formatted);
      } catch { setDisplay('Err'); setExpr(''); }
      return;
    }
    const newExpr = (expr === '0' || display === 'Err' ? '' : expr) + v;
    setExpr(newExpr);
    setDisplay(newExpr.slice(-10));
  };

  return (
    <div style={{ background: '#1a1a2e', border: '1px solid #333', width: 160, fontFamily: 'monospace' }}>
      <div style={{ background: '#0d0d1a', padding: '8px 10px', textAlign: 'right', fontSize: 16, fontWeight: 700, color: '#00ff88', letterSpacing: 1, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
        {display}
      </div>
      {CALC_BUTTONS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex' }}>
          {row.map((btn, bi) => {
            const isOp = ['÷','×','−','+','='].includes(btn);
            const isClear = btn === 'C';
            const isZero = btn === '0' && row.length === 3;
            return (
              <button key={bi} onClick={() => press(btn)} style={{
                flex: isZero ? 2 : 1,
                padding: '8px 0',
                background: isOp ? '#003399' : isClear ? '#cc3300' : '#2a2a3e',
                color: '#ffffff',
                border: '1px solid #333',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}>
                {btn}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ExamPreview() {
  const [qIdx, setQIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [showSelected, setShowSelected] = useState(false);
  const [seconds, setSeconds] = useState(2347);
  const [paletteStates, setPaletteStates] = useState([...Q_STATES]);
  const [showCalc, setShowCalc] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Auto-cycle questions with animation
  useEffect(() => {
    const cycle = setInterval(() => {
      setShowSelected(false);
      setSelectedOpt(null);
      setShowCalc(false);
      setTimeout(() => {
        setQIdx(i => {
          const next = (i + 1) % DEMO_Q.length;
          return next;
        });
        setTimeout(() => {
          setSelectedOpt(DEMO_Q[(qIdx + 1) % DEMO_Q.length].answer);
          setShowSelected(true);
          setPaletteStates(prev => {
            const next = [...prev];
            next[qIdx + 2] = 'answered';
            return next;
          });
        }, 900);
      }, 300);
    }, 4200);
    return () => clearInterval(cycle);
  }, [qIdx]);

  const q = DEMO_Q[qIdx];
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');

  // Answered / not-answered counts
  const answeredCount = paletteStates.filter(s => s === 'answered').length;
  const notVisited = paletteStates.filter(s => s === 'not-visited').length;

  return (
    <div style={{
      background: '#f0f0f0',
      border: '1px solid #c0c0c0',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 12,
      color: '#111',
      width: '100%',
      boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
      position: 'relative',
    }}>
      {/* Exam top bar */}
      <div style={{ background: '#003366', color: '#fff', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: '#cc6600', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff' }}>C</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>PaperRoom — CAT 2025 Mock</div>
            <div style={{ fontSize: 10, color: '#aac4ff' }}>Candidate: Demo Student &nbsp;|&nbsp; Section: {q.section}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#aac4ff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Answered</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#00ff88' }}>{answeredCount}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#aac4ff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Not Visited</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffcc44' }}>{notVisited}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#aac4ff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Time Left</div>
            <div style={{
              fontSize: 20, fontWeight: 700, letterSpacing: 2,
              color: seconds < 300 ? '#ff4444' : seconds < 600 ? '#ffaa00' : '#fff',
              fontFamily: 'monospace',
              transition: 'color 0.5s',
            }}>{mm}:{ss}</div>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ background: '#004080', display: 'flex', gap: 0 }}>
        {['VARC', 'DILR', 'Quantitative Aptitude'].map(s => {
          const key = s === 'Quantitative Aptitude' ? 'QA' : s;
          const active = key === q.section;
          return (
            <div key={s} style={{ padding: '7px 20px', fontSize: 11, fontWeight: 700, color: active ? '#fff' : 'rgba(255,255,255,0.4)', borderBottom: active ? '2px solid #cc6600' : '2px solid transparent', cursor: 'default', transition: 'color 0.3s', whiteSpace: 'nowrap' }}>{s}</div>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 12 }}>
          <button
            onClick={() => setShowCalc(c => !c)}
            style={{ padding: '4px 12px', background: showCalc ? '#cc6600' : 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3 }}
          >
            Calculator
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex' }}>
        {/* Question panel */}
        <div style={{ flex: 1, background: '#ffffff', minHeight: 310, position: 'relative' }}>
          {/* Question header strip */}
          <div style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd', padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#003366' }}>Question No. {q.num} of {q.section === 'VARC' ? 24 : q.section === 'DILR' ? 20 : 22}</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#888' }}>
              <span>+3 correct</span>
              <span style={{ color: '#cc3300' }}>-1 wrong</span>
              <span style={{ color: '#666' }}>0 TITA</span>
            </div>
          </div>

          <div style={{ padding: '14px 16px' }}>
            <div style={{
              fontSize: 13, lineHeight: 1.75, color: '#111', marginBottom: 16,
              opacity: showSelected || selectedOpt === null ? 1 : 0,
              transition: 'opacity 0.3s',
            }}>
              {q.text}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options.map((opt, i) => {
                const isSelected = showSelected && selectedOpt === i;
                return (
                  <div key={i} style={{
                    padding: '9px 13px',
                    background: isSelected ? '#e8f0fe' : '#fafafa',
                    border: isSelected ? '2px solid #003399' : '1px solid #e0e0e0',
                    fontSize: 12, lineHeight: 1.5, color: '#111',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    transition: 'all 0.3s',
                  }}>
                    <div style={{
                      width: 14, height: 14, border: isSelected ? '4px solid #003399' : '2px solid #aaa',
                      background: isSelected ? '#003399' : '#fff',
                      flexShrink: 0, marginTop: 1,
                      transition: 'all 0.25s',
                      borderRadius: '50%',
                    }} />
                    {opt}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating calculator */}
          {showCalc && (
            <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
              <Calculator />
            </div>
          )}
        </div>

        {/* Palette sidebar */}
        <div style={{ width: 148, background: '#e8e8e8', borderLeft: '1px solid #ccc', display: 'flex', flexDirection: 'column' }}>
          {/* Summary counts */}
          <div style={{ background: '#003366', padding: '8px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[
              { label: 'Answered', count: paletteStates.filter(s => s === 'answered').length, bg: '#228B22' },
              { label: 'Not Ans.', count: paletteStates.filter(s => s === 'not-answered').length, bg: '#cc3300' },
              { label: 'Marked', count: paletteStates.filter(s => s === 'marked').length, bg: '#7B2FBE' },
              { label: 'Not Vis.', count: paletteStates.filter(s => s === 'not-visited').length, bg: '#888' },
            ].map(item => (
              <div key={item.label} style={{ background: item.bg, padding: '4px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{item.count}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '8px 8px', flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#555', marginBottom: 6, textAlign: 'center', letterSpacing: 0.8, textTransform: 'uppercase' }}>Question Palette</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
              {paletteStates.map((state, i) => {
                const { bg, color } = qColor(state);
                return (
                  <div key={i} style={{ width: 26, height: 26, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, transition: 'background 0.4s' }}>
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ borderTop: '1px solid #ccc', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['#228B22', 'Answered'], ['#cc3300', 'Not Answered'], ['#7B2FBE', 'Marked for Review'], ['#d0d0d0', 'Not Visited']].map(([bg, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, background: bg, flexShrink: 0 }} />
                <div style={{ fontSize: 8.5, color: '#555' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Submit button in sidebar */}
          <button style={{ width: '100%', padding: '10px', background: '#cc6600', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'default', letterSpacing: 0.3 }}>
            Submit Section
          </button>
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{ background: '#f0f0f0', borderTop: '1px solid #ccc', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ padding: '5px 12px', background: '#7B2FBE', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'default' }}>Mark for Review</button>
          <button style={{ padding: '5px 12px', background: '#cc3300', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'default' }}>Clear Response</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ padding: '5px 12px', background: '#ddd', color: '#333', border: '1px solid #bbb', fontSize: 10, fontWeight: 700, cursor: 'default' }}>Previous</button>
          <button style={{ padding: '5px 16px', background: '#003399', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'default' }}>Save & Next</button>
        </div>
      </div>
    </div>
  );
}

function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const step = Math.ceil(target / 50);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setVal(current);
      if (current >= target) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [target]);
  return <>{val.toLocaleString('en-IN')}{suffix}</>;
}

export default function LandingPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: F, color: '#222222' }}>

      {/* Nav */}
      <nav style={{ background: '#121212', padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>P</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: -0.3 }}>PaperRoom</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.push('/quant')} style={{ padding: '7px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            Quant Practice
          </button>
          <button onClick={() => router.push('/varc')} style={{ padding: '7px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            VARC Mocks
          </button>
          <button onClick={() => router.push('/rc')} style={{ padding: '7px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            RC Tests
          </button>
          <button onClick={() => router.push('/asrc')} style={{ padding: '7px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            Arun Sharma VARC
          </button>
          <button onClick={() => router.push('/di')} style={{ padding: '7px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            DI Mocks
          </button>
          <button onClick={() => router.push('/blog')} style={{ padding: '7px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            Blog
          </button>
          {user ? (
            <>
              <span style={{ fontSize: 13, color: '#555555' }}>Hi, {user.name.split(' ')[0]}</span>
              <button onClick={() => router.push('/papers')} style={{ padding: '7px 18px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                My papers
              </button>
              <button onClick={logout} style={{ padding: '7px 14px', background: 'transparent', color: '#555555', border: '1px solid #2a2a2a', fontSize: 12, fontFamily: F, cursor: 'pointer' }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button onClick={() => router.push('/login')} style={{ padding: '7px 16px', background: 'transparent', color: '#888888', border: '1px solid #2a2a2a', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
                Sign in
              </button>
              <button onClick={() => router.push('/register')} style={{ padding: '7px 16px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                Start free
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero — split layout */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e4e4e4' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 48px 72px', display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>
          {/* Left: copy */}
          <div style={{ flex: '0 0 340px', minWidth: 300 }}>
            <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#00a876', background: '#e6faf5', border: '1px solid #b3eedd', padding: '4px 14px', marginBottom: 28 }}>
              CAT 2025 — All 3 slots free
            </div>
            <h1 style={{ margin: '0 0 22px', fontSize: 48, fontWeight: 700, color: '#121212', letterSpacing: -1.8, lineHeight: 1.08 }}>
              Every real CAT paper.<br />One clean platform.
            </h1>
            <p style={{ margin: '0 0 36px', fontSize: 16, color: '#666666', lineHeight: 1.8, fontWeight: 400, maxWidth: 420 }}>
              Practice with 24 authentic past year papers from 2017 to 2025. Section-timed, scored, and structured exactly like the actual exam.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push(user ? '/papers' : '/register')}
                style={{ padding: '13px 32px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, fontFamily: F, cursor: 'pointer', transition: 'background 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#00a876'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#00C48C'; }}
              >
                {user ? 'Go to papers' : 'Start for free'}
              </button>
              <button
                onClick={() => router.push('/papers')}
                style={{ padding: '13px 32px', background: 'transparent', color: '#378ADD', border: '1.5px solid #378ADD', fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer', transition: 'background 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Browse papers
              </button>
            </div>
          </div>

          {/* Right: animated exam preview */}
          <div style={{ flex: '1 1 560px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', minWidth: 0 }}>
            <ExamPreview />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#121212' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ textAlign: 'center', padding: '36px 24px', borderRight: i < STATS.length - 1 ? '1px solid #1e1e1e' : 'none' }}>
              <div style={{ fontSize: 38, fontWeight: 700, color: '#00C48C', letterSpacing: -1.5, lineHeight: 1 }}>
                <AnimatedNumber target={s.value} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 11, color: '#444444', marginTop: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Practice areas — Quant, VARC & RC */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 48px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#aaaaaa', marginBottom: 8, textAlign: 'center' }}>Practice by section</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#121212', letterSpacing: -0.6, textAlign: 'center', marginBottom: 40 }}>Four focused ways to prepare</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1, background: '#e4e4e4', border: '1px solid #e4e4e4' }}>
          {[
            {
              accent: '#378ADD',
              eyebrow: 'Quantitative Aptitude',
              title: 'Quant Practice',
              desc: 'Drill chapter by chapter across the full QA syllabus — arithmetic, algebra, geometry and more, organised into six blocks.',
              points: ['Topic-wise question banks', 'Easy / medium / hard breakdown', 'Step-by-step worked solutions'],
              cta: 'Start Quant practice',
              href: '/quant',
            },
            {
              accent: '#9B6DFF',
              eyebrow: 'Verbal Ability & RC',
              title: 'VARC Mocks',
              desc: 'Three full section tests modelled on the real exam — passage-based RC, parajumbles, sentence correction and para completion.',
              points: ['3 section tests · 34 questions each', 'Timed, scored, exam-style palette', 'Answer key with explanations'],
              cta: 'Start VARC mocks',
              href: '/varc',
            },
            {
              accent: '#EC4899',
              eyebrow: 'Reading Comprehension',
              title: 'RC Tests',
              desc: 'Ten passage-based tests built from 40 reading passages — grouped four passages per test in the exam-day interface.',
              points: ['10 tests · 4 passages each', 'Timed, scored, exam-style palette', 'Answers & explanations on review'],
              cta: 'Start RC tests',
              href: '/rc',
            },
            {
              accent: '#F59E0B',
              eyebrow: 'Data Interpretation',
              title: 'DI Mocks',
              desc: 'Chart, table and caselet sets across three difficulty tiers — pie, bar and line graphs rendered exactly as in the exam.',
              points: ['Foundation · Moderate · Advanced', 'Timed, scored, exam-style palette', 'Diagrams, answers & explanations'],
              cta: 'Start DI mocks',
              href: '/di',
            },
          ].map(c => (
            <div key={c.title} style={{ background: '#ffffff', padding: '36px 34px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: c.accent, marginBottom: 12 }}>{c.eyebrow}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#121212', marginBottom: 12, letterSpacing: -0.4 }}>{c.title}</div>
              <div style={{ fontSize: 13.5, color: '#777777', lineHeight: 1.75, marginBottom: 20 }}>{c.desc}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28 }}>
                {c.points.map(p => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#444444' }}>
                    <div style={{ width: 5, height: 5, background: c.accent, flexShrink: 0 }} />
                    {p}
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push(c.href)}
                style={{ marginTop: 'auto', alignSelf: 'flex-start', padding: '11px 24px', background: c.accent, color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 700, fontFamily: F, cursor: 'pointer', transition: 'opacity 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {c.cta} &rarr;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 48px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#aaaaaa', marginBottom: 32, textAlign: 'center' }}>Why PaperRoom</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: '#e4e4e4', border: '1px solid #e4e4e4' }}>
          {[
            { label: '01', title: 'Authentic exam interface', desc: 'Timed sections, question palette, section lock — identical to what you will face in the actual CAT. No guesswork on exam day.' },
            { label: '02', title: 'Real papers, not recreations', desc: '1,830 questions from actual CAT papers. Verified answers. No paraphrasing, no substitutions — the exact questions candidates faced.' },
            { label: '03', title: 'Instant section-wise analysis', desc: 'Score, accuracy, correct vs incorrect by section — available the moment you submit. Pinpoint your weak areas in minutes.' },
            { label: '04', title: 'Progress tracked over time', desc: 'Every attempt is saved to your account. Compare performance across papers, track your trajectory, and prepare with data.' },
          ].map(f => (
            <div key={f.label} style={{ background: '#ffffff', padding: '32px 30px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#cccccc', letterSpacing: 1.5, marginBottom: 12 }}>{f.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#121212', marginBottom: 10, letterSpacing: -0.2 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#777777', lineHeight: 1.75 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '72px 48px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#aaaaaa', marginBottom: 8, textAlign: 'center' }}>Student results</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#121212', letterSpacing: -0.6, textAlign: 'center', marginBottom: 40 }}>Used by students at India's top B-schools</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: '#e4e4e4', border: '1px solid #e4e4e4' }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: '#ffffff', padding: '28px 28px 24px' }}>
              <div style={{ fontSize: 13, color: '#333333', lineHeight: 1.85, marginBottom: 20, fontStyle: 'italic' }}>
                &ldquo;{t.text}&rdquo;
              </div>
              <div style={{ borderTop: '1px solid #eeeeee', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#121212', marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: '#aaaaaa' }}>{t.college}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00a876', background: '#e6faf5', border: '1px solid #b3eedd', padding: '4px 10px', whiteSpace: 'nowrap' }}>
                  {t.score}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA band */}
      <div style={{ maxWidth: 860, margin: '56px auto 0', padding: '0 48px 88px' }}>
        <div style={{ background: '#121212', padding: '48px 52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', marginBottom: 8, letterSpacing: -0.5 }}>
              Begin with CAT 2025. Free.
            </div>
            <div style={{ fontSize: 14, color: '#555555', lineHeight: 1.65 }}>
              All 3 slots. No card required. Takes under a minute to sign up.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/register')}
              style={{ padding: '13px 28px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, fontFamily: F, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#00a876'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#00C48C'; }}
            >
              Create free account
            </button>
            <button
              onClick={() => router.push('/papers')}
              style={{ padding: '13px 28px', background: 'transparent', color: '#555555', border: '1px solid #2a2a2a', fontSize: 14, fontFamily: F, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Browse papers
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e4e4e4', padding: '22px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>P</div>
          <span style={{ fontSize: 12, color: '#aaaaaa' }}>PaperRoom &copy; 2026</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="/papers" style={{ fontSize: 12, color: '#aaaaaa', textDecoration: 'none' }}>Papers</a>
          <a href="/pricing" style={{ fontSize: 12, color: '#aaaaaa', textDecoration: 'none' }}>Pricing</a>
          <a href="/blog" style={{ fontSize: 12, color: '#aaaaaa', textDecoration: 'none' }}>Blog</a>
        </div>
      </div>
    </div>
  );
}
