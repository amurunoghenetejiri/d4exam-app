#!/bin/bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
cp scripts/calc_feature/ExamCalculator.tsx src/components/cbt/ExamCalculator.tsx
mkdir -p supabase/migrations
cp scripts/calc_feature/20260916160000_exam_calculator.sql supabase/migrations/20260916160000_exam_calculator.sql
patch -p1 < scripts/calc_feature/exam-security.patch
patch -p1 < scripts/calc_feature/back.patch
patch -p1 < scripts/calc_feature/teacher.patch
patch -p1 < scripts/calc_feature/cbt.patch
echo "Calculator feature applied"
