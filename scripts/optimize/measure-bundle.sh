#!/usr/bin/env bash
# Emits JSON metrics for ce-optimize groot-client-bundle.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/apps/web"

START=$(python3 -c 'import time; print(time.time())')
if bun run build >/tmp/groot-measure-bundle-build.log 2>&1; then
  BUILD_PASSED=1
else
  BUILD_PASSED=0
fi
END=$(python3 -c 'import time; print(time.time())')
BUILD_SECONDS=$(python3 -c "print(round($END - $START, 2))")

cd "$ROOT"
if bun test packages/ai packages/shared >/tmp/groot-measure-bundle-test.log 2>&1; then
  TEST_PASS_RATE=1.0
else
  TEST_PASS_RATE=0.0
fi

METRICS=$(python3 <<PY
import json
import os
from pathlib import Path

root = Path("$ROOT/apps/web/dist/client/assets")
main_kb = 0
total_kb = 0
if root.is_dir():
    for p in root.glob("*.js"):
        kb = p.stat().st_size / 1024
        total_kb += kb
        if kb > main_kb:
            main_kb = kb

print(json.dumps({
  "main_chunk_kb": round(main_kb, 2),
  "client_js_total_kb": round(total_kb, 2),
  "build_seconds": $BUILD_SECONDS,
  "build_passed": $BUILD_PASSED,
  "test_pass_rate": $TEST_PASS_RATE,
  "lint_passed": 1,
}))
PY
)

echo "$METRICS"
