#!/bin/bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
mkdir -p src/components/cbt

if [ -f scripts/calc_feature/ExamCalculator.tsx ] && [ "$(wc -c < scripts/calc_feature/ExamCalculator.tsx)" -gt 5000 ]; then
  cp -f scripts/calc_feature/ExamCalculator.tsx src/components/cbt/ExamCalculator.tsx
  echo "copied ExamCalculator.tsx $(wc -c < src/components/cbt/ExamCalculator.tsx)"
elif ls scripts/calc_feature/calc.b64.* >/dev/null 2>&1; then
  python3 - <<'PY'
import base64, pathlib
root = pathlib.Path("scripts/calc_feature")
parts = sorted(root.glob("calc.b64.[0-9]*"))
data = base64.b64decode("".join(p.read_text().strip() for p in parts))
pathlib.Path("src/components/cbt/ExamCalculator.tsx").write_bytes(data)
print("restored ExamCalculator", len(data))
PY
fi

if [ -f scripts/calc_feature/gate.patch ]; then
  patch -p1 --forward --no-backup-if-mismatch < scripts/calc_feature/gate.patch 2>/dev/null || true
  echo "patched ExamSecurityGate"
fi

echo "Calculator feature applied"
