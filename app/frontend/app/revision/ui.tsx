'use client';
import React from 'react';
import MathText from '@/app/components/MathText';

/* Design tokens for the Quant Revision study desk — a dark, self-contained
 * surface that deliberately reads as its own room inside the light app.
 * Sora is loaded in app/layout.tsx. */
export const F = '"Sora", system-ui, -apple-system, "Segoe UI", sans-serif';

export const C = {
  page:      '#0c0c0d',
  shell:     '#17181A',
  bar:       '#141517',
  panel:     '#242528',
  card:      '#1e1f22',
  soft:      '#1a1b1d',
  line:      '#232427',
  line2:     '#2a2b2e',
  line3:     '#2f3033',
  accent:    '#3EE58B',
  onAccent:  '#062a18',
  onAccent2: '#0a3d24',
  cyan:      '#8CE7EF',
  onCyan:    '#0c2e30',
  onCyan2:   '#164447',
  red:       '#ff6b5e',
  text:      '#f4f5f3',
  textHi:    '#f6f7f5',
  textMid:   '#e7e9e6',
  textSoft:  '#c9ccc9',
  muted:     '#9a9ea0',
  dim:       '#7c8078',
  off:       '#6b6f6a',
};

/* The design's `image-slot` placeholders. With an image we show it; without
 * one we show a muted panel with a faint accent glow, so an unfilled chapter
 * still reads as finished rather than as a missing asset. */
export function Frame({ src, alt = '', radius = 0 }: { src?: string; alt?: string; radius?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: radius }} />;
  }
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: radius, background: C.panel,
      backgroundImage: `radial-gradient(120% 90% at 78% 12%, rgba(62,229,139,.16), transparent 62%),
                        radial-gradient(90% 80% at 12% 96%, rgba(140,231,239,.10), transparent 60%)`,
    }} />
  );
}

/* Prose fields (notes, prompts, solutions) go through MathText so markdown and
 * KaTeX in seeded content render. Formula fields keep their authored spacing. */
export function Prose({ children, style, inline = true }: { children?: string; style?: React.CSSProperties; inline?: boolean }) {
  if (!children) return null;
  // Block mode renders a <div>, so it needs a <div> wrapper to stay valid HTML.
  const Tag = inline ? 'span' : 'div';
  return <Tag style={style}><MathText inline={inline}>{children}</MathText></Tag>;
}

export function Formula({ children, style }: { children?: string; style?: React.CSSProperties }) {
  if (!children) return null;
  return <span style={{ whiteSpace: 'pre-wrap', ...style }}><MathText inline>{children}</MathText></span>;
}

export function Arrow({ size = 18, color = 'currentColor', width = 2.2 }: { size?: number; color?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ size = 14, color = 'currentColor', width = 2.6 }: { size?: number; color?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* A pop-up that sits in front of the page without covering it: dimmed backdrop,
 * a bounded card centered over it. Click outside or the caller's close control
 * dismisses it — this component only renders the frame. */
export function Overlay({ onClose, children, maxWidth = 560 }: { onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4,5,6,.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 60,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: maxWidth, maxWidth: '100%', maxHeight: '82vh', overflowY: 'auto',
          background: C.shell, border: `1px solid ${C.line2}`, borderRadius: 22,
          boxShadow: '0 40px 90px -30px rgba(0,0,0,.75)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.page, fontFamily: F, color: C.text,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '36px 24px',
    }}>
      <style>{`
        .rv-md p{margin:0}
        .rv-md p+p{margin-top:10px}
        .rv-md strong{font-weight:700;color:var(--rv-strong, ${C.textMid})}
        .rv-md .katex{font-size:1em}
        .rv-md em{color:${C.dim};font-style:normal;font-size:.92em}
        .rv-md ol{margin:10px 0 0;padding:0;list-style:none;counter-reset:step;display:flex;flex-direction:column;gap:10px}
        .rv-md ol:first-child{margin-top:0}
        .rv-md ol li{position:relative;padding-left:30px;counter-increment:step}
        .rv-md ol li::before{
          content:counter(step);position:absolute;left:0;top:0.05em;width:20px;height:20px;border-radius:6px;
          background:${C.accent};color:${C.onAccent};font:700 11px/20px ${F};text-align:center;
        }
        .rv-md ul{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
        .rv-md ul:first-child{margin-top:0}
        .rv-md ul li{position:relative;padding-left:15px}
        .rv-md ul li::before{content:'';position:absolute;left:1px;top:.6em;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.55}
        .rv-print-only{display:none}
        @media print {
          body{background:#fff}
          .rv-noprint{display:none !important}
          .rv-screen-only{display:none !important}
          .rv-print-only{display:grid !important}
          .rv-shell{box-shadow:none !important;border:none !important;width:100% !important}
          *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        }
      `}</style>
      <div className="rv-shell" style={{
        width: 1000, maxWidth: '100%', background: C.shell, border: `1px solid ${C.line}`,
        borderRadius: 22, boxShadow: '0 30px 70px -30px rgba(0,0,0,.7)', overflow: 'hidden',
        minHeight: 680, display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
    </div>
  );
}

export function TopBar({ crumb, right }: { crumb: string; right?: React.ReactNode }) {
  return (
    <div className="rv-noprint" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '18px 28px', borderBottom: `1px solid ${C.line}`, background: C.bar,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accent, display: 'grid', placeItems: 'center', font: `800 14px/1 ${F}`, color: C.onAccent, flex: 'none' }}>Q</div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ font: `700 14px/1 ${F}`, color: C.text, letterSpacing: '-.01em' }}>Quant Revision</span>
          <span style={{ font: `500 11px/1.2 ${F}`, color: C.dim, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{crumb}</span>
        </div>
      </div>
      {right}
    </div>
  );
}

export const btnAccent: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, padding: '14px 26px', borderRadius: 14,
  border: 'none', background: C.accent, color: C.onAccent, font: `700 14px ${F}`, cursor: 'pointer',
};
export const btnCyan: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, padding: '15px 28px', borderRadius: 14,
  border: 'none', background: C.cyan, color: C.onCyan, font: `700 15px ${F}`, cursor: 'pointer', whiteSpace: 'nowrap',
};
export const btnQuiet: React.CSSProperties = {
  padding: '14px 26px', borderRadius: 14, border: `1px solid ${C.line3}`, background: C.panel,
  color: C.textMid, font: `700 14px ${F}`, cursor: 'pointer',
};
export const btnBare: React.CSSProperties = {
  background: 'none', border: 'none', color: C.dim, font: `600 12px ${F}`, cursor: 'pointer',
};
