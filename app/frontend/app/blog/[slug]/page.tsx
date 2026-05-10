'use client';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { POSTS } from '@/lib/blogData';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

const TAG_COLOR: Record<string, { bg: string; color: string }> = {
  Analysis: { bg: '#eef5ff', color: '#378ADD' },
  Strategy: { bg: '#e6faf5', color: '#00a876' },
  DILR:     { bg: '#f3eeff', color: '#7B2FBE' },
  Basics:   { bg: '#fff7e6', color: '#cc6600' },
};

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, logout } = useAuth();

  const post = POSTS.find(p => p.slug === slug);

  if (!post) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#aaaaaa', marginBottom: 16 }}>Post not found</div>
          <button onClick={() => router.push('/blog')} style={{ padding: '9px 20px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
            Back to blog
          </button>
        </div>
      </div>
    );
  }

  const tag = TAG_COLOR[post.tag] ?? { bg: '#f0f0f0', color: '#555' };
  const others = POSTS.filter(p => p.slug !== slug).slice(0, 3);

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
          <span onClick={() => router.push('/blog')} style={{ fontSize: 13, color: '#555555', fontFamily: F, cursor: 'pointer' }}>Blog</span>
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

      {/* Post header */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e4e4e4' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 48px 40px', boxSizing: 'border-box', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span
              onClick={() => router.push('/blog')}
              style={{ fontSize: 12, color: '#aaaaaa', fontFamily: F, cursor: 'pointer' }}
            >
              ← Blog
            </span>
            <span style={{ width: 3, height: 3, background: '#dddddd' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: tag.color, background: tag.bg, padding: '3px 9px', textTransform: 'uppercase' }}>{post.tag}</span>
          </div>
          <h1 style={{ margin: '0 0 16px', fontSize: 30, fontWeight: 700, color: '#121212', letterSpacing: -0.7, lineHeight: 1.2, fontFamily: F }}>{post.title}</h1>
          <p style={{ margin: '0 0 24px', fontSize: 15, color: '#666666', lineHeight: 1.75, fontFamily: F }}>{post.subtitle}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#aaaaaa', fontFamily: F }}>
            <span>{post.date}</span>
            <span style={{ width: 3, height: 3, background: '#dddddd' }} />
            <span>{post.readTime}</span>
          </div>
        </div>
      </div>

      {/* Article body */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '44px 48px 64px', boxSizing: 'border-box', width: '100%' }}>
        {post.body.map((block, i) => {
          if (block.type === 'h2') {
            return (
              <h2 key={i} style={{ margin: '36px 0 14px', fontSize: 18, fontWeight: 700, color: '#121212', letterSpacing: -0.3, fontFamily: F }}>
                {block.content as string}
              </h2>
            );
          }
          if (block.type === 'ul') {
            return (
              <ul key={i} style={{ margin: '0 0 20px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(block.content as string[]).map((item, j) => (
                  <li key={j} style={{ fontSize: 14, color: '#444444', lineHeight: 1.75, fontFamily: F }}>{item}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} style={{ margin: '0 0 20px', fontSize: 15, color: '#333333', lineHeight: 1.85, fontFamily: F }}>
              {block.content as string}
            </p>
          );
        })}

        {/* CTA inside article */}
        <div style={{ marginTop: 48, background: '#121212', padding: '32px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 6, fontFamily: F }}>Practice with real CAT papers</div>
            <div style={{ fontSize: 13, color: '#555555', fontFamily: F }}>CAT 2025 — all 3 slots, free. No card required.</div>
          </div>
          <button
            onClick={() => router.push(user ? '/papers' : '/register')}
            style={{ padding: '11px 24px', background: '#00C48C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, fontFamily: F, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#00a876'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#00C48C'; }}
          >
            {user ? 'Go to papers' : 'Start free'}
          </button>
        </div>
      </div>

      {/* More posts */}
      {others.length > 0 && (
        <div style={{ borderTop: '1px solid #e4e4e4', background: '#ffffff' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 48px 56px', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#aaaaaa', marginBottom: 24 }}>More articles</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: '#e4e4e4', border: '1px solid #e4e4e4' }}>
              {others.map(p => {
                const t = TAG_COLOR[p.tag] ?? { bg: '#f0f0f0', color: '#555' };
                return (
                  <div
                    key={p.slug}
                    onClick={() => router.push(`/blog/${p.slug}`)}
                    style={{ background: '#ffffff', padding: '18px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, transition: 'background 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f9f9f9'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#ffffff'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: t.color, background: t.bg, padding: '2px 8px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{p.tag}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#121212', fontFamily: F }}>{p.title}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#aaaaaa', whiteSpace: 'nowrap', fontFamily: F }}>{p.readTime}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
