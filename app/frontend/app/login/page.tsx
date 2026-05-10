'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', fontFamily: F }}>

      {/* Left panel */}
      <div style={{ width: 420, background: '#121212', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 52px', flexShrink: 0 }}>
        <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <div style={{ width: 28, height: 28, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>P</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: -0.3, fontFamily: F }}>PaperRoom</span>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#333333', marginBottom: 20, fontFamily: F }}>The CAT Archive</div>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.35, color: '#ffffff', marginBottom: 20, letterSpacing: -0.5, fontFamily: F }}>
            24 real papers.<br />1,830 real questions.<br />One place.
          </div>
          <div style={{ fontSize: 13, color: '#444444', lineHeight: 1.8, fontFamily: F }}>
            Practice with authentic CAT papers from 2017 to 2025, structured exactly like the actual exam.
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#2a2a2a', fontFamily: F }}>© 2026 PaperRoom</div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 700, color: '#121212', letterSpacing: -0.4, fontFamily: F }}>Sign in</h1>
          <p style={{ margin: '0 0 32px', fontSize: 14, color: '#777777', fontFamily: F }}>
            No account?{' '}
            <a href="/register" style={{ color: '#378ADD', fontWeight: 600, textDecoration: 'none' }}>Register free</a>
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#444444', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 7, fontFamily: F }}>
                Email address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus
                style={{ width: '100%', padding: '11px 14px', background: '#ffffff', border: '1.5px solid #e4e4e4', color: '#222222', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: F, transition: 'border-color 150ms' }}
                onFocus={e => { e.target.style.borderColor = '#378ADD'; }}
                onBlur={e => { e.target.style.borderColor = '#e4e4e4'; }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#444444', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 7, fontFamily: F }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ width: '100%', padding: '11px 14px', background: '#ffffff', border: '1.5px solid #e4e4e4', color: '#222222', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: F, transition: 'border-color 150ms' }}
                onFocus={e => { e.target.style.borderColor = '#378ADD'; }}
                onBlur={e => { e.target.style.borderColor = '#e4e4e4'; }}
              />
            </div>

            {error && (
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', padding: '10px 14px', fontSize: 13, color: '#c0392b', fontFamily: F }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{ marginTop: 4, width: '100%', padding: '12px', background: loading ? '#cccccc' : '#00C48C', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: 14, fontFamily: F, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 0.1, transition: 'background 150ms' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#00a876'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#00C48C'; }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
