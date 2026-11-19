'use client';
import { useParams } from 'next/navigation';
import GreExam from '../../Exam';

// Verbal tests are stored as 101-122 and shown as 1-22.
export default function GreVerbalExamPage() {
  return <GreExam testNo={100 + Number(useParams().testNo)} />;
}
