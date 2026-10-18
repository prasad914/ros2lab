#!/usr/bin/env bash
# M1 MoveIt 2 ground truth for one arm whose MoveIt launch is parity/robots/<arm>/scenarios/<scenario>.sh:
# start (start_reference.sh), wait for /move_action, capture lists / TF / controllers / move_group params, copy the
# MoveIt config files of <moveit_pkg> to parity/fixtures/_installed/<moveit_pkg>/ with the package version, run
# moveit_capture.py, stop, and check the domain is empty before start and after stop.
# Usage: run_moveit_m1.sh <arm> <scenario> <domain> <partition> <moveit_pkg> <group> <ee_link> <controller> [capture args]
# env CM=<controller manager> (default /controller_manager) is used for list_controllers.
# ROS_DOMAIN_ID is set only on the ROS commands, never exported in this shell (stop_reference.sh would find it).
set -u
ARM=$1 SCEN=$2 D=$3 P=$4 PKG=$5 GROUP=$6 EE=$7 CTRL=$8; shift 8
cd "$(dirname "$0")/../.." || exit 1
OUT=parity/fixtures/$ARM/moveit; LOGF=parity/fixtures/$ARM/$SCEN/logs/$SCEN.log
source parity/scripts/domain_procs.sh
say() { echo "[$(date +%T)] $*"; }
[ -z "$(domain_pids $D)" ] || { say "domain $D not empty before start"; exit 9; }
mkdir -p "$OUT"
bash parity/scripts/start_reference.sh "$ARM" "$SCEN" "$D" "$P" || exit 1
R() { ( source parity/scripts/env.sh >/dev/null; export ROS_DOMAIN_ID=$D GZ_PARTITION=$P; "$@" ); }
ok=0
for i in $(seq 1 100); do
  if R timeout 10 ros2 action list 2>/dev/null | grep -qx /move_action; then ok=1; break; fi
  sleep 3
done
say "/move_action present: $ok"
# move_group answers its parameter service only once it has loaded; wait until the dump has parameters (max 300 s)
for i in $(seq 1 30); do
  R timeout 60 ros2 param dump /move_group > "$OUT/move_group_params.yaml" 2>&1
  grep -q "ros__parameters: {}" "$OUT/move_group_params.yaml" || break
  sleep 10
done
say "move_group params: $(grep -c '' "$OUT/move_group_params.yaml") lines"
{ echo "# ros2 param list /move_group --no-daemon --spin-time 5"; R timeout 60 ros2 param list /move_group --no-daemon --spin-time 5; } > "$OUT/move_group_param_list.txt" 2>&1
{ echo "# ros2 node list --no-daemon --spin-time 5"; R timeout 30 ros2 node list --no-daemon --spin-time 5; } > "$OUT/node_list.txt" 2>&1
{ echo "# ros2 topic list -t --no-daemon --spin-time 5"; R timeout 30 ros2 topic list -t --no-daemon --spin-time 5; } > "$OUT/topic_list.txt" 2>&1
{ echo "# ros2 action list -t (no --no-daemon option)"; R timeout 30 ros2 action list -t; } > "$OUT/action_list.txt" 2>&1
{ echo "# ros2 service list -t --no-daemon --spin-time 5"; R timeout 30 ros2 service list -t --no-daemon --spin-time 5; } > "$OUT/service_list.txt" 2>&1
{ echo "# ros2 control list_controllers ${CM:+-c $CM}"; R timeout 30 ros2 control list_controllers ${CM:+-c $CM}; } > "$OUT/controllers.txt" 2>&1
( cd "$OUT" && R timeout -k 2s 20 ros2 run tf2_tools view_frames > view_frames.log 2>&1 )
# installed MoveIt config files (srdf, kinematics, joint_limits, ompl, controllers) with the package version
SHARE=$(R ros2 pkg prefix "$PKG" 2>/dev/null)/share/$PKG
DEST=parity/fixtures/_installed/$PKG; mkdir -p "$DEST"
{ echo "package: $PKG"; echo "share: $SHARE"
  echo "version (package.xml): $(grep -o '<version>[^<]*' "$SHARE/package.xml" | sed 's/<version>//')"
  echo "dpkg: $(dpkg-query -W -f='${Version}' "ros-jazzy-$(echo "$PKG" | tr _ -)" 2>/dev/null || echo 'not an apt package')"
  src=$(readlink -f "$SHARE/package.xml"); d=$(dirname "$src")
  echo "source: $src"; echo "git: $(git -C "$d" remote get-url origin 2>/dev/null) $(git -C "$d" rev-parse HEAD 2>/dev/null)"
} > "$DEST/SOURCE.txt"
find -L "$SHARE/config" "$SHARE/srdf" "$SHARE/urdf" -maxdepth 2 -type f \( -name '*.srdf' -o -name '*.srdf.xacro' -o -name 'kinematics*.yaml' -o -name 'joint_limits*.yaml' -o -name 'ompl*.yaml' -o -name '*controllers*.yaml' -o -name 'pilz*.yaml' \) 2>/dev/null | while read -r f; do
  rel=${f#"$SHARE"/}; mkdir -p "$DEST/$(dirname "$rel")"; cp -L "$f" "$DEST/$rel"; echo "copied $rel" >> "$DEST/SOURCE.txt"
done
say "moveit_capture.py"
R timeout 1800 python3 parity/scripts/moveit_capture.py --out "$OUT" --group "$GROUP" --ee-link "$EE" --controller "$CTRL" --log "$PWD/$LOGF" "$@" > "$OUT/capture.txt" 2>&1
say "capture exit $?"
[ "parity/fixtures/$ARM/$SCEN" = "$OUT" ] || cp parity/fixtures/$ARM/$SCEN/run_info.txt "$OUT/run_info.txt"
env -u ROS_DOMAIN_ID bash parity/scripts/stop_reference.sh "$D"
[ -z "$(domain_pids $D)" ] && say "domain $D empty after stop" || say "domain $D NOT empty after stop"
