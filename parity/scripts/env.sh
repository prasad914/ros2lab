#!/usr/bin/env bash
# Shared environment for every parity script. Source it, do not run it.
# Sources ROS 2 Jazzy, then optional overlays: TB3_WS (source-built TurtleBot3), ROBOTS_WS (other robots).
# ROS setup files read variables that are normally unset, so strict mode (set -u) is paused while sourcing them.
_parity_had_u=0
case $- in *u*) _parity_had_u=1; set +u ;; esac

if [ -f /opt/ros/jazzy/setup.bash ]; then
  # shellcheck disable=SC1091
  source /opt/ros/jazzy/setup.bash
else
  echo "MISSING: /opt/ros/jazzy (ROS 2 Jazzy not installed)" >&2
fi
for ws in "${TB3_WS:-}" "${ROBOTS_WS:-}"; do
  if [ -n "$ws" ] && [ -f "$ws/install/setup.bash" ]; then
    # shellcheck disable=SC1090
    source "$ws/install/setup.bash"
  fi
done

[ "$_parity_had_u" = 1 ] && set -u
unset _parity_had_u

# The reference is Jazzy's default RMW, Fast DDS (rmw_fastrtps_cpp), like a fresh Ubuntu install, the site's default and
# every fixture before 2026-10-23. This PC's ~/.bashrc exports RMW_IMPLEMENTATION=rmw_cyclonedds_cpp, under which
# `ros2 topic info -v` reports other QoS for some endpoints (Night 2 finding, parity/fixtures/tb3_jazzy_v3/README.md).
# REF_RMW=<rmw> overrides it on purpose.
export RMW_IMPLEMENTATION=${REF_RMW:-rmw_fastrtps_cpp}

# Run from the repo root so parity/ paths resolve.
PARITY_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$PARITY_ROOT" || exit 1
export PARITY_ROOT
