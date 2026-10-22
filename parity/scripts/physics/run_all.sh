#!/usr/bin/env bash
# Every physics baseline case on REAL Gazebo Harmonic, domain 50, one simulation at a time.
set -u
cd "$(dirname "$0")/../../.." || exit 1
P=parity/scripts/physics
python3 $P/gen_worlds.py
for c in drop drop_typebullet restitution_ground1.0 restitution_ground0.5 collision pendulum noinertial joint_limits \
         slide_mu0.01 slide_mu0.1 slide_mu0.5 slide_mu1.0 slide_aniso slide_combine incline_10 incline_15 incline_30 incline_45 \
         tb3_lin tb3_lin_noacc tb3_ang tb3_ang_noacc tb3_push tb3_sensors_empty tb3_sensors_wall; do
  python3 $P/run_case.py $c --runs 3
  bash parity/scripts/stop_reference.sh 50 >/dev/null
done
python3 $P/run_case.py determinism --runs 10
bash $P/tb3_ros_side.sh
bash $P/ur5e_case.sh traj 3
for r in 100 1000; do for g in 0.1 0.5 1.0; do bash $P/ur5e_case.sh step $r $g 3; done; done
bash parity/scripts/stop_reference.sh 50
python3 $P/analyze.py > parity/fixtures/physics/analyze_out.txt 2>&1
echo PHYSICS_ALL_DONE
