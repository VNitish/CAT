'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/auth';

interface SectionInfo {
  section: string;
  total_questions: number;
  mcq_count: number;
  tita_count: number;
  time_limit_minutes: number;
}

interface Paper {
  paper_code: string;
  title: string;
  year: number;
  slot: string;
  source_type: string;
  total_questions: number;
  duration_minutes: number;
  sections: SectionInfo[];
  generated: boolean;
  is_free: boolean;
}

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

const SLOT_COLOR: Record<string, string> = {
  'Slot 1': '#378ADD',
  'Slot 2': '#00C48C',
  'Slot 3': '#9B6DFF',
};

export default function PapersPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [loadingCode, setLoadingCode] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setDbStatus(d.connected ? 'connected' : 'error'))
      .catch(() => setDbStatus('error'));
    fetch('/api/papers')
      .then(r => r.json())
      .then(d => Array.isArray(d) && setPapers(d))
      .catch(() => setDbStatus('error'));
  }, []);

  const handleSelect = async (paper: Paper) => {
    if (!user) { router.push('/login'); return; }
    if (!paper.is_free && user.plan !== 'pro') { router.push('/pricing'); return; }
    setLoadingCode(paper.paper_code);
    try {
      const res = await apiFetch(`/api/papers/${paper.paper_code}/generate`, { method: 'POST' });
      if (res.status === 403) { router.push('/pricing'); return; }
      if (!res.ok) throw new Error();
      router.push(`/instructions/${paper.paper_code}`);
    } catch {
      router.push(`/instructions/${paper.paper_code}?demo=true`);
    } finally {
      setLoadingCode(null);
    }
  };

  const byYear = papers.reduce<Record<string, Paper[]>>((acc, p) => {
    const k = String(p.year);
    (acc[k] ??= []).push(p);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

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
          <span style={{ fontSize: 13, color: '#555555', fontFamily: F }}>Papers</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, background: dbStatus === 'connected' ? '#00C48C' : dbStatus === 'error' ? '#ef4444' : '#f59e0b' }} />
            <span style={{ fontSize: 11, color: '#444444', fontFamily: F }}>
              {dbStatus === 'connected' ? `${papers.length} papers` : dbStatus === 'error' ? 'Offline' : '…'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.push('/quant')} style={{ padding: '6px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            Quant Practice
          </button>
          <button onClick={() => router.push('/blog')} style={{ padding: '6px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            Blog
          </button>
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid #2a2a2a' }}>
                <div style={{ width: 22, height: 22, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: '#cccccc', fontWeight: 500, fontFamily: F }}>{user.name}</span>
                {user.plan === 'pro' && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#00C48C', background: 'rgba(0,196,140,0.12)', border: '1px solid rgba(0,196,140,0.25)', padding: '2px 6px', letterSpacing: 0.5, fontFamily: F }}>PRO</span>
                )}
              </div>
              {user.plan !== 'pro' && (
                <button onClick={() => router.push('/pricing')} style={{ padding: '6px 14px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                  Upgrade
                </button>
              )}
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
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 5px', fontSize: 20, fontWeight: 700, color: '#121212', letterSpacing: -0.3, fontFamily: F }}>
              CAT Past Year Papers
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#777777', fontFamily: F }}>
              {papers.length || 24} papers &nbsp;&middot;&nbsp; 2017–2025 &nbsp;&middot;&nbsp; 1,830 questions &nbsp;&middot;&nbsp; 120 min each
            </p>
          </div>
          {!user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#e6faf5', border: '1px solid #b3eedd', padding: '10px 16px' }}>
              <span style={{ fontSize: 13, color: '#007a55', fontFamily: F }}>CAT 2025 is <strong>free</strong> — no payment needed</span>
              <button onClick={() => router.push('/register')} style={{ padding: '7px 14px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Start free
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Paper list */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 40px 80px' }}>
        {years.map(year => (
          <div key={year} style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#aaaaaa', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: F }}>CAT {year}</span>
              <div style={{ flex: 1, height: 1, background: '#eeeeee' }} />
              <span style={{ fontSize: 11, color: '#cccccc', fontFamily: F }}>{byYear[year].length} slot{byYear[year].length !== 1 ? 's' : ''}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: '#e4e4e4' }}>
              {byYear[year].map(paper => {
                const isLoading = loadingCode === paper.paper_code;
                const locked = !paper.is_free && user?.plan !== 'pro';
                const needsLogin = !user;
                const slotColor = SLOT_COLOR[paper.slot] ?? '#378ADD';
                const varc = paper.sections?.find(s => s.section === 'VARC');
                const dilr = paper.sections?.find(s => s.section === 'DILR');
                const qa   = paper.sections?.find(s => s.section === 'QA');

                return (
                  <div
                    key={paper.paper_code}
                    style={{ background: '#ffffff', opacity: locked ? 0.55 : 1, transition: 'box-shadow 150ms' }}
                    onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.09)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                  >
                    {/* Slot colour bar */}
                    <div style={{ height: 3, background: locked ? '#eeeeee' : slotColor }} />

                    {/* Card content */}
                    <div style={{ padding: '16px 18px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: locked ? '#aaaaaa' : '#121212', letterSpacing: -0.2, fontFamily: F, marginBottom: 3 }}>{paper.title}</div>
                          <div style={{ fontSize: 11, color: '#aaaaaa', fontFamily: F }}>{paper.total_questions} questions &middot; {paper.duration_minutes} min</div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 8 }}>
                          {paper.is_free && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#00a876', background: '#e6faf5', border: '1px solid #b3eedd', padding: '2px 7px', letterSpacing: 0.4, fontFamily: F }}>FREE</span>
                          )}
                          {locked && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#378ADD', background: '#eef5ff', border: '1px solid #c0d9f7', padding: '2px 7px', letterSpacing: 0.4, fontFamily: F }}>PRO</span>
                          )}
                        </div>
                      </div>

                      {/* Section stats */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                        {[{ name: 'VARC', info: varc }, { name: 'DILR', info: dilr }, { name: 'QA', info: qa }].map(({ name, info }) => (
                          <div key={name} style={{ flex: 1, background: '#FAFAFA', border: '1px solid #eeeeee', padding: '7px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#aaaaaa', letterSpacing: 0.5, marginBottom: 3, fontFamily: F }}>{name}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: locked ? '#cccccc' : '#378ADD', fontFamily: F }}>
                              {info ? info.total_questions : '—'}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      {locked ? (
                        <button onClick={() => needsLogin ? router.push('/login') : router.push('/pricing')} style={{ width: '100%', padding: '9px', background: 'transparent', color: '#aaaaaa', border: '1px solid #eeeeee', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                          {needsLogin ? 'Sign in to access' : 'Unlock with Pro'}
                        </button>
                      ) : needsLogin ? (
                        <button onClick={() => router.push('/login')} style={{ width: '100%', padding: '9px', background: '#eef5ff', color: '#378ADD', border: '1px solid #c0d9f7', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                          Sign in to start
                        </button>
                      ) : (
                        <button
                          disabled={isLoading}
                          onClick={() => handleSelect(paper)}
                          style={{ width: '100%', padding: '9px', background: isLoading ? '#eeeeee' : '#00C48C', color: isLoading ? '#aaaaaa' : '#ffffff', border: 'none', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background 150ms' }}
                          onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#00a876'; }}
                          onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = '#00C48C'; }}
                        >
                          {isLoading ? 'Preparing…' : 'Start exam'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Upgrade strip */}
        {user && user.plan !== 'pro' && papers.length > 0 && (
          <div style={{ padding: '22px 28px', background: '#121212', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 5, fontFamily: F, letterSpacing: -0.2 }}>Unlock all 24 papers with Pro</div>
              <div style={{ fontSize: 12, color: '#555555', fontFamily: F }}>CAT 2017–2024 &middot; 21 more papers &middot; 1,500+ additional questions</div>
            </div>
            <button onClick={() => router.push('/pricing')} style={{ padding: '10px 22px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              View pricing
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
