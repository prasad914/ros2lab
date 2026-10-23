#!/usr/bin/env bash
# Runs the Night-1 regression gate against the dev server and writes a summary.
# Usage: bash parity/scripts/tb3_v3/run_suites.sh <label> [suite ...]   (suites default to all)
# Raw logs: parity/browser_out/tb3_night1/<label>/ (gitignored); summary: docs/tb3/tests/<label>.txt
set -u
cd "$(git rev-parse --show-toplevel)"
LABEL=${1:?label}; shift || true
SUITES=${*:-"security lessons66 lessons45 ui-chrome ui-home ui-sim ui-portal ui-student ui-member ui-review ui-widths parity"}
export BASE=${BASE:-http://localhost:8000}
OUT=parity/browser_out/tb3_night1/$LABEL; mkdir -p "$OUT" docs/tb3/tests
SUM=docs/tb3/tests/$LABEL.txt
echo "# $LABEL  started $(date -Iseconds)  git $(git rev-parse --short HEAD)  BASE=$BASE" >> "$SUM"
T45="A6,R4,IN1,IN3,IN4,IN7,D2,D3,D4,D6,D7,D7b,D8,D9,D12,D13,F3,F4,F5,F6,F7,F8,F9,F10,F11,F12,F13,F14,F15,F16,F17,F18,F19,F20,N5,N7b,N8,N10,N17b,N18,N19,N20,N22,N22b,N24b"
count_ticks() { node -e 'const r=require(process.argv[1]);let y=0,n=0;for(const b of r)for(const t of b.tasks)(t.tick?y++:n++);console.log(`${y} of ${y+n} tasks ticked, ${r.length} blocks`)' "$PWD/$1"; }
for s in $SUITES; do
  t0=$(date +%s)
  case $s in
    security) node tools/security-check.mjs > "$OUT/$s.log" 2>&1; rc=$?; res="exit $rc: $(tail -1 "$OUT/$s.log")";;
    lessons66) node parity/scripts/lessons/site_lesson_check.mjs "$OUT/lessons66.json" > "$OUT/$s.log" 2>&1; rc=$?; res="exit $rc: $(count_ticks "$OUT/lessons66.json")";;
    lessons45) node parity/scripts/lessons/site_lesson_check.mjs "$OUT/lessons45.json" "$T45" > "$OUT/$s.log" 2>&1; rc=$?; res="exit $rc: $(count_ticks "$OUT/lessons45.json")";;
    ui-*) node tests/$s.mjs > "$OUT/$s.log" 2>&1; rc=$?; res="exit $rc: $(grep -ciE 'FAIL' "$OUT/$s.log") FAIL-lines; last: $(tail -1 "$OUT/$s.log" | cut -c1-200)";;
    parity) npx playwright test -c parity/playwright.config.ts --reporter=list > "$OUT/$s.log" 2>&1; rc=$?; res="exit $rc: $(grep -E '^\s+[0-9]+ (passed|failed|flaky|skipped|did not run)' "$OUT/$s.log" | tr -s ' ' | tr '\n' ';')";;
    *) res="unknown suite";;
  esac
  echo "$s | $res | $(( $(date +%s) - t0 )) s" | tee -a "$SUM"
done
# the parity suite rewrites tracked screenshots / outputs; put them back
git checkout -- parity/reports/screenshots 2>/dev/null || true
echo "# $LABEL  finished $(date -Iseconds)" >> "$SUM"
