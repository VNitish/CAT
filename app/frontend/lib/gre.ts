// Shared types and helpers for the GRE daily tests: Quant (/gre) and Verbal (/gre/verbal).

export type GreType = 'QC' | 'MCQ' | 'MULTI' | 'NUMERIC' | 'FRACTION' | 'TC' | 'SE' | 'RC_MCQ' | 'RC_MULTI' | 'RC_SELECT';
// TC answers are one letter (or null) per blank; SE/MULTI a list; RC_SELECT the chosen sentence.
export type GreAnswer = string | (string | null)[] | { num: string; den: string } | null;

export interface GreQuestion {
  key: string;                       // "ch07_q14"
  chapter_no: number;
  chapter: string;
  area: string;
  question_number: number;
  question_type: GreType;
  select_count: 'all' | 2 | 3 | null;
  set_id: string | null;
  common_info_latex: string;
  question_latex: string;
  quantity_a_latex: string | null;
  quantity_b_latex: string | null;
  options: Record<string, string> | null;
  answer_unit: string | null;
  answer_prefix: string | null;
  images: string[];
  // verbal
  passage_id?: string | null;
  question_text?: string;
  blanks?: { label: string; options: Record<string, string> }[] | null;
  // only after submit
  correct_answer?: string | string[] | { num: number; den: number };
  solution_latex?: string;
  solution_text?: string;
  result?: boolean | null;           // true right, false wrong, null skipped
}

export interface GrePassage { passage_id: string; kind: 'short' | 'long' | 'argument'; text: string; question_numbers: number[] }

export interface GreSet { set_id: string; intro_latex: string; images: string[]; question_numbers: number[] }

export interface GreState { answer: GreAnswer; marked: boolean; time_spent: number; seq: number }

export interface GreScore {
  correct: number; incorrect: number; skipped: number; total: number;
  time_used: number; by_area: Record<string, { correct: number; total: number }>;
}

export interface GreSessionView {
  session_id: string;
  test_no: number;
  subject: 'quant' | 'verbal';
  display_no: number;
  passages?: GrePassage[];
  status: 'in_progress' | 'paused' | 'submitted';
  questions: GreQuestion[];
  sets: GreSet[];
  states: Record<string, GreState>;
  current_index: number;
  time_left: number;
  duration_seconds: number;
  clock_seq: number;
  score: GreScore | null;
}

// The four fixed Quantitative Comparison choices.
export const QC_OPTIONS: Record<string, string> = {
  a: 'Quantity A is greater.',
  b: 'Quantity B is greater.',
  c: 'The two quantities are equal.',
  d: 'The relationship cannot be determined from the information given.',
};

export function optionsFor(q: GreQuestion): Record<string, string> {
  return q.question_type === 'QC' ? QC_OPTIONS : (q.options || {});
}

export function isAnswered(a: GreAnswer | undefined): boolean {
  if (a === null || a === undefined || a === '') return false;
  if (Array.isArray(a)) return a.some(x => x);
  if (typeof a === 'object') return a.num !== '' && a.den !== '';
  return true;
}

export function formatClock(s: number) {
  const a = Math.max(0, Math.round(s));
  return `${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export function formatAnswer(q: GreQuestion, a: GreAnswer | GreQuestion['correct_answer'] | undefined): string {
  if (a === null || a === undefined || a === '' || (Array.isArray(a) && !a.length)) return '—';
  if (q.question_type === 'TC' && Array.isArray(a)) {
    return a.map((x, i) => (x && q.blanks?.[i]?.options[x]) || '—').join(' · ');
  }
  if (q.question_type === 'SE' && Array.isArray(a)) return a.map(x => (x && q.options?.[x]) || '—').join(', ');
  if (q.question_type === 'RC_SELECT') return typeof a === 'string' ? `“${a}”` : '—';
  if (Array.isArray(a)) return a.map(x => (x || '—').toUpperCase()).join(', ');
  if (typeof a === 'object') return `${a.num}/${a.den}`;
  if (q.question_type === 'NUMERIC') return `${q.answer_prefix || ''}${a}${q.answer_unit ? ' ' + q.answer_unit : ''}`;
  return a.toUpperCase();
}

// Local backup of every answer, so nothing is lost if the network drops or the
// login expires mid-test. Keyed by session; cleared after a successful submit.
const backupKey = (sid: string) => `gre_backup_${sid}`;
export interface GreBackup { states: Record<string, GreState>; clock: { time_left: number; current_index: number; seq: number } }
export function readBackup(sid: string): GreBackup | null {
  try { const raw = localStorage.getItem(backupKey(sid)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function writeBackup(sid: string, b: GreBackup) {
  try { localStorage.setItem(backupKey(sid), JSON.stringify(b)); } catch { /* storage full or blocked */ }
}
export function clearBackup(sid: string) {
  try { localStorage.removeItem(backupKey(sid)); } catch { /* ignore */ }
}

// "Questions 25–28 refer to the data below", in this test's numbering.
export function setLabel(qs: { set_id: string | null }[], setId: string | null) {
  if (!setId) return undefined;
  const nums = qs.map((x, i) => (x.set_id === setId ? i + 1 : 0)).filter(Boolean);
  return `Questions ${nums[0]}–${nums[nums.length - 1]} refer to the data below`;
}

// "Questions 4–6 are based on this passage", in this test's numbering.
export function passageLabel(qs: { passage_id?: string | null }[], pid?: string | null) {
  if (!pid) return undefined;
  const nums = qs.map((x, i) => (x.passage_id === pid ? i + 1 : 0)).filter(Boolean);
  return nums.length > 1 ? `Questions ${nums[0]}–${nums[nums.length - 1]} are based on this passage` : `Question ${nums[0]} is based on this passage`;
}
