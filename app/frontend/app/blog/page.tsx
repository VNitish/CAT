'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { POSTS } from '@/lib/blogData';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

const TAG_COLOR: Record<string, { bg: string; color: string }> = {
  Analysis: { bg: '#eef5ff', color: '#378ADD' },
  Strategy: { bg: '#e6faf5', color: '#00a876' },
  DILR:     { bg: '#f3eeff', color: '#7B2FBE' },
  Basics:   { bg: '#fff7e6', color: '#cc6600' },
};

export default function BlogPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [featured, ...rest] = POSTS;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: F, color: '#222222' }}>

      {/* Nav */}
      <nav style={{ background: '#121212', padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>P</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: -0.3, fontFamily: F }}>PaperRoom</span>
          </div>
          <div style={{ width: 1, height: 16, background: '#2a2a2a' }} />
          <span style={{ fontSize: 13, color: '#555555', fontFamily: F }}>Blog</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <>
              <button onClick={() => router.push('/papers')} style={{ padding: '6px 16px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                My papers
              </button>
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
                Start free
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Page header */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e4e4e4', padding: '40px 48px 36px', maxWidth: 900, margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#aaaaaa', marginBottom: 12 }}>From PaperRoom</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 700, color: '#121212', letterSpacing: -0.8, fontFamily: F }}>CAT Prep Blog</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#777777', fontFamily: F }}>Strategy, analysis, and everything you need to crack CAT.</p>
      </div>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 48px 80px', boxSizing: 'border-box', width: '100%' }}>

        {/* Featured post */}
        <div
          onClick={() => router.push(`/blog/${featured.slug}`)}
          style={{ background: '#121212', padding: '40px 44px', marginBottom: 1, cursor: 'pointer', transition: 'opacity 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.92'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#00C48C', background: 'rgba(0,196,140,0.12)', border: '1px solid rgba(0,196,140,0.25)', padding: '3px 10px', textTransform: 'uppercase' }}>Featured</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#378ADD', background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(55,138,221,0.25)', padding: '3px 10px', textTransform: 'uppercase' }}>{featured.tag}</span>
          </div>
          <h2 style={{ margin: '0 0 14px', fontSize: 24, fontWeight: 700, color: '#ffffff', letterSpacing: -0.5, lineHeight: 1.25, fontFamily: F }}>{featured.title}</h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: '#666666', lineHeight: 1.75, maxWidth: 580, fontFamily: F }}>{featured.subtitle}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: '#444444', fontFamily: F }}>{featured.date}</span>
            <span style={{ width: 3, height: 3, background: '#333333' }} />
            <span style={{ fontSize: 11, color: '#444444', fontFamily: F }}>{featured.readTime}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#00C48C', fontFamily: F }}>Read article →</span>
          </div>
        </div>

        {/* Rest of posts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1, background: '#e4e4e4', border: '1px solid #e4e4e4', marginTop: 1 }}>
          {rest.map(post => {
            const tag = TAG_COLOR[post.tag] ?? { bg: '#f0f0f0', color: '#555' };
            return (
              <div
                key={post.slug}
                onClick={() => router.push(`/blog/${post.slug}`)}
                style={{ background: '#ffffff', padding: '28px 28px 24px', cursor: 'pointer', transition: 'box-shadow 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: tag.color, background: tag.bg, padding: '3px 9px', textTransform: 'uppercase' }}>{post.tag}</span>
                  <span style={{ fontSize: 11, color: '#cccccc', fontFamily: F }}>{post.readTime}</span>
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#121212', letterSpacing: -0.2, lineHeight: 1.35, fontFamily: F }}>{post.title}</h3>
                <p style={{ margin: '0 0 20px', fontSize: 12, color: '#777777', lineHeight: 1.7, fontFamily: F }}>{post.subtitle}</p>
                <div style={{ fontSize: 11, color: '#aaaaaa', fontFamily: F }}>{post.date}</div>
              </div>
            );
          })}
        </div>
      </main>

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
