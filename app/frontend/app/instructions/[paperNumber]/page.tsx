'use client';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function InstructionsPageInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const paperNumber = params.paperNumber as string;
  const demo = searchParams.get('demo') === 'true';
  const [agreed, setAgreed] = useState(false);

  const startExam = () => {
    if (!agreed) {
      alert('Please accept the declaration before proceeding.');
      return;
    }
    router.push(`/exam/${paperNumber}${demo ? '?demo=true' : ''}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#e8e8e8', color: '#111111', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: '#003366', color: 'white', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #cc6600' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#cc6600', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 14 }}>C</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 14 }}>CAT Mock Exam Portal</div>
            <div style={{ fontSize: 11, color: '#aac4ff' }}>Assessment Examination Centre</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#aac4ff' }}>Mock Paper {paperNumber}</div>
      </div>

      {/* Title bar */}
      <div style={{ background: '#0052cc', padding: '10px 16px', textAlign: 'center' }}>
        <div style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>CAT Mock Paper {paperNumber}</div>
        <div style={{ color: '#cce0ff', fontSize: 12 }}>Please read all instructions carefully before starting the exam</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* Notice box */}
          <div style={{ border: '2px solid #333', padding: '14px 18px', marginBottom: 20, background: 'white', fontSize: 13 }}>
            <strong>The number, type and pattern of questions, as well as sequence and timing of sections in the Mock Exam are only indicative and these are subject to variations from year to year as decided by the CAT authorities.</strong>
          </div>

          <div style={{ background: 'white', padding: '20px 24px', border: '1px solid #ccc', fontSize: 13, lineHeight: 1.7 }}>
            <h2 style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 16, marginTop: 0 }}>General Instructions:</h2>
            <ol style={{ paddingLeft: 24, margin: 0 }}>
              <li style={{ marginBottom: 10 }}>To log in, enter your registration number and password following the instructions provided to you by the invigilator.</li>
              <li style={{ marginBottom: 10 }}>The total duration of the test is <strong>120 minutes</strong>. For PwD candidates, the total duration is 160 minutes.</li>
              <li style={{ marginBottom: 10 }}>The test has <strong>3 (three) sections</strong>. The time allotted to each section is <strong>40 minutes</strong> (53 minutes and 20 seconds for PwD candidates). As soon as the candidate visits a section, the clock (displayed as "Time Left" in the top right corner of the screen) will start. On completion of 40 minutes, the clock will stop, the particular section will be locked, and the answers to questions in that section will be auto-submitted. The candidate will then need to proceed to the next section. The exact same process will be repeated in the other two sections. After submitting all three sections, a summary of the answers will appear on the screen.</li>
              <li style={{ marginBottom: 10 }}>The candidate's computer time will be synchronized with the server clock. The countdown timer ("Time Left") at the top right corner of the computer screen indicates the remaining time to complete the current section. When the timer reaches zero, the section test will automatically end.</li>
              <li style={{ marginBottom: 10 }}>No candidate will be allowed to leave the test hall before 120 minutes.</li>
              <li style={{ marginBottom: 10 }}>The question paper will include a mix of Multiple-Choice Questions (MCQs) with options and Non-MCQs (TITA — Type In The Answer).</li>
              <li style={{ marginBottom: 10 }}>For an MCQ, a candidate will receive <strong>3 marks</strong> for a correct answer, <strong>-1 mark</strong> for a wrong answer, and <strong>0 marks</strong> for an unattempted question.</li>
              <li style={{ marginBottom: 10 }}>For a Non-MCQ (TITA), a candidate will receive <strong>3 marks</strong> for a correct answer and <strong>0 marks</strong> for both wrong and unattempted questions. There will be <strong>no negative marking</strong> for incorrect answers in non-MCQ questions.</li>
              <li style={{ marginBottom: 10 }}>An MCQ will have four choices, of which only one is correct.</li>
              <li style={{ marginBottom: 10 }}>An on-screen calculator will be provided, which can be used for computing.</li>
              <li style={{ marginBottom: 10 }}>Candidates are expected to familiarise themselves with various symbols. The question palette displayed on the right side of the screen will show the status of each question with the help of one of the following symbols:</li>
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
                  { label: 'D', cls: 'q-marked', meaning: 'You have NOT answered the question, but have marked the question for Review.' },
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

            <ol start={12} style={{ paddingLeft: 24, margin: 0 }}>
              <li style={{ marginBottom: 10 }}>*Answers to all questions flagged as <strong>'Marked for Review'</strong> will be automatically considered as submitted for evaluation at the end of the time allotted for that section.</li>
              <li style={{ marginBottom: 10 }}>Click the " &gt; " arrow to the left of the question palette to collapse it and make the window larger. To reopen the question palette, click the " &lt; " arrow on the right side of the computer console.</li>
              <li style={{ marginBottom: 10 }}><strong>To answer a question, follow these steps:</strong>
                <ol type="a" style={{ paddingLeft: 20, marginTop: 6 }}>
                  <li>Click on the question number in the question palette to go directly to that question.</li>
                  <li>Select an answer for an MCQ by clicking the radio button located to the left of the choice.</li>
                  <li>For a non-MCQ, enter only a whole number as the answer in the provided space using the on-screen keyboard.</li>
                </ol>
              </li>
              <li style={{ marginBottom: 10 }}>Click on <strong>'Save &amp; Next'</strong> to save your answer for the current question and then proceed to the next question. To revisit an answered question, click on <strong>"Mark for Review &amp; Next"</strong>.</li>
              <li style={{ marginBottom: 10 }}><strong>Caution:</strong> Your answer for the current question will not be saved if you navigate directly to another question by clicking on a question number and do not click the 'Save &amp; Next' or 'Mark for Review &amp; Next' button.</li>
              <li style={{ marginBottom: 10 }}>You can view all questions in a section by clicking the 'Question Paper' button.</li>
              <li style={{ marginBottom: 10 }}>Navigating through Sections:
                <ol type="a" style={{ paddingLeft: 20, marginTop: 6 }}>
                  <li>The test has three sections administered in the order: VARC → DILR → QA.</li>
                  <li>The names of the three sections are displayed on the top bar. The section you are currently viewing is highlighted.</li>
                  <li>You can only move to the next section after completing a minimum of 40 minutes in the current section.</li>
                </ol>
              </li>
            </ol>
          </div>

          {/* Declaration */}
          <div style={{ background: '#fff8e6', border: '1px solid #e6b800', padding: '16px 20px', marginTop: 16, borderRadius: 4 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#7a4f00' }}>Declaration</h3>
            <p style={{ fontSize: 12, color: '#555', margin: '0 0 12px', lineHeight: 1.6 }}>
              I have read and understood the instructions. All computer hardware allotted to me are in proper working condition. I declare that I am not in possession of / not wearing / not carrying any prohibited gadgets like mobile phone, bluetooth devices etc. I agree that in case of not adhering to the instructions, I shall be liable to be debarred from this Test and/or to disciplinary action.
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
              onClick={() => router.back()}
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

export default function InstructionsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8e8', color: '#003366', fontWeight: 'bold' }}>Loading…</div>}>
      <InstructionsPageInner />
    </Suspense>
  );
}
