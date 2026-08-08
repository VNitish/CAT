'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/auth';
import { C, F, Shell, TopBar, Frame, Arrow, btnBare } from './ui';

interface Chapter {
  slug: string;
  name: string;
  order: number;
  status: 'ready' | 'coming_soon';
  tagline: string;
  flagged_note: string;
  thumb_image: string;
  total: number;
  attempted: number;
  correct: number;
}

export default function RevisionHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');

  useEffect(() => {
    apiFetch('/api/revision/chapters')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) { setChapters(d); setStatus(d.length ? 'ok' : 'empty'); }
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [user]);

  const ready = chapters.filter(c => c.status === 'ready' && c.total > 0);
  const soon  = chapters.filter(c => !(c.status === 'ready' && c.total > 0));

  return (
    <Shell>
      <TopBar
        crumb="Choose a chapter"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ font: `500 11.5px ${F}`, color: C.dim, whiteSpace: 'nowrap' }}>
              {user ? user.email : 'Log in to save progress'}
            </span>
            <button onClick={() => router.push('/')} style={btnBare}>PaperRoom</button>
          </div>
        }
      />

      <div style={{ padding: '52px 56px 56px', flex: 1 }}>
        {/* Hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 48, alignItems: 'center', marginBottom: 52 }}>
          <div>
            <div style={{ font: `600 11px/1 ${F}`, letterSpacing: '.16em', color: C.accent, textTransform: 'uppercase', marginBottom: 16 }}>
              Quantitative Aptitude
            </div>
            <h1 style={{ margin: '0 0 18px', font: `800 42px/1.05 ${F}`, color: C.textHi, letterSpacing: '-.03em' }}>
              Revise a chapter,<br />then prove you<br />know it.
            </h1>
            <p style={{ margin: 0, font: `400 16px/1.6 ${F}`, color: C.muted, maxWidth: 440 }}>
              Every chapter opens with a complete formula overview to rebuild the full picture. When it feels
              solid, you work through the questions that most often catch people out.
            </p>
          </div>
          <div style={{ height: 300, borderRadius: 18, overflow: 'hidden', border: `1px solid ${C.line2}` }}>
            <Frame alt="" />
          </div>
        </div>

        {/* Chapters */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: `1px solid ${C.line}`, paddingBottom: 14, marginBottom: 22 }}>
          <h2 style={{ margin: 0, font: `700 15px/1 ${F}`, letterSpacing: '.02em', color: C.text }}>Chapters</h2>
          <span style={{ font: `500 13px ${F}`, color: C.dim }}>
            {status === 'ok' ? `${ready.length} of ${chapters.length} ready` : ' '}
          </span>
        </div>

        {status === 'loading' && <Notice>Loading chapters...</Notice>}
        {status === 'error'   && <Notice tone="error">Could not load chapters. Is the backend running?</Notice>}
        {status === 'empty'   && <Notice>No revision content seeded yet. Run <code>node api/seed_revision.js</code>.</Notice>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {ready.map(c => (
            <button
              key={c.slug}
              onClick={() => router.push(`/revision/${c.slug}`)}
              style={{
                textAlign: 'left', cursor: 'pointer', background: C.card, border: `1.5px solid ${C.accent}`,
                borderRadius: 18, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                fontFamily: F, transition: 'transform .14s ease, box-shadow .14s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 34px -18px rgba(62,229,139,.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ height: 128, borderBottom: `1px solid ${C.line2}` }}>
                <Frame src={c.thumb_image} alt="" />
              </div>
              <div style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <span style={{ font: `700 18px/1.2 ${F}`, color: C.text, letterSpacing: '-.01em' }}>{c.name}</span>
                  <span style={{ color: C.accent, flex: 'none' }}><Arrow /></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ padding: '5px 11px', borderRadius: 999, background: C.accent, color: C.onAccent, font: `700 11.5px ${F}` }}>
                    {c.total} question{c.total === 1 ? '' : 's'}
                  </span>
                  {c.flagged_note && <span style={{ font: `500 12.5px ${F}`, color: C.dim }}>{c.flagged_note}</span>}
                  {c.attempted > 0 && (
                    <span style={{ font: `600 12px ${F}`, color: C.cyan }}>
                      {c.correct}/{c.attempted} correct last time
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {soon.map(c => (
            <div key={c.slug} style={{
              background: C.soft, border: `1px solid ${C.line}`, borderRadius: 18, padding: '22px 24px',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 120,
            }}>
              <div style={{ font: `700 18px/1.2 ${F}`, color: C.off, letterSpacing: '-.01em', marginBottom: 12 }}>{c.name}</div>
              <span style={{ padding: '5px 11px', borderRadius: 999, background: C.panel, color: C.dim, font: `600 11.5px ${F}`, alignSelf: 'flex-start' }}>
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <div style={{ padding: '34px 0', textAlign: 'center', font: `500 13.5px ${F}`, color: tone === 'error' ? C.red : C.dim }}>
      {children}
    </div>
  );
}
