#!/bin/bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# Prefer plain source copies when present
for pair in \
  "scripts/calc_feature/ExamCalculator.tsx:src/components/cbt/ExamCalculator.tsx" \
  "scripts/calc_feature/CbtExamSession.impl.tsx:src/components/cbt/CbtExamSession.impl.tsx" \
  "scripts/calc_feature/teacher.examinations.tsx:src/routes/teacher.examinations.tsx" \
  "scripts/calc_feature/exam-security.ts:src/lib/exam-security.ts" \
  "scripts/calc_feature/backButton.ts:src/native/backButton.ts"
do
  src="${pair%%:*}"
  dest="${pair##*:}"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "copied $dest ($(wc -c < "$dest") bytes)"
  fi
done
mkdir -p supabase/migrations
cp scripts/calc_feature/20260916160000_exam_calculator.sql supabase/migrations/ 2>/dev/null || true
echo "Calculator feature applied"
