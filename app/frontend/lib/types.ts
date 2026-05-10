export interface Option {
  label: string;
  text: string;
}

export interface Question {
  _id: string;
  question_code: string;
  section: 'VARC' | 'DILR' | 'QA';
  question_type: 'MCQ' | 'TITA';
  topic: string;
  subtopic: string;
  set_id: string | null;
  set_position: number | null;
  context_passage: string | null;
  question_text: string;
  options: Option[] | null;
  correct_answer: string;
  marks_correct: number;
  marks_incorrect: number;
  explanation: string;
  difficulty: string;
  question_number: number;
  tags: string[];
  is_image_based: boolean;
  image_url: string | null;
}

export type QuestionStatus = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'answered-marked';

export interface QuestionState {
  status: QuestionStatus;
  answer: string | null; // option label for MCQ, numeric string for TITA
}

export type SectionName = 'VARC' | 'DILR' | 'QA';

export interface SectionData {
  questions: Question[];
  timeLeft: number; // seconds
  submitted: boolean;
}

export interface ExamState {
  paperNumber: string;
  sections: Record<SectionName, SectionData>;
  questionStates: Record<string, QuestionState>; // keyed by question _id
  currentSection: SectionName;
  currentQuestionIndex: number; // index within current section
  started: boolean;
  finished: boolean;
}
