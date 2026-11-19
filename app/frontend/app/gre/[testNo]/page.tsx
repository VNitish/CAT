'use client';
// GRE Quant test screen: 28 questions, 50-minute clock, auto-submit at zero.
//
// Saving model (fixes the old "answers kept being accepted after the login
// expired, then were lost" bug on the CAT tests):
//   1. Every change is written to a localStorage backup first, then sent to
//      /sync straight away. Each question state carries a sequence number so
//      the server only keeps the newest one.
//   2. A 401 freezes the test (clock stopped, inputs blocked) and asks for the
//      password in place. After signing in, the unsent backlog is flushed and
//      the test carries on. Nothing is accepted while frozen.
//   3. A network failure keeps the backlog and retries every few seconds.
//   4. On reload, any backup state newer than the server's is re-sent.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, storeAuth } from '@/lib/auth';
import Calculator from '@/app/components/Calculator';
import QuestionView from '../QuestionView';
import {
  GreAnswer, GreBackup, GreSessionView, GreState, clearBackup, setLabel, formatClock, isAnswered, readBackup, writeBackup,
} from '@/lib/gre';

const F = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif';
const BLUE = '#2563EB';
const CLOCK_SYNC_MS = 15000;
const RETRY_MS = 5000;

type SaveStatus = 'saved' | 'saving' | 'offline';

function GreExamInner() {
  const router = useRouter();
  const testNo = Number(useParams().testNo);

  const [view, setView] = useState<GreSessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, GreState>>({});
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [authFrozen, setAuthFrozen] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [confirm, setConfirm] = useState<null | 'submit' | 'pause'>(null);
  const [busy, setBusy] = useState(false);

  const sidRef = useRef<string>('');
  const statesRef = useRef<Record<string, GreState>>({});
  const dirtyRef = useRef<Set<string>>(new Set());
  const clockDirtyRef = useRef(false);
  const seqRef = useRef(0);
  const timeRef = useRef(0);
  const idxRef = useRef(0);
  const inFlightRef = useRef(false);
  const frozenRef = useRef(false);
  const finishedRef = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  timeRef.current = timeLeft;
  idxRef.current = idx;
  frozenRef.current = authFrozen;

  const nextSeq = () => (seqRef.current = Math.max(seqRef.current + 1, Date.now()));
  const clock = () => ({ time_left: timeRef.current, current_index: idxRef.current, seq: nextSeq() });

  const backup = useCallback(() => {
    if (!sidRef.current || finishedRef.current) return;
    const b: GreBackup = { states: statesRef.current, clock: { time_left: timeRef.current, current_index: idxRef.current, seq: seqRef.current } };
    writeBackup(sidRef.current, b);
  }, []);

  // Send everything not yet confirmed by the server.
  const flush = useCallback(async () => {
    if (!sidRef.current || inFlightRef.current || frozenRef.current || finishedRef.current) return;
    if (!dirtyRef.current.size && !clockDirtyRef.current) { setSaveStatus('saved'); return; }
    inFlightRef.current = true;
    setSaveStatus('saving');
    const sending: Record<string, GreState> = {};
    dirtyRef.current.forEach(k => { sending[k] = statesRef.current[k]; });
    const body = { states: sending, clock: clock() };
    try {
      const res = await apiFetch(`/api/gre/sessions/${sidRef.current}/sync`, { method: 'POST', body: JSON.stringify(body) });
      if (res.status === 401) { setAuthFrozen(true); setSaveStatus('offline'); return; }
      if (res.status === 409) { finishedRef.current = true; router.replace('/gre'); return; }
      if (!res.ok) throw new Error(String(res.status));
      // Only clear what is unchanged since we sent it.
      for (const [k, st] of Object.entries(sending)) if (statesRef.current[k]?.seq === st.seq) dirtyRef.current.delete(k);
      clockDirtyRef.current = false;
      setSaveStatus(dirtyRef.current.size ? 'saving' : 'saved');
    } catch {
      setSaveStatus('offline');
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => { retryRef.current = null; flush(); }, RETRY_MS);
    } finally {
      inFlightRef.current = false;
    }
    if (dirtyRef.current.size && !frozenRef.current) flush();
  }, [router]);

  // ── Load / resume ── (once: React dev mode runs effects twice)
  const startedRef = useRef(false);
  useEffect(() => {
    if (!Number.isInteger(testNo)) { setError('Invalid test'); return; }
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await apiFetch(`/api/gre/tests/${testNo}/start`, { method: 'POST' });
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) throw new Error(res.status === 403 ? 'This section is private.' : 'Could not start the test');
        const v: GreSessionView = await res.json();
        sidRef.current = v.session_id;
        const merged: Record<string, GreState> = { ...v.states };
        let time = v.time_left, at = v.current_index, maxSeq = v.clock_seq || 0;
        Object.values(v.states).forEach(s => { maxSeq = Math.max(maxSeq, s.seq || 0); });
        // Re-send anything the backup has that the server never got.
        const b = readBackup(v.session_id);
        if (b) {
          for (const [k, s] of Object.entries(b.states)) {
            if (!merged[k] || (s.seq || 0) > (merged[k].seq || 0)) { merged[k] = s; dirtyRef.current.add(k); }
            maxSeq = Math.max(maxSeq, s.seq || 0);
          }
          if (b.clock.seq > (v.clock_seq || 0)) { time = b.clock.time_left; at = b.clock.current_index; clockDirtyRef.current = true; }
        }
        seqRef.current = maxSeq;
        statesRef.current = merged;
        setStates(merged);
        setTimeLeft(time); timeRef.current = time;
        const start = Math.min(Math.max(0, at), v.questions.length - 1);
        setIdx(start); idxRef.current = start;
        setView(v);
        flush();
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [testNo, router, flush]);

  // ── Record a change to the current question ──
  const update = useCallback((key: string, patch: Partial<GreState>) => {
    if (frozenRef.current || finishedRef.current) return;
    const prev = statesRef.current[key] || { answer: null, marked: false, time_spent: 0, seq: 0 };
    const st = { ...prev, ...patch, seq: nextSeq() };
    statesRef.current = { ...statesRef.current, [key]: st };
    setStates(statesRef.current);
    dirtyRef.current.add(key);
    backup();
    flush();
  }, [backup, flush]);

  // ── Submit ──
  const submit = useCallback(async (auto = false) => {
    if (finishedRef.current || !sidRef.current) return;
    if (frozenRef.current) return; // must re-login first; the timer is stopped meanwhile
    setBusy(true);
    try {
      const res = await apiFetch(`/api/gre/sessions/${sidRef.current}/submit`, {
        method: 'POST', body: JSON.stringify({ states: statesRef.current, clock: clock() }),
      });
      if (res.status === 401) { setAuthFrozen(true); return; }
      if (!res.ok) throw new Error('submit failed');
      finishedRef.current = true;
      clearBackup(sidRef.current);
      router.replace(`/gre/result/${sidRef.current}`);
    } catch {
      setSaveStatus('offline');
      if (auto) setTimeout(() => submit(true), RETRY_MS);
      else alert('Could not submit. Your answers are safe; check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [router]);

  // ── Clock: ticks only while the test is live; auto-submits at zero ──
  useEffect(() => {
    if (!view) return;
    const t = setInterval(() => {
      if (frozenRef.current || finishedRef.current) return;
      const q = view.questions[idxRef.current];
      const prev = statesRef.current[q.key];
      statesRef.current = { ...statesRef.current, [q.key]: { answer: prev?.answer ?? null, marked: prev?.marked ?? false, seq: prev?.seq ?? 0, time_spent: (prev?.time_spent || 0) + 1 } };
      const left = timeRef.current - 1;
      timeRef.current = left;
      setTimeLeft(left);
      if (left <= 0) submit(true);
    }, 1000);
    const c = setInterval(() => {
      if (frozenRef.current || finishedRef.current) return;
      // time_spent rides along with the clock sync for the open question
      const q = view.questions[idxRef.current];
      if (statesRef.current[q.key]) { statesRef.current[q.key] = { ...statesRef.current[q.key], seq: nextSeq() }; dirtyRef.current.add(q.key); }
      clockDirtyRef.current = true;
      backup();
      flush();
    }, CLOCK_SYNC_MS);
    const onHide = () => { if (document.visibilityState === 'hidden') { clockDirtyRef.current = true; backup(); flush(); } };
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(t); clearInterval(c); document.removeEventListener('visibilitychange', onHide); };
  }, [view, submit, backup, flush]);

  const goTo = (i: number) => {
    if (!view || frozenRef.current) return;
    const n = Math.min(Math.max(0, i), view.questions.length - 1);
    setIdx(n); idxRef.current = n;
    setShowGrid(false);
    clockDirtyRef.current = true;
    backup();
    flush();
  };

  const pauseAndExit = async () => {
    if (!sidRef.current || frozenRef.current) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/gre/sessions/${sidRef.current}/pause`, {
        method: 'POST', body: JSON.stringify({ states: statesRef.current, clock: clock() }),
      });
      if (res.status === 401) { setAuthFrozen(true); return; }
      if (!res.ok) throw new Error();
      finishedRef.current = true;
      router.push('/gre');
    } catch {
      alert('Could not reach the server. Your answers are backed up on this device; try again in a moment.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const onReauth = () => { setAuthFrozen(false); frozenRef.current = false; clockDirtyRef.current = true; flush(); };

  if (error) return <Centered><div style={{ color: '#991B1B' }}>{error}</div><button onClick={() => router.push('/gre')} style={linkBtn}>Back to tests</button></Centered>;
  if (!view) return <Centered>Loading test…</Centered>;

  const q = view.questions[idx];
  const st = states[q.key];
  const set = q.set_id ? view.sets.find(s => s.set_id === q.set_id) : undefined;
  const answered = view.questions.filter(x => isAnswered(states[x.key]?.answer)).length;
  const marked = view.questions.filter(x => states[x.key]?.marked).length;
  const low = timeLeft <= 300;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: F, background: '#F1F5F9' }}>
      {/* Top bar */}
      <header style={{ background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 60, flexShrink: 0, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 17 }}>GRE Quant · Test {view.test_no}</strong>
        <span style={{ fontSize: 15, color: '#94A3B8' }}>Question {idx + 1} of {view.questions.length}</span>
        <div style={{ flex: 1 }} />
        <SaveBadge status={saveStatus} />
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 20, padding: '4px 12px', background: low ? '#DC2626' : '#1E293B' }}>{formatClock(timeLeft)}</span>
        <TopBtn onClick={() => setShowCalc(v => !v)}>Calculator</TopBtn>
        <TopBtn onClick={() => setShowGrid(v => !v)}>Review</TopBtn>
        <TopBtn onClick={() => setConfirm('pause')}>Pause &amp; Exit</TopBtn>
        <TopBtn onClick={() => setConfirm('submit')} strong>Submit</TopBtn>
      </header>

      {/* Question */}
      <main style={{ flex: 1, overflow: 'auto', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1700, margin: '0 auto', background: '#fff', border: '1px solid #E2E8F0', padding: '28px 40px', minHeight: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#64748B' }}>Question {idx + 1}</span>
            <div style={{ flex: 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, cursor: 'pointer', color: st?.marked ? '#B45309' : '#475569' }}>
              <input type="checkbox" checked={!!st?.marked} onChange={e => update(q.key, { marked: e.target.checked })} />
              Mark for review
            </label>
          </div>
          <QuestionView q={q} set={set} setLabel={setLabel(view.questions, q.set_id)} answer={st?.answer ?? null} onChange={(a: GreAnswer) => update(q.key, { answer: a })} />
        </div>
      </main>

      {/* Bottom nav */}
      <footer style={{ background: '#fff', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexShrink: 0 }}>
        <button onClick={() => goTo(idx - 1)} disabled={idx === 0} style={navBtn(idx === 0)}>← Back</button>
        <span style={{ fontSize: 15, color: '#64748B' }}>{answered} answered · {marked} marked</span>
        <div style={{ flex: 1 }} />
        {idx < view.questions.length - 1
          ? <button onClick={() => goTo(idx + 1)} style={navBtn(false, true)}>Next →</button>
          : <button onClick={() => setShowGrid(true)} style={navBtn(false, true)}>Review all</button>}
      </footer>

      {/* Review grid */}
      {showGrid && (
        <Modal onClose={() => setShowGrid(false)}>
          <h3 style={{ margin: '0 0 12px' }}>Review</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {view.questions.map((x, i) => {
              const s = states[x.key];
              const done = isAnswered(s?.answer);
              return (
                <button key={x.key} onClick={() => goTo(i)} style={{
                  position: 'relative', aspectRatio: '1', fontWeight: 700, cursor: 'pointer', fontFamily: F,
                  background: done ? '#DBEAFE' : '#fff', border: i === idx ? `2px solid ${BLUE}` : '1px solid #CBD5E1', color: '#0F172A',
                }}>
                  {i + 1}
                  {s?.marked && <span style={{ position: 'absolute', top: 2, right: 4, color: '#B45309', fontSize: 11 }}>⚑</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748B', marginTop: 12 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#DBEAFE', border: '1px solid #CBD5E1' }} /> Answered</span>
            <span><span style={{ color: '#B45309' }}>⚑</span> Marked</span>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal onClose={() => !busy && setConfirm(null)}>
          {confirm === 'submit' ? (
            <>
              <h3 style={{ margin: '0 0 8px' }}>Submit Test {view.test_no}?</h3>
              <p style={{ fontSize: 14, color: '#475569' }}>{answered} of {view.questions.length} answered, {marked} marked, {formatClock(timeLeft)} left. This can&apos;t be undone.</p>
            </>
          ) : (
            <>
              <h3 style={{ margin: '0 0 8px' }}>Pause and exit?</h3>
              <p style={{ fontSize: 14, color: '#475569' }}>Your answers and the {formatClock(timeLeft)} left are saved. You&apos;ll resume on question {idx + 1}.</p>
            </>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setConfirm(null)} disabled={busy} style={navBtn(false)}>Cancel</button>
            <button onClick={() => (confirm === 'submit' ? submit() : pauseAndExit())} disabled={busy} style={navBtn(false, true)}>
              {busy ? 'Working…' : confirm === 'submit' ? 'Submit' : 'Pause & Exit'}
            </button>
          </div>
        </Modal>
      )}

      {authFrozen && <ReauthModal onDone={onReauth} />}
      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}
    </div>
  );
}

// Shown when the login expires mid-test. The clock is stopped and nothing can be
// answered until the user signs in again; then the unsent answers are flushed.
function ReauthModal({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign-in failed');
      storeAuth(data.token, data.user);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}>
      <form onSubmit={signIn} style={{ background: '#fff', padding: 24, width: '100%', maxWidth: 380, fontFamily: F }}>
        <h3 style={{ margin: '0 0 6px' }}>Your login expired</h3>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 14px' }}>The test and clock are paused. Your answers are safe on this device and will be saved as soon as you sign in.</p>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={field} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={field} />
        {err && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ ...navBtn(false, true), width: '100%' }}>{busy ? 'Signing in…' : 'Sign in and continue'}</button>
      </form>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  const map = { saved: ['All saved', '#22C55E'], saving: ['Saving…', '#EAB308'], offline: ['Not saved yet', '#F87171'] } as const;
  const [label, color] = map[status];
  return <span style={{ fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />{label}</span>;
}

function TopBtn({ children, onClick, strong }: { children: React.ReactNode; onClick: () => void; strong?: boolean }) {
  return <button onClick={onClick} style={{ padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F, background: strong ? BLUE : 'transparent', color: '#fff', border: strong ? 'none' : '1px solid #334155' }}>{children}</button>;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: 22, width: '100%', maxWidth: 460, fontFamily: F }}>{children}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', fontFamily: F, color: '#334155' }}>{children}</div>;
}

const field: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #CBD5E1', marginBottom: 10, boxSizing: 'border-box' };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: 14 };
function navBtn(disabled: boolean, primary = false): React.CSSProperties {
  return { padding: '11px 24px', fontSize: 16, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', fontFamily: F, opacity: disabled ? 0.4 : 1, background: primary ? BLUE : '#fff', color: primary ? '#fff' : '#0F172A', border: primary ? 'none' : '1px solid #CBD5E1' };
}

export default function GreExamPage() {
  return <Suspense fallback={<Centered>Loading test…</Centered>}><GreExamInner /></Suspense>;
}
