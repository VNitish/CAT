'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

const BLOCK_COLOR: Record<string, string> = {
  'Block I':   '#378ADD',
  'Block II':  '#00C48C',
  'Block III': '#9B6DFF',
  'Block IV':  '#F59E0B',
  'Block V':   '#EF4444',
  'Block VI':  '#EC4899',
};

interface Chapter {
  chapter_id: number;
  topic: string;
  block: string;
  counts: { total: number; easy: number; medium: number; hard: number };
}

export default function QuantPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'empty' | 'error'>('checking');

  useEffect(() => {
    fetch('/api/quant-chapters')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setChapters(d);
          setDbStatus(d.length > 0 ? 'connected' : 'empty');
        } else {
          setDbStatus('error');
        }
      })
      .catch(() => setDbStatus('error'));
  }, []);

  const byBlock = chapters.reduce<Record<string, Chapter[]>>((acc, c) => {
    (acc[c.block] ??= []).push(c);
    return acc;
  }, {});
  const blocks = Object.keys(byBlock).sort();

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
          <span style={{ fontSize: 13, color: '#555555', fontFamily: F }}>Quant Practice</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, background: dbStatus === 'connected' ? '#00C48C' : dbStatus === 'error' ? '#ef4444' : dbStatus === 'empty' ? '#f59e0b' : '#f59e0b' }} />
            <span style={{ fontSize: 11, color: '#444444', fontFamily: F }}>
              {dbStatus === 'connected' ? `${chapters.length} chapters` : dbStatus === 'error' ? 'Offline' : dbStatus === 'empty' ? 'Not seeded' : '…'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.push('/varc')} style={{ padding: '6px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            VARC Mocks
          </button>
          <button onClick={() => router.push('/papers')} style={{ padding: '6px 14px', background: 'transparent', color: '#666666', border: 'none', fontSize: 13, fontFamily: F, cursor: 'pointer' }}>
            Papers
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
            Quant Practice
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#777777', fontFamily: F }}>
            19 chapters &nbsp;&middot;&nbsp; 30 questions each &nbsp;&middot;&nbsp; LOD I & II &nbsp;&middot;&nbsp; Unlimited time &nbsp;&middot;&nbsp; Arun Sharma QA 8e
          </p>
        </div>
      </div>

      {/* Chapter grid */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 40px 80px' }}>

        {dbStatus === 'empty' && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Question bank not seeded yet.</div>
            <div style={{ fontSize: 12, color: '#ccc' }}>Run the seed endpoint or <code>node seed_quant.js</code> to populate.</div>
          </div>
        )}

        {dbStatus === 'error' && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
            <div style={{ fontSize: 14 }}>Could not connect to the backend.</div>
          </div>
        )}

        {blocks.map(block => (
          <div key={block} style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#aaaaaa', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: F }}>{block}</span>
              <div style={{ flex: 1, height: 1, background: '#eeeeee' }} />
              <span style={{ fontSize: 11, color: '#cccccc', fontFamily: F }}>{byBlock[block].length} chapter{byBlock[block].length !== 1 ? 's' : ''}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: '#e4e4e4' }}>
              {byBlock[block].map(ch => {
                const blockColor = BLOCK_COLOR[ch.block] ?? '#378ADD';
                return (
                  <div
                    key={ch.chapter_id}
                    style={{ background: '#ffffff', transition: 'box-shadow 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.09)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                  >
                    <div style={{ height: 3, background: blockColor }} />
                    <div style={{ padding: '16px 18px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#aaaaaa', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4, fontFamily: F }}>Ch {ch.chapter_id}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#121212', letterSpacing: -0.2, fontFamily: F }}>{ch.topic}</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#777', background: '#f5f5f5', border: '1px solid #eeeeee', padding: '3px 8px', fontFamily: F, flexShrink: 0 }}>{ch.counts.total}Q</span>
                      </div>

                      {/* LOD breakdown */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                        {[
                          { label: 'LOD I',   val: ch.counts.easy,   color: '#00C48C' },
                          { label: 'LOD II',  val: ch.counts.medium, color: '#378ADD' },
                          { label: 'LOD III', val: ch.counts.hard,   color: '#9B6DFF' },
                        ].map(({ label, val, color }) => (
                          <div key={label} style={{ flex: 1, background: '#FAFAFA', border: '1px solid #eeeeee', padding: '7px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#aaaaaa', letterSpacing: 0.5, marginBottom: 3, fontFamily: F }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: val > 0 ? color : '#dddddd', fontFamily: F }}>{val > 0 ? val : '—'}</div>
                          </div>
                        ))}
                      </div>

                      {user ? (
                        <button
                          onClick={() => router.push(`/quant/${ch.chapter_id}`)}
                          style={{ width: '100%', padding: '9px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer', transition: 'background 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#00a876'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#00C48C'; }}
                        >
                          Practice
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push('/login')}
                          style={{ width: '100%', padding: '9px', background: '#eef5ff', color: '#378ADD', border: '1px solid #c0d9f7', fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
                        >
                          Sign in to practice
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
