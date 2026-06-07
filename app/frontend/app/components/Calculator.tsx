'use client';
import { useState } from 'react';

// Floating on-screen calculator used by the exam interfaces.
export default function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [waitNext, setWaitNext] = useState(false);

  const handleNum = (n: string) => {
    if (waitNext) { setDisplay(n); setWaitNext(false); return; }
    setDisplay(display === '0' ? n : display + n);
  };
  const handleDot = () => {
    if (waitNext) { setDisplay('0.'); setWaitNext(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  };
  const handleOp = (o: string) => {
    setPrev(display); setOp(o); setWaitNext(true);
  };
  const handleEq = () => {
    if (!prev || !op) return;
    const a = parseFloat(prev), b = parseFloat(display);
    let res = 0;
    if (op === '+') res = a + b;
    else if (op === '-') res = a - b;
    else if (op === '×') res = a * b;
    else if (op === '÷') res = b !== 0 ? a / b : 0;
    else if (op === '%') res = a % b;
    setDisplay(String(parseFloat(res.toFixed(10))));
    setPrev(null); setOp(null); setWaitNext(true);
  };
  const handleClear = () => { setDisplay('0'); setPrev(null); setOp(null); setWaitNext(false); };
  const handleBack = () => { setDisplay(display.length > 1 ? display.slice(0, -1) : '0'); };
  const handleSign = () => { setDisplay(String(-parseFloat(display))); };

  const btn = (label: string, onClick: () => void, bg = '#e0e0e0', color = '#111') => (
    <button key={label} onClick={onClick} style={{
      padding: '10px 0', background: bg, color, border: '1px solid #bbb',
      borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 'bold', width: '100%',
    }}>{label}</button>
  );

  return (
    <div style={{
      position: 'fixed', top: 80, right: 20, zIndex: 1000,
      background: '#f5f5f5', border: '2px solid #003366',
      borderRadius: 8, width: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ background: '#003366', color: 'white', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '6px 6px 0 0' }}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Calculator</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ background: 'white', border: '1px solid #ccc', borderRadius: 4, padding: '8px 10px', textAlign: 'right', fontSize: 20, fontWeight: 'bold', marginBottom: 8, minHeight: 40, wordBreak: 'break-all' }}>
          {display}
        </div>
        {op && prev && <div style={{ fontSize: 11, color: '#666', textAlign: 'right', marginBottom: 4 }}>{prev} {op}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
          {btn('C', handleClear, '#ffcccc', '#900')}
          {btn('+/-', handleSign)}
          {btn('%', () => handleOp('%'))}
          {btn('÷', () => handleOp('÷'), '#003366', 'white')}
          {btn('7', () => handleNum('7'))}
          {btn('8', () => handleNum('8'))}
          {btn('9', () => handleNum('9'))}
          {btn('×', () => handleOp('×'), '#003366', 'white')}
          {btn('4', () => handleNum('4'))}
          {btn('5', () => handleNum('5'))}
          {btn('6', () => handleNum('6'))}
          {btn('-', () => handleOp('-'), '#003366', 'white')}
          {btn('1', () => handleNum('1'))}
          {btn('2', () => handleNum('2'))}
          {btn('3', () => handleNum('3'))}
          {btn('+', () => handleOp('+'), '#003366', 'white')}
          {btn('⌫', handleBack)}
          {btn('0', () => handleNum('0'))}
          {btn('.', handleDot)}
          {btn('=', handleEq, '#cc6600', 'white')}
        </div>
      </div>
    </div>
  );
}
