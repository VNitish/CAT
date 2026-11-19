'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/auth';
import { formatClock } from '@/lib/gre';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';
const ACCENT = '#2563EB';

interface TestRow {
  test_no: number;
  title: string;
  duration_minutes: number;
  repeat_keys: string[];
  mix: { by_area: Record<string, number>; chapters: number };
  session: null | {
    _id: string; status: 'in_progress' | 'paused' | 'submitted';
    current_index: number; time_left: number;
    score?: { correct: number; total: number };
  };
}

export default function GreTestsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<TestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    apiFetch('/api/gre/tests')
      .then(async r => {
        if (r.status === 401) { router.push('/login'); return; }
        if (!r.ok) throw new Error(r.status === 403 ? 'This section is private.' : 'Could not load tests');
        setTests(await r.json());
      })
      .catch(e => setError(e.message));
  }, [authLoading, user, router]);

  const done = tests?.filter(t => t.session?.status === 'submitted') || [];
  const avg = done.length ? Math.round(done.reduce((s, t) => s + (t.session!.score!.correct / t.session!.score!.total), 0) / done.length * 100) : null;
  const next = tests?.find(t => t.session?.status !== 'submitted');

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: F, color: '#222' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#121212', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: F }}>← PaperRoom</button>
        <span style={{ color: '#aaa', fontSize: 13 }}>Quant GRE</span>
      </nav>

      <main style={{ maxWidth: 1500, margin: '0 auto', padding: '32px 32px 64px' }}>
        <h1 style={{ fontSize: 28, margin: '0 0 6px' }}>GRE Quant · 30 daily tests</h1>
        <p style={{ margin: '0 0 24px', color: '#666', fontSize: 14 }}>
          28 questions, 50 minutes, mixed like the real test. One a day.
        </p>

        {error && <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>{error}</div>}
        {!tests && !error && <div style={{ color: '#888' }}>Loading…</div>}

        {tests && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <Stat label="Tests done" value={`${done.length} / ${tests.length}`} />
              <Stat label="Average score" value={avg === null ? '—' : `${avg}%`} />
              {next && (
                <button onClick={() => router.push(`/gre/${next.test_no}`)} style={{ padding: '14px 22px', background: ACCENT, color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: F }}>
                  {next.session ? 'Resume' : 'Start'} Test {next.test_no} →
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
              {tests.map(t => {
                const s = t.session;
                const status = !s ? 'Not started'
                  : s.status === 'submitted' ? `Score ${s.score?.correct}/${s.score?.total}`
                  : `${s.status === 'paused' ? 'Paused' : 'In progress'} · Q${s.current_index + 1} · ${formatClock(s.time_left)} left`;
                const color = !s ? '#888' : s.status === 'submitted' ? '#15803D' : '#B45309';
                return (
                  <div key={t.test_no} style={{ background: '#fff', border: '1px solid #E5E5E5', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong style={{ fontSize: 16 }}>Test {t.test_no}</strong>
                      <span style={{ fontSize: 11, color: '#999' }}>{t.mix.chapters} chapters</span>
                    </div>
                    <div style={{ fontSize: 13, color, fontWeight: 600 }}>{status}</div>
                    {t.repeat_keys.length > 0 && <div style={{ fontSize: 11, color: '#999' }}>Includes {t.repeat_keys.length} repeat questions</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                      {s?.status === 'submitted' ? (
                        <>
                          <Btn primary onClick={() => router.push(`/gre/result/${s._id}`)}>Review</Btn>
                          <Btn onClick={() => router.push(`/gre/${t.test_no}`)}>Retake</Btn>
                        </>
                      ) : (
                        <Btn primary onClick={() => router.push(`/gre/${t.test_no}`)}>{s ? 'Resume' : 'Start'}</Btn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E5', padding: '10px 18px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Btn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F,
      background: primary ? ACCENT : '#fff', color: primary ? '#fff' : ACCENT, border: `1px solid ${ACCENT}`,
    }}>{children}</button>
  );
}
