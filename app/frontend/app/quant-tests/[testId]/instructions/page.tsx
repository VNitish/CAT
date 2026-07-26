'use client';
import { useRouter, useParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function QtInstructionsInner() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;
  const [agreed, setAgreed] = useState(false);

  const startExam = () => {
    if (!agreed) {
      alert('Please accept the declaration before proceeding.');
      return;
    }
    router.push(`/quant-tests/${testId}/exam`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#e8e8e8', color: '#111111', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: '#003366', color: 'white', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #cc6600' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#cc6600', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 14 }}>C</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 14 }}>Quant Mock Exam Portal</div>
            <div style={{ fontSize: 11, color: '#aac4ff' }}>Quantitative Ability</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#aac4ff' }}>Test {testId}</div>
      </div>

      {/* Title bar */}
      <div style={{ background: '#0052cc', padding: '10px 16px', textAlign: 'center' }}>
        <div style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Quantitative Ability — Test {testId}</div>
        <div style={{ color: '#cce0ff', fontSize: 12 }}>Please read all instructions carefully before starting the test</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          <div style={{ background: 'white', padding: '20px 24px', border: '1px solid #ccc', fontSize: 13, lineHeight: 1.7 }}>
            <h2 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 16, marginTop: 0 }}>General Instructions:</h2>
            <ol style={{ paddingLeft: 24, margin: 0 }}>
              <li style={{ marginBottom: 10 }}>This is a <strong>Quantitative Ability</strong> sectional test of <strong>30 questions</strong> to be attempted in <strong>55 minutes</strong> &mdash; the same pace as the real CAT QA section.</li>
              <li style={{ marginBottom: 10 }}>Questions from the chapters in this block are <strong>interleaved</strong>, exactly as they are in the actual exam. Expect to switch topics from one question to the next.</li>
              <li style={{ marginBottom: 10 }}><strong>The clock does not auto-submit.</strong> When the timer reaches zero it keeps running into negative time and the label changes to &ldquo;Overtime&rdquo;, so you can see exactly how far past 55 minutes you went. Finish the paper and submit whenever you are ready &mdash; your overrun is reported alongside your score.</li>
              <li style={{ marginBottom: 10 }}>There are two question formats:
                <ul style={{ paddingLeft: 20, marginTop: 6, marginBottom: 0 }}>
                  <li style={{ marginBottom: 4 }}><strong>MCQ</strong> &mdash; four options, exactly one correct. <strong>+3</strong> for a correct answer, <strong>&minus;1</strong> for a wrong one.</li>
                  <li><strong>TITA</strong> (Type In The Answer) &mdash; no options; type the number into the answer box. <strong>+3</strong> for a correct answer and <strong>no negative marking</strong>, so never leave a TITA question blank.</li>
                </ul>
              </li>
              <li style={{ marginBottom: 10 }}>An unattempted question always scores <strong>0</strong>. The maximum possible score is <strong>90</strong>.</li>
              <li style={{ marginBottom: 10 }}>An on-screen <strong>calculator</strong> is available, as in the real exam.</li>
              <li style={{ marginBottom: 10 }}>Your progress is saved automatically. You can use <strong>Save &amp; Exit</strong> to leave and resume later; the timer is frozen while you are away and restored when you return.</li>
              <li style={{ marginBottom: 10 }}>The question palette on the right shows the status of each question:</li>
            </ol>

            {/* Status legend table */}
            <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12, marginBottom: 16, fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#003366', color: 'white' }}>
                  <th style={{ border: '1px solid #ccc', padding: '8px 12px', width: 60 }}>S.No.</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px 12px', width: 100 }}>Question Status</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px 12px' }}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'A', cls: 'q-not-visited', meaning: 'You have not visited the question yet.' },
                  { label: 'B', cls: 'q-not-answered', meaning: 'You have visited the question but have not answered it.' },
                  { label: 'C', cls: 'q-answered', meaning: 'You have answered the question.' },
                  { label: 'D', cls: 'q-marked', meaning: 'You have NOT answered the question, but have marked it for Review.' },
                  { label: 'E', cls: 'q-answered-marked', meaning: 'You have answered the question, but marked it for review. The answer will be considered for evaluation.' },
                ].map(row => (
                  <tr key={row.label}>
                    <td style={{ border: '1px solid #ccc', padding: '6px 12px', textAlign: 'center', background: '#f9f9f9' }}><strong>{row.label}</strong></td>
                    <td style={{ border: '1px solid #ccc', padding: '6px 12px', textAlign: 'center' }}>
                      <span className={row.cls} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', fontWeight: 'bold', fontSize: 13 }}>
                        {row.label === 'A' ? '1' : row.label === 'B' ? '3' : row.label === 'C' ? '5' : row.label === 'D' ? '7' : '0'}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '6px 12px' }}>{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ol start={9} style={{ paddingLeft: 24, margin: 0 }}>
              <li style={{ marginBottom: 10 }}>Click <strong>&lsquo;Save &amp; Next&rsquo;</strong> to save your answer and move on; use <strong>&lsquo;Mark for Review &amp; Next&rsquo;</strong> to flag a question to revisit.</li>
              <li style={{ marginBottom: 10 }}>After you submit, you can review every question with the correct answer, a detailed solution, and a <strong>breakdown of your accuracy by pattern</strong> so you can see which techniques cost you marks.</li>
            </ol>
          </div>

          {/* Declaration */}
          <div style={{ background: '#fff8e6', border: '1px solid #e6b800', padding: '16px 20px', marginTop: 16, borderRadius: 4 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#7a4f00' }}>Declaration</h3>
            <p style={{ fontSize: 12, color: '#555', margin: '0 0 12px', lineHeight: 1.6 }}>
              I have read and understood the instructions. I agree that in case of not adhering to the instructions, I shall be liable to disciplinary action.
            </p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: '#333' }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, cursor: 'pointer' }}
              />
              <span>I agree to all the terms &amp; conditions stated above and hereby declare that I have read and understood the above.</span>
            </label>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16, paddingBottom: 24 }}>
            <button
              onClick={() => router.push('/quant-tests')}
              style={{ padding: '10px 24px', background: '#666', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}
            >
              ← Back
            </button>
            <button
              onClick={startExam}
              style={{
                padding: '10px 32px',
                background: agreed ? '#003399' : '#999',
                color: 'white', border: 'none', borderRadius: 4,
                cursor: agreed ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 'bold',
                transition: 'background 0.2s',
              }}
            >
              I am ready to begin →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QtInstructionsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8e8', color: '#003366', fontWeight: 'bold' }}>Loading…</div>}>
      <QtInstructionsInner />
    </Suspense>
  );
}
