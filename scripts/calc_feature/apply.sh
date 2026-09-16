#!/bin/bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import base64, pathlib
parts = sorted(pathlib.Path("scripts/calc_feature").glob("ExamCalculator.b64.*"))
if not parts:
    raise SystemExit("missing ExamCalculator.b64.* parts")
b64 = "".join(p.read_text().strip() for p in parts)
pathlib.Path("src/components/cbt/ExamCalculator.tsx").write_bytes(base64.b64decode(b64))
print("wrote ExamCalculator.tsx", len(b64))
PY
mkdir -p supabase/migrations
cp scripts/calc_feature/20260916160000_exam_calculator.sql supabase/migrations/20260916160000_exam_calculator.sql 2>/dev/null || true
patch -p1 < scripts/calc_feature/exam-security.patch
patch -p1 < scripts/calc_feature/back.patch
patch -p1 < scripts/calc_feature/teacher.patch
patch -p1 < scripts/calc_feature/cbt.patch
echo "Calculator feature applied"
