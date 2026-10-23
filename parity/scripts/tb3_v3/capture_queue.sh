#!/usr/bin/env bash
# Night 1 Part 2 queue: one real simulation at a time on domain 61, stop_reference between runs.
# Usage: capture_queue.sh "<robot>:<nav|world>:<mode> ..."   e.g. "tb3_burger:nav:pose tb3_waffle_pi:world:-"
cd "$(git rev-parse --show-toplevel)" || exit 1
for job in $1; do
  IFS=: read -r robot kind mode <<< "$job"
  bash parity/scripts/stop_reference.sh 61 > /dev/null 2>&1; bash parity/scripts/stop_reference.sh 61 | tail -1
  echo "=== $(date -Iseconds) $job"
  if [ "$kind" = nav ]; then timeout 1500 bash parity/scripts/tb3_v3/capture_nav.sh "$robot" 61 "$mode"
    [ "$mode" = nopose ] && python3 parity/scripts/tb3_v3/nopose_timing.py "parity/fixtures/tb3_jazzy_v3/$robot/nav_nopose" "ground-truth/tb3/$robot/nav_nopose" | tail -1
  else timeout 900 bash parity/scripts/tb3_v3/capture_world.sh "$robot" 61; fi
done
bash parity/scripts/stop_reference.sh 61 > /dev/null 2>&1; bash parity/scripts/stop_reference.sh 61 | tail -1
echo "=== queue done $(date -Iseconds)"
