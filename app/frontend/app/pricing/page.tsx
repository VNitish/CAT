'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

const FREE_FEATURES = [
  'CAT 2025 — All 3 slots',
  'Full timed exam (120 min, section lock)',
  'Instant scoring and section-wise analysis',
  'On-screen calculator',
  'Question palette and review mode',
];

const PRO_FEATURES = [
  'Everything in Free',
  'All 24 papers — CAT 2017 to 2025',
  'Every slot, 1,830+ real questions',
  'Attempt history and performance tracking',
  'Priority support',
];

const FAQS = [
  { q: 'Which papers are free?', a: "CAT 2025 — all three slots. It is the most recent paper and the best starting point." },
  { q: 'What does Pro unlock?', a: 'All 24 past year papers from 2017 to 2025. Every slot, 1,830+ real questions.' },
  { q: 'Do I need to register for free papers?', a: 'Yes — so we can save your attempts and scores across sessions.' },
  { q: 'When will payment go live?', a: "We are integrating Razorpay. Email support@catmock.in for early access." },
];

function Check({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M2.5 7L5.5 10L11.5 4" stroke={color} strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: F, color: '#222222' }}>

      {/* Nav */}
      <nav style={{ background: '#121212', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54 }}>
        <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <div style={{ width: 28, height: 28, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>P</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: -0.3, fontFamily: F }}>PaperRoom</span>
        </div>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'transparent', color: '#666666', border: '1px solid #2a2a2a', padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontFamily: F }}
        >
          Back
        </button>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '64px 24px 52px', borderBottom: '1px solid #e4e4e4', background: '#ffffff' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 700, color: '#121212', letterSpacing: -0.8, lineHeight: 1.15, fontFamily: F }}>
          Simple pricing
        </h1>
        <p style={{ margin: '0 auto', maxWidth: 420, fontSize: 15, color: '#777777', lineHeight: 1.7, fontFamily: F }}>
          Start free with the full CAT 2025 paper. Upgrade to unlock every paper ever set.
        </p>
      </div>

      {/* Plans */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 72px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 1, background: '#e4e4e4', border: '1px solid #e4e4e4', alignItems: 'start' }}>

        {/* Free */}
        <div style={{ background: '#ffffff', padding: '36px 32px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#aaaaaa', textTransform: 'uppercase', marginBottom: 20, fontFamily: F }}>Free</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 42, fontWeight: 700, color: '#121212', letterSpacing: -1.5, fontFamily: F }}>₹0</span>
          </div>
          <div style={{ fontSize: 13, color: '#aaaaaa', marginBottom: 32, fontFamily: F }}>No card required, ever.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
            {FREE_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Check color="#378ADD" />
                <span style={{ fontSize: 13, color: '#555555', lineHeight: 1.55, fontFamily: F }}>{f}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => user ? router.push('/papers') : router.push('/register')}
            style={{ width: '100%', padding: '12px', background: 'transparent', color: '#378ADD', border: '1.5px solid #378ADD', fontWeight: 700, fontSize: 13, fontFamily: F, cursor: 'pointer', letterSpacing: 0.1, transition: 'background 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {user ? 'You are on Free' : 'Get started free'}
          </button>
        </div>

        {/* Pro */}
        <div style={{ background: '#121212', padding: '36px 32px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#00C48C' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#444444', textTransform: 'uppercase', fontFamily: F }}>Pro</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#00C48C', background: 'rgba(0,196,140,0.1)', border: '1px solid rgba(0,196,140,0.25)', padding: '3px 10px', textTransform: 'uppercase', fontFamily: F }}>
              Best value
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 42, fontWeight: 700, color: '#ffffff', letterSpacing: -1.5, fontFamily: F }}>₹499</span>
            <span style={{ fontSize: 13, color: '#444444', fontFamily: F }}>/year</span>
          </div>
          <div style={{ fontSize: 13, color: '#444444', marginBottom: 32, fontFamily: F }}>₹42 per month. Cancel anytime.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
            {PRO_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Check color="#00C48C" />
                <span style={{ fontSize: 13, color: '#888888', lineHeight: 1.55, fontFamily: F }}>{f}</span>
              </div>
            ))}
          </div>

          {user?.plan === 'pro' ? (
            <button disabled style={{ width: '100%', padding: '12px', background: 'rgba(0,196,140,0.1)', color: '#00C48C', border: 'none', fontWeight: 700, fontSize: 13, fontFamily: F, cursor: 'default' }}>
              You are on Pro
            </button>
          ) : (
            <button
              onClick={() => alert('Payment integration coming soon. Contact us at support@catmock.in')}
              style={{ width: '100%', padding: '12px', background: '#00C48C', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: 13, fontFamily: F, cursor: 'pointer', letterSpacing: 0.1, transition: 'background 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#00a876'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#00C48C'; }}
            >
              Claim offer
            </button>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px 96px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#cccccc', textAlign: 'center', marginBottom: 32, fontFamily: F }}>Frequently asked</div>
        {FAQS.map(({ q, a }, i) => (
          <div key={q} style={{ borderTop: i === 0 ? '1px solid #e4e4e4' : 'none', borderBottom: '1px solid #e4e4e4', padding: '20px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#222222', marginBottom: 8, fontFamily: F, letterSpacing: -0.1 }}>{q}</div>
            <div style={{ fontSize: 13, color: '#777777', lineHeight: 1.75, fontFamily: F }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
