#!/bin/bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
mkdir -p src/components/cbt src/lib src/native src/routes supabase/migrations

python3 - <<'PY'
import base64, pathlib
root = pathlib.Path("scripts/calc_feature")

parts = sorted(root.glob("calc.b64.[0-9]*"))
if parts:
    data = base64.b64decode("".join(p.read_text().strip() for p in parts))
    pathlib.Path("src/components/cbt/ExamCalculator.tsx").write_bytes(data)
    print("restored ExamCalculator", len(data))
elif (root / "ExamCalculator.tsx").exists() and (root / "ExamCalculator.tsx").stat().st_size > 5000:
    pathlib.Path("src/components/cbt/ExamCalculator.tsx").write_bytes((root / "ExamCalculator.tsx").read_bytes())
    print("copied ExamCalculator")

parts = sorted(root.glob("gate.b64.[0-9]*"))
if parts:
    data = base64.b64decode("".join(p.read_text().strip() for p in parts))
    pathlib.Path("src/components/cbt/ExamSecurityGate.tsx").write_bytes(data)
    print("restored ExamSecurityGate", len(data))
PY

if [ -f scripts/calc_feature/gate.patch ]; then
  patch -p1 --forward --no-backup-if-mismatch < scripts/calc_feature/gate.patch 2>/dev/null || true
  echo "patched gate"
fi

echo "Calculator feature applied"
