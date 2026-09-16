#!/bin/bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import base64, pathlib, re

def restore(prefix: str, dest: str):
    root = pathlib.Path("scripts/calc_feature")
    parts = list(root.glob(f"{prefix}.b64.[0-9]*"))
    if not parts:
        raise SystemExit(f"missing {prefix} b64 parts")
    def key(p):
        m = re.search(r"\.b64\.(\d+)$", p.name)
        return int(m.group(1)) if m else 0
    parts = sorted(parts, key=key)
    b64 = "".join(p.read_text().strip() for p in parts)
    path = pathlib.Path(dest)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(base64.b64decode(b64))
    print("restored", dest, path.stat().st_size)

restore("ExamCalculator", "src/components/cbt/ExamCalculator.tsx")
restore("exam_security", "src/lib/exam-security.ts")
restore("backButton", "src/native/backButton.ts")
restore("teacher", "src/routes/teacher.examinations.tsx")
restore("cbt", "src/components/cbt/CbtExamSession.impl.tsx")
print("all calculator sources restored")
PY
mkdir -p supabase/migrations
cp scripts/calc_feature/20260916160000_exam_calculator.sql supabase/migrations/ 2>/dev/null || true
echo "Calculator feature applied"
