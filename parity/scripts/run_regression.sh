#!/usr/bin/env bash
# Regression gate for step G fixes: every parity Playwright spec outside parity/e2e/fixtures, the parity unit tests,
# the security check and the site's own TurtleBot3 tests. Needs the site on 127.0.0.1:8000 (npm run dev) and on
# localhost:8080 (the site's tests). Usage: run_regression.sh <out_dir>   -> <out_dir>/<suite>.log and summary.txt
set -u
OUT=${1:?out dir}; mkdir -p "$OUT"; cd "$(dirname "$0")/../.."
run() { local name=$1; shift; "$@" > "$OUT/$name.log" 2>&1; echo "$name exit $?" >> "$OUT/summary.txt"; }
: > "$OUT/summary.txt"
run parity_e2e timeout 2400 npx playwright test -c parity/playwright.config.ts --grep-invert fixtures parity/e2e
run vitest npx --yes vitest@3.2.4 run parity/unit
run security node tools/security-check.mjs
run real-tb3 timeout 900 node tests/real-tb3.mjs
run real-tb3-nav timeout 900 node tests/real-tb3-nav.mjs
ONLY=burger,waffle,slam,nav,fake run real-mobile-audit timeout 1800 node tests/real-mobile-audit.mjs
for f in parity_e2e vitest; do grep -hE "^\s+[0-9]+ (passed|failed)|Tests\s+[0-9]+" "$OUT/$f.log" | sed "s/^/$f: /" >> "$OUT/summary.txt"; done
for f in real-tb3 real-tb3-nav real-mobile-audit; do grep -hcE "^FAIL" "$OUT/$f.log" | sed "s/^/$f FAIL lines: /" >> "$OUT/summary.txt"; done
cat "$OUT/summary.txt"
