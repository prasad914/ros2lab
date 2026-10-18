# Overnight robots run (P2b phase B, P2c, M1) – 2026-10-18, unattended

Branch `robots-p2b` from parity-fixes b80c0e4. Domains: P2b 46/ref46, P2c 47/ref47, M1 48/ref48. Decisions per robot
below; nothing in public/ is touched.

## Start
- Instructor's robots_sudo.sh steps recorded and checked in `parity/robots/P2B_PHASE_A.md`.

## ur5e – OFFICIAL-JAZZY (verified)
- Source: apt `ros-jazzy-ur-simulation-gz` 2.5.0-1noble.20261006.043651 (`parity/fixtures/ur5e/sim/run_info.txt`).
- Decision: `gazebo_gui:=false` (the launch file then starts `gz sim -s`, server only) and `launch_rviz:=false`.
- Evidence `parity/fixtures/ur5e/install_check/`: both controllers active; 21 topics; FollowJointTrajectory on
  scaled_joint_trajectory_controller moved shoulder_pan_joint 0.000000 -> 0.300000 rad, error_code 0.
