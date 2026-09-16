#!/bin/bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
cp -f scripts/calc_feature/ExamCalculator.tsx src/components/cbt/ExamCalculator.tsx
cp -f scripts/calc_feature/exam-security.ts src/lib/exam-security.ts
cp -f scripts/calc_feature/backButton.ts src/native/backButton.ts
cp -f scripts/calc_feature/teacher.examinations.tsx src/routes/teacher.examinations.tsx
cp -f scripts/calc_feature/CbtExamSession.impl.tsx src/components/cbt/CbtExamSession.impl.tsx
mkdir -p supabase/migrations
if [ -f scripts/calc_feature/20260916160000_exam_calculator.sql ]; then
  cp -f scripts/calc_feature/20260916160000_exam_calculator.sql supabase/migrations/
fi
echo "Calculator feature applied"
