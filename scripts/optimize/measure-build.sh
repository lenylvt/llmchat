#!/usr/bin/env bash
# Emits JSON metrics for ce-optimize groot-build-latency.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/apps/web"

START=$(python3 -c 'import time; print(time.time())')
if bun run build >/tmp/groot-measure-build.log 2>&1; then
  BUILD_PASSED=1
else
  BUILD_PASSED=0
fi
END=$(python3 -c 'import time; print(time.time())')
BUILD_SECONDS=$(python3 -c "print(round($END - $START, 2))")

cd "$ROOT"
if bun test packages/ai packages/shared >/tmp/groot-measure-test.log 2>&1; then
  TEST_PASS_RATE=1.0
else
  TEST_PASS_RATE=0.0
fi

ARTIFACT_MB=$(python3 -c "
import os
total = 0
for dirpath, _, files in os.walk('$ROOT/apps/web/dist'):
    for f in files:
        total += os.path.getsize(os.path.join(dirpath, f))
print(round(total / (1024 * 1024), 2))
" 2>/dev/null || echo 0)

python3 -c "
import json
print(json.dumps({
  'build_seconds': $BUILD_SECONDS,
  'build_passed': $BUILD_PASSED,
  'test_pass_rate': $TEST_PASS_RATE,
  'artifact_size_mb': $ARTIFACT_MB,
}))
"
