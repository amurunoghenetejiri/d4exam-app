#!/bin/bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
mkdir -p src/components/cbt src/lib src/native src/routes supabase/migrations

[ -f scripts/calc_feature/ExamCalculator.tsx ] && cp -f scripts/calc_feature/ExamCalculator.tsx src/components/cbt/ExamCalculator.tsx && echo "ExamCalculator.tsx"
[ -f scripts/calc_feature/exam-security.ts ] && cp -f scripts/calc_feature/exam-security.ts src/lib/exam-security.ts && echo "exam-security.ts"
[ -f scripts/calc_feature/backButton.ts ] && cp -f scripts/calc_feature/backButton.ts src/native/backButton.ts && echo "backButton.ts"

if [ -f scripts/calc_feature/teacher.examinations.tsx ] && [ "$(wc -c < scripts/calc_feature/teacher.examinations.tsx)" -gt 1000 ]; then
  cp -f scripts/calc_feature/teacher.examinations.tsx src/routes/teacher.examinations.tsx
  echo "copied teacher"
elif [ -f scripts/calc_feature/teacher.patch ]; then
  patch -p1 --forward --no-backup-if-mismatch < scripts/calc_feature/teacher.patch || true
  echo "patched teacher"
fi

if [ -f scripts/calc_feature/CbtExamSession.impl.tsx ] && [ "$(wc -c < scripts/calc_feature/CbtExamSession.impl.tsx)" -gt 1000 ]; then
  cp -f scripts/calc_feature/CbtExamSession.impl.tsx src/components/cbt/CbtExamSession.impl.tsx
  echo "copied cbt"
elif [ -f scripts/calc_feature/cbt.patch ]; then
  patch -p1 --forward --no-backup-if-mismatch < scripts/calc_feature/cbt.patch || true
  echo "patched cbt"
fi

if [ -f scripts/calc_feature/20260916160000_exam_calculator.sql ]; then
  cp -f scripts/calc_feature/20260916160000_exam_calculator.sql supabase/migrations/
fi
echo "Calculator feature applied"
