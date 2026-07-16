'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/auth';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

interface Topic {
  slug: string;
  name: string;
  order: number;
  accent: string;
  tagline: string;
  concept_title: string;
  total: number;
  attempted: number;
  correct: number;
}

export default function LrLandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');

  useEffect(() => {
    apiFetch('/api/lr/topics')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) { setTopics(d); setStatus(d.length ? 'ok' : 'empty'); }
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [user]);

  const totalQ = topics.reduce((s, t) => s + t.total, 0);
  const totalDone = topics.reduce((s, t) => s + t.attempted, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: F, color: '#222' }}>
      {/* Header */}
      <div style={{ background: '#121212', color: '#fff', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div onClick={() => router.push('/')} style={{ width: 30, height: 30, borderRadius: 7, background: '#7B2FBE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, cursor: 'pointer' }}>C</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Logical Reasoning</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>Learn by doing, one card at a time</div>
        </div>
        <div style={{ fontSize: 12, color: '#bbb' }}>{user ? user.email : <span onClick={() => router.push('/login')} style={{ cursor: 'pointer', color: '#9B6DFF' }}>Log in to save progress</span>}</div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px' }}>
        {/* Intro */}
        <div style={{ marginBottom: 26 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Pick a concept to practise</h1>
          <p style={{ fontSize: 14.5, color: '#666', margin: 0, maxWidth: 620, lineHeight: 1.55 }}>
            Each topic opens as a deck of cards. First the concept is explained, then you attempt a question, then the full solution is revealed so you can analyse your thinking. No timer, no pressure.
          </p>
          {totalQ > 0 && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: '#777' }}>
              {totalDone} of {totalQ} cards attempted{user ? '' : ' (log in to track your progress)'}
            </div>
          )}
        </div>

        {status === 'loading' && <div style={{ color: '#888', padding: 40, textAlign: 'center' }}>Loading topics...</div>}
        {status === 'error' && <div style={{ color: '#cc3300', padding: 40, textAlign: 'center' }}>Could not load topics. Is the backend running?</div>}
        {status === 'empty' && <div style={{ color: '#888', padding: 40, textAlign: 'center' }}>No Logical Reasoning content seeded yet.</div>}

        {/* Topic grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {topics.map(t => {
            const pct = t.total ? Math.round((t.attempted / t.total) * 100) : 0;
            return (
              <div key={t.slug}
                onClick={() => router.push(`/lr/${t.slug}`)}
                style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #e4e4e4',
                  borderTop: `3px solid ${t.accent}`, padding: '18px 20px 16px', cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)', transition: 'transform .12s, box-shadow .12s',
                  display: 'flex', flexDirection: 'column', minHeight: 168,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: '.04em', textTransform: 'uppercase' }}>Topic {t.order}</span>
                  <span style={{ fontSize: 11.5, color: '#999' }}>{t.total} cards</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '8px 0 5px', letterSpacing: '-0.3px' }}>{t.name}</h3>
                <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5, flex: 1 }}>{t.tagline}</p>
                {/* progress */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ height: 6, background: '#eef0f2', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: t.accent, borderRadius: 99, transition: 'width .3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: '#888' }}>
                    <span>{t.attempted} / {t.total} attempted</span>
                    {t.attempted > 0 && <span style={{ color: '#228B22', fontWeight: 600 }}>{t.correct} correct</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
