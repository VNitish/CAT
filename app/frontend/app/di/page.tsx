'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

// Difficulty tiers, in order, with an accent colour + blurb.
const TIERS: { key: string; color: string; blurb: string }[] = [
  { key: 'Foundation', color: '#00C48C', blurb: 'Single charts & tables — build speed and accuracy on the basics.' },
  { key: 'Moderate',   color: '#378ADD', blurb: 'Multi-set caselets and connected data — exam-level difficulty.' },
  { key: 'Advanced',   color: '#9B6DFF', blurb: 'Dense, multi-step sets — the hardest DI you will face.' },
];

interface DiTest {
  test: number;
  tier: string;
  questions: number;
  duration_minutes: number;
  marks: number;
}

export default function DiPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [tests, setTests] = useState<DiTest[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'empty' | 'error'>('checking');

  useEffect(() => {
    fetch('/api/di-tests')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setTests(d);
          setDbStatus(d.some(t => t.questions > 0) ? 'connected' : 'empty');
        } else {
          setDbStatus('error');
        }
      })
      .catch(() => setDbStatus('error'));
  }, []);

  const byTier = (tier: string) =>
    tests.filter(t => t.tier === tier).sort((a, b) => a.test - b.test);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20, border: '2px solid #378ADD', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: F, color: '#222222' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#121212', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>P</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: -0.3, fontFamily: F }}>PaperRoom</span>
          </div>
          <div style={{ width: 1, height: 16, background: '#2a2a2a' }} />
          <span style={{ fontSize: 13, color: '#555555', fontFamily: F }}>Data Interpretation</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, background: dbStatus === 'connected' ? '#00C48C' : dbStatus === 'error' ? '#ef4444' : '#f59e0b' }} />
            <span style={{ fontSize: 11, color: '#444444', fontFamily: F }}>
              {dbStatus === 'connected' ? `${tests.length} sets` : dbStatus === 'error' ? 'Offline' : dbStatus === 'empty' ? 'Not seeded' : '…'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.push('/quant')} style={{ padding: '6px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            Quant Practice
          </button>
          <button onClick={() => router.push('/varc')} style={{ padding: '6px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            VARC Mocks
          </button>
          <button onClick={() => router.push('/rc')} style={{ padding: '6px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            RC Tests
          </button>
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid #2a2a2a' }}>
                <div style={{ width: 22, height: 22, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: '#cccccc', fontWeight: 500, fontFamily: F }}>{user.name}</span>
              </div>
              <button onClick={logout} style={{ padding: '6px 13px', background: 'transparent', color: '#555555', border: '1px solid #2a2a2a', fontSize: 12, fontFamily: F, cursor: 'pointer' }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button onClick={() => router.push('/login')} style={{ padding: '6px 14px', background: 'transparent', color: '#888888', border: '1px solid #2a2a2a', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
                Sign in
              </button>
              <button onClick={() => router.push('/register')} style={{ padding: '6px 14px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                Register free
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Page header */}
      <div style={{ borderBottom: '1px solid #e4e4e4', background: '#ffffff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 40px' }}>
          <h1 style={{ margin: '0 0 5px', fontSize: 20, fontWeight: 700, color: '#121212', letterSpacing: -0.3, fontFamily: F }}>
            Data Interpretation
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#777777', fontFamily: F }}>
            Three tiers &nbsp;&middot;&nbsp; Foundation / Moderate / Advanced &nbsp;&middot;&nbsp; +3 / &minus;1 &nbsp;&middot;&nbsp; charts, tables &amp; caselets &nbsp;&middot;&nbsp; Nishit Sinha LRDI
          </p>
        </div>
      </div>

      {/* Tier sections */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 40px 80px' }}>

        {dbStatus === 'empty' && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Question bank not seeded yet.</div>
            <div style={{ fontSize: 12, color: '#ccc' }}>Run <code>node api/seed_di.js</code> to populate.</div>
          </div>
        )}

        {dbStatus === 'error' && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
            <div style={{ fontSize: 14 }}>Could not connect to the backend.</div>
          </div>
        )}

        {TIERS.map(tier => {
          const tierTests = byTier(tier.key);
          if (dbStatus === 'connected' && tierTests.length === 0) {
            return (
              <div key={tier.key} style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tier.color, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: F }}>{tier.key}</span>
                  <div style={{ flex: 1, height: 1, background: '#eeeeee' }} />
                  <span style={{ fontSize: 11, color: '#cccccc', fontFamily: F }}>coming soon</span>
                </div>
              </div>
            );
          }
          if (tierTests.length === 0) return null;
          return (
            <div key={tier.key} style={{ marginBottom: 44 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: tier.color, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: F }}>{tier.key}</span>
                <div style={{ flex: 1, height: 1, background: '#eeeeee' }} />
                <span style={{ fontSize: 11, color: '#cccccc', fontFamily: F }}>{tierTests.length} set{tierTests.length !== 1 ? 's' : ''}</span>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999', fontFamily: F }}>{tier.blurb}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: '#e4e4e4' }}>
                {tierTests.map((t, idx) => (
                  <div
                    key={t.test}
                    style={{ background: '#ffffff', transition: 'box-shadow 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.09)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                  >
                    <div style={{ height: 3, background: tier.color }} />
                    <div style={{ padding: '16px 18px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#aaaaaa', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4, fontFamily: F }}>{tier.key} Set</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#121212', letterSpacing: -0.2, fontFamily: F }}>Exercise {idx + 1}</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#777', background: '#f5f5f5', border: '1px solid #eeeeee', padding: '3px 8px', fontFamily: F, flexShrink: 0 }}>{t.questions}Q</span>
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                        {[
                          { label: 'DURATION', val: `${t.duration_minutes}m` },
                          { label: 'QUESTIONS', val: `${t.questions}` },
                          { label: 'MAX MARKS', val: `${t.marks}` },
                        ].map(({ label, val }) => (
                          <div key={label} style={{ flex: 1, background: '#FAFAFA', border: '1px solid #eeeeee', padding: '7px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#aaaaaa', letterSpacing: 0.5, marginBottom: 3, fontFamily: F }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: tier.color, fontFamily: F }}>{val}</div>
                          </div>
                        ))}
                      </div>

                      {user ? (
                        <button
                          onClick={() => router.push(`/di/${t.test}/instructions`)}
                          style={{ width: '100%', padding: '9px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer', transition: 'background 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#00a876'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#00C48C'; }}
                        >
                          Start Set
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push('/login')}
                          style={{ width: '100%', padding: '9px', background: '#eef5ff', color: '#378ADD', border: '1px solid #c0d9f7', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
                        >
                          Sign in to start
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
