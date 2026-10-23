#!/usr/bin/env bash
# Night 1, Part 3.1: TurtleBot3 motion cases on REAL Gazebo (this PC), domain 50, one simulation at a time.
# Re-runs the existing tb3_lin / tb3_ang / tb3_push cases (baseline captured with gz-sim 8.15 on another machine) and
# adds stop distance, no clamp above the teleop limits, driving into a wall, and the Waffle Pi.
# Output: parity/fixtures/tb3_jazzy_v3/physics/<case>/ (ros_case.py: recorded through ros_gz_bridge, because
# python3-gz-transport13 is not installed here); analysis: parity/compare/tb3_motion_fit.py
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
P=parity/scripts/physics
export PHYS_OUT=parity/fixtures/tb3_jazzy_v3/physics
python3 $P/gen_worlds.py > /dev/null
CASES=${*:-"tb3_lin tb3_ang tb3_push tb3_stop tb3_fast tb3_spin_fast tb3_wall tb3wp_lin tb3wp_ang tb3wp_stop"}
for c in $CASES; do
  bash parity/scripts/stop_reference.sh 50 > /dev/null 2>&1
  echo "=== $(date -Iseconds) $c"
  python3 parity/scripts/tb3_v3/ros_case.py "$c" --runs 3 --out "$PHYS_OUT" 2>&1 | tail -3
done
bash parity/scripts/stop_reference.sh 50 > /dev/null 2>&1; bash parity/scripts/stop_reference.sh 50 | tail -1
{ echo "# $(date -Iseconds) on $(hostname), git $(git rev-parse --short HEAD), gz sim $(gz sim --versions)"; echo "bash parity/scripts/tb3_v3/run_physics.sh $CASES"; } > $PHYS_OUT/runner.txt
echo "=== physics done"
