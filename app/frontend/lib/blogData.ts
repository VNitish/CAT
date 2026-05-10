export interface BlogPost {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  readTime: string;
  tag: string;
  body: { type: 'p' | 'h2' | 'ul'; content: string | string[] }[];
}

export const POSTS: BlogPost[] = [
  {
    slug: 'cat-2025-paper-analysis',
    title: 'CAT 2025 Paper Analysis: What Changed This Year',
    subtitle: 'A section-by-section breakdown of CAT 2025 — difficulty shifts, question types, and what it signals for 2026 aspirants.',
    date: 'Nov 28, 2025',
    readTime: '6 min read',
    tag: 'Analysis',
    body: [
      { type: 'p', content: 'CAT 2025 was administered across three slots in late November, with 66 questions, a 120-minute window, and section-level time locking. On paper, it followed the format established since 2021. In practice, it delivered a few sharp surprises — particularly in VARC and a single devastating DILR set that separated the 95th from the 99th percentile.' },
      { type: 'h2', content: 'VARC: Longer Passages, Fewer Traps' },
      { type: 'p', content: 'The Verbal Ability and Reading Comprehension section had 24 questions across five passages. The passages themselves were longer than 2024 — averaging 600–700 words each — drawn from philosophy of science, economic history, and literary criticism. The questions, however, were less inferential than last year. Most RC questions were either directly stated or one logical step removed from the text. This rewarded careful reading over clever guessing.' },
      { type: 'p', content: 'Verbal Ability had just four questions, all Para Jumbles. There were no odd-sentence-out questions, no summary questions. Students who had over-indexed on VA variety were caught off guard. Those who drilled RC deeply came out ahead.' },
      { type: 'h2', content: 'DILR: Three Manageable Sets, One Wrecking Ball' },
      { type: 'p', content: 'Data Interpretation and Logical Reasoning had four sets of five questions each. Three sets were well within reach for a prepared aspirant: a bar chart comparison with straightforward arithmetic, a seating arrangement with clean constraints, and a scheduling problem that yielded quickly once the grid was set up. The fourth set — a multi-variable network routing problem — was a different beast entirely. It required tracking five interdependent rules simultaneously with no clean visual representation. Students who spent more than four minutes on it without progress generally did not recover their section timing.' },
      { type: 'p', content: 'The lesson is not new but it was stated emphatically in 2025: set triage is not optional. The ability to identify an unsolvable set within three minutes and exit cleanly is a trained skill, not an instinct. It needs to be practised explicitly.' },
      { type: 'h2', content: 'QA: Arithmetic-Heavy, Formula-Light' },
      { type: 'p', content: 'Quantitative Aptitude leaned hard into arithmetic fundamentals. Ratio and proportion, time-speed-distance, percentages, and profit-loss together accounted for over 40% of questions. Number theory appeared in moderate difficulty — two questions on remainders, one on factors. Geometry was present but not dominant. Algebra and modern maths were significantly underrepresented compared to 2024.' },
      { type: 'p', content: 'The distribution favoured students who had built strong calculation speed over students who had memorised advanced formulas. Several questions that appeared complex dissolved into one-step arithmetic once the setup was understood. The section rewarded clarity of thought over breadth of preparation.' },
      { type: 'h2', content: 'What 2026 Aspirants Should Take Away' },
      { type: 'ul', content: [
        'RC is the core of VARC — five passages is the new normal, VA questions are supplementary',
        'Practice DILR set triage explicitly: 3 minutes per set, then decide stay or abandon',
        'Arithmetic fundamentals are non-negotiable in QA — they show up every year in volume',
        'Attempt real past papers under full exam conditions — the section lock changes decision-making in ways practice sets cannot replicate',
        'CAT 2025 Slot 2 is considered the fairest difficulty representation — start your mock analysis there',
      ]},
    ],
  },
  {
    slug: 'dilr-set-selection-strategy',
    title: 'The DILR Set Selection Strategy That Toppers Use',
    subtitle: 'The gap between 90th and 99th percentile in DILR is almost never ability. It is almost always set selection.',
    date: 'Oct 8, 2025',
    readTime: '5 min read',
    tag: 'DILR',
    body: [
      { type: 'p', content: 'Every CAT topper will tell you the same thing about DILR: they did not necessarily solve more questions than you. They solved fewer questions, faster, with higher accuracy — because they picked better sets. The section gives you four sets and forty minutes. The student who picks three approachable sets and completes them cleanly will outscore the student who gets drawn into a difficult set and spends twenty-five minutes on it.' },
      { type: 'p', content: 'This sounds obvious. It is not easy. Under exam pressure, sunk-cost thinking takes over. You have spent eight minutes on a set. Leaving now feels like waste. But the eight minutes are gone regardless — the only question is whether you lose eight more. Developing the discipline to cut your losses is the single highest-ROI DILR skill, and it must be practised until it is automatic.' },
      { type: 'h2', content: 'The Three-Minute Rule' },
      { type: 'p', content: 'Give every set exactly three minutes of initial investment. Read the setup carefully, understand the constraints, and attempt the first question. If by the end of three minutes you do not have a clear path to answering at least two or three questions in the set, mark it in your question palette and move to the next set. No exceptions.' },
      { type: 'p', content: 'Three minutes is not arbitrary. It is enough time to understand any set that is genuinely solvable. Hard sets do not reveal themselves slowly — they remain opaque. If a set does not open up within three minutes, it will not open up in ten. The rare exception where the penny drops at minute seven is not worth banking on.' },
      { type: 'h2', content: 'What Makes a Set Approachable' },
      { type: 'ul', content: [
        'A clean visual structure emerges immediately — a grid, a timeline, a seating circle',
        'Constraints are independent or nearly so — each rule eliminates options without creating new dependencies',
        'The first question is answerable without resolving the entire setup',
        'Data is presented cleanly — one table, one chart, not a mix of both with footnotes',
      ]},
      { type: 'h2', content: 'What Makes a Set a Trap' },
      { type: 'ul', content: [
        'More than three independent variables that all interact with each other',
        'Constraints that only apply conditionally — "if X then Y unless Z"',
        'A setup that seems simple but has a hidden ambiguity that surfaces at question three',
        'A data-heavy presentation where the relevant data is buried and most rows are distractors',
      ]},
      { type: 'h2', content: 'How to Build the Skill' },
      { type: 'p', content: 'Take any four DILR sets from a past CAT paper. Without attempting them, spend thirty seconds reading each setup and rank them 1 to 4 by how approachable they seem. Write down your ranking. Then solve them in order and record how long each one actually took. After twenty sessions of this exercise, compare your pre-attempt rankings to actual time. Most students find their accuracy crosses 80% within a month — which means they have built genuine set-triage instinct, not just theory.' },
      { type: 'p', content: 'The other half of the skill is emotional. You need to practise leaving a set mid-attempt and returning to it later without anxiety. Simulate this in your mocks. Set a hard rule: no set gets more than twelve minutes on a first pass. When you return to skipped sets with fresh eyes at the end, you will often find they are easier than they seemed — or confirm they were unsolvable and feel no regret.' },
      { type: 'h2', content: 'The Practical Protocol for Exam Day' },
      { type: 'ul', content: [
        'Minutes 0–12: Spend 3 minutes on each of the four sets. Rank them. Start solving in order of approachability.',
        'Minutes 12–32: Complete your top two sets fully. If a set stalls, exit immediately.',
        'Minutes 32–40: Return to remaining sets. Solve what you can. Guess strategically on MCQs in sets you cannot fully crack.',
        'Never attempt TITA questions in a set you have not substantially understood — wrong guesses cost nothing, but wasted time costs everything.',
      ]},
    ],
  },
  {
    slug: 'how-to-score-99-percentile-cat',
    title: 'How to Score 99 Percentile in CAT: A Realistic Roadmap',
    subtitle: 'Not motivational advice. A structured, honest breakdown of what separates 99th percentile students from 95th percentile students — and how to close the gap.',
    date: 'Sep 5, 2025',
    readTime: '7 min read',
    tag: 'Strategy',
    body: [
      { type: 'p', content: 'The 99th percentile in CAT requires roughly 110 to 120 raw marks out of 198. That translates to answering about 55 to 60% of questions correctly with near-zero negative marks. It sounds achievable. The difficulty is that at the 99th percentile level, every point you leave on the table is a point someone else is picking up. The exam is ruthlessly competitive in that final band.' },
      { type: 'p', content: 'The students who consistently score in this range are not necessarily more intelligent than those at the 95th percentile. They make fewer errors under pressure, they manage their time with precision, and they have practised so extensively with real past papers that the exam itself holds no surprises. That combination — accuracy, time management, and familiarity — is reproducible with the right preparation structure.' },
      { type: 'h2', content: 'Phase 1: Build the Foundation (Months 1–3)' },
      { type: 'p', content: 'The first phase is entirely about concept coverage and calculation speed. Every arithmetic topic must be done to the point of automaticity — not just understood, but drilled until the approach is reflexive. The same applies to core logical reasoning frameworks. This phase is boring by design. Students who skip it and jump to mock tests plateau early.' },
      { type: 'ul', content: [
        'Complete all arithmetic topics: ratios, percentages, time-speed-distance, time-work, profit-loss',
        'Build a reading habit: one editorial or long-form article per day, summarised in two sentences',
        'Work through basic DILR set types: seating arrangements, scheduling, bar charts, line graphs',
        'Target calculation speed: you should be able to do two-digit multiplication mentally within three seconds',
      ]},
      { type: 'h2', content: 'Phase 2: Apply and Identify Gaps (Months 4–6)' },
      { type: 'p', content: 'In this phase, you begin attempting full sections under timed conditions. Not full papers yet — sections. The goal is to identify exactly where your errors are coming from. Most students at this stage have one or two specific weaknesses that account for a disproportionate share of their wrong answers. Find them and eliminate them before moving to mocks.' },
      { type: 'p', content: 'A common mistake in this phase is treating wrong answers as random bad luck. They are almost never random. Analyse every wrong answer: was it a concept gap, a misread, a calculation error, or a time-pressure mistake? Each has a different fix. Concept gaps need re-study. Misreads need slowing down during reading. Calculation errors need drill. Time-pressure mistakes need mock practice.' },
      { type: 'h2', content: 'Phase 3: Mock Exam Saturation (Months 7–9)' },
      { type: 'p', content: 'This is the most important phase and the most misused one. Mocks are not practice tests — they are diagnostic tools. The exam itself takes two hours. The review should take four. Every question you got wrong, every question you got right by luck, every question you skipped — each one has something to teach you. Students who use mocks as practice and move on after checking their score are wasting the most valuable resource in their preparation.' },
      { type: 'ul', content: [
        'Attempt at least 20 full-length mocks before the exam',
        'Spend more time reviewing than attempting — minimum 1:2 ratio (exam time : review time)',
        'Track your error type distribution across mocks — it should shift as you improve',
        'Attempt real CAT past papers, not just mock company papers — the real papers have a quality and precision that most mock companies cannot replicate',
        'After each mock, write down three specific things you will do differently in the next one',
      ]},
      { type: 'h2', content: 'The Accuracy Trap' },
      { type: 'p', content: 'One of the most common failure modes near the 99th percentile is over-attempting. Students who are capable of 99th percentile scores often score in the 95th because they attempt 55 questions with 75% accuracy instead of 42 questions with 95% accuracy. The mathematics strongly favour the latter. A wrong MCQ answer costs you one mark in addition to not gaining three — a net swing of four marks. At the margin of 99th percentile, four marks is the difference between IIM-A shortlist and not.' },
      { type: 'p', content: 'Develop a clear threshold for attempting versus skipping. If your confidence in an answer is below roughly 70%, the expected value of attempting it is negative given the -1 penalty. Calibrate this threshold through mock analysis, not intuition. Most students systematically overestimate their accuracy on questions they attempt.' },
      { type: 'h2', content: 'The Last Four Weeks' },
      { type: 'ul', content: [
        'Stop learning new topics — reinforce what you know',
        'Attempt one full mock every three days, review thoroughly',
        'Re-attempt questions you got wrong in earlier mocks — did you actually fix the gap or just remember the answer?',
        'Sleep and physical routine are not optional — cognitive performance degrades measurably with sleep debt',
        'On exam day, your only job is to execute the strategy you have already built. Trust the preparation.',
      ]},
    ],
  },
];
