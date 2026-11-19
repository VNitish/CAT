'use client';
import { useParams } from 'next/navigation';
import GreExam from '../Exam';

// Quant tests 1-30.
export default function GreQuantExamPage() {
  return <GreExam testNo={Number(useParams().testNo)} />;
}
