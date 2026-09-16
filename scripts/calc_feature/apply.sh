#!/bin/bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
mkdir -p src/components/cbt src/lib src/native src/routes supabase/migrations

# ExamCalculator: full file or assemble from parts
if [ -f scripts/calc_feature/ExamCalculator.tsx ] && [ "$(wc -c < scripts/calc_feature/ExamCalculator.tsx)" -gt 5000 ]; then
  cp -f scripts/calc_feature/ExamCalculator.tsx src/components/cbt/ExamCalculator.tsx
  echo "copied ExamCalculator.tsx"
elif ls scripts/calc_feature/ExamCalculator.part*.txt >/dev/null 2>&1; then
  cat scripts/calc_feature/ExamCalculator.part*.txt > src/components/cbt/ExamCalculator.tsx
  echo "assembled ExamCalculator.tsx $(wc -c < src/components/cbt/ExamCalculator.tsx)"
fi

# ExamSecurityGate: full or parts
if [ -f scripts/calc_feature/ExamSecurityGate.tsx ] && [ "$(wc -c < scripts/calc_feature/ExamSecurityGate.tsx)" -gt 5000 ]; then
  cp -f scripts/calc_feature/ExamSecurityGate.tsx src/components/cbt/ExamSecurityGate.tsx
  echo "copied ExamSecurityGate.tsx"
elif ls scripts/calc_feature/gate.part*.txt >/dev/null 2>&1; then
  cat scripts/calc_feature/gate.part*.txt > src/components/cbt/ExamSecurityGate.tsx
  echo "assembled ExamSecurityGate.tsx $(wc -c < src/components/cbt/ExamSecurityGate.tsx)"
fi

[ -f scripts/calc_feature/exam-security.ts ] && [ "$(wc -c < scripts/calc_feature/exam-security.ts)" -gt 1000 ] && \
  cp -f scripts/calc_feature/exam-security.ts src/lib/exam-security.ts && echo "exam-security.ts" || true

[ -f scripts/calc_feature/backButton.ts ] && [ "$(wc -c < scripts/calc_feature/backButton.ts)" -gt 1000 ] && \
  cp -f scripts/calc_feature/backButton.ts src/native/backButton.ts && echo "backButton.ts" || true

if [ -f scripts/calc_feature/teacher.patch ]; then
  patch -p1 --forward --no-backup-if-mismatch < scripts/calc_feature/teacher.patch 2>/dev/null || true
fi
if [ -f scripts/calc_feature/cbt.patch ]; then
  patch -p1 --forward --no-backup-if-mismatch < scripts/calc_feature/cbt.patch 2>/dev/null || true
fi

if [ -f scripts/calc_feature/20260916160000_exam_calculator.sql ]; then
  cp -f scripts/calc_feature/20260916160000_exam_calculator.sql supabase/migrations/ || true
fi
echo "Calculator feature applied"
