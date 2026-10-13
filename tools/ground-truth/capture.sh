#!/usr/bin/env bash
# Records what REAL ROS 2 Jazzy does for each ground-truth scenario (tools/ground-truth/scenarios.txt), on
# Ubuntu 24.04 with ROS 2 Jazzy installed. The site side is tests/sim-capture.mjs; it writes the same file names.
#   bash tools/ground-truth/capture.sh                    every scenario  -> ground-truth/real/<id>/
#   bash tools/ground-truth/capture.sh tb3_burger_world   only these
# Each workspace is built once in $GT_WS/<ws> (default ~/ros2lab-gt) from its pinned <ws>.repos, with the Ubuntu
# steps in public/robots/ws/<ws>/workspace.json. Steps that need sudo (apt, rosdep init, udev) are not run: install
# missing packages yourself if a build fails (see <ws>/build.log). Then: node tools/ground-truth/compare.mjs
set -u
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
GT_WS=${GT_WS:-$HOME/ros2lab-gt}
OUT=$ROOT/ground-truth/real
SCEN=$ROOT/tools/ground-truth/scenarios.txt
# keep the recording to this computer, and away from other ROS 2 programs on the network
export ROS_DOMAIN_ID=${ROS_DOMAIN_ID:-73} ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST PYTHONUNBUFFERED=1 RCUTILS_COLORIZED_OUTPUT=0

[ -f /opt/ros/jazzy/setup.bash ] || { echo "ROS 2 Jazzy is not installed (/opt/ros/jazzy)"; exit 1; }
for t in vcs colcon rosdep node git; do command -v $t >/dev/null || { echo "missing: $t (sudo apt install python3-vcstool python3-colcon-common-extensions python3-rosdep nodejs)"; exit 1; }; done
set +u; source /opt/ros/jazzy/setup.bash; set -u

trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; echo "${s%"${s##*[![:space:]]}"}"; }

# --- scenarios -------------------------------------------------------------------------------------------------
declare -a IDS WSS ROBOTS ENVS STEPS SETTLES
while IFS= read -r line; do
  [[ -z "$(trim "$line")" || "$(trim "$line")" == \#* ]] && continue
  IFS='|' read -r id ws robot env steps settle <<< "$line"
  id=$(trim "$id")
  if [ $# -gt 0 ] && [[ ! " $* " == *" $id "* ]]; then continue; fi
  IDS+=("$id"); WSS+=("$(trim "$ws")"); ROBOTS+=("$(trim "$robot")"); ENVS+=("$(trim "$env")")
  STEPS+=("$(trim "$steps")"); SETTLES+=("$(trim "$settle")")
done < "$SCEN"
[ ${#IDS[@]} -gt 0 ] || { echo "no scenario matches: $*"; exit 1; }

# --- build the workspaces --------------------------------------------------------------------------------------
build_ws() {
  local ws=$1 dir=$GT_WS/$1
  if [ -f "$dir/.built" ]; then echo "== $ws: already built ($dir)"; return 0; fi
  echo "== $ws: building in $dir (log: $dir/build.log)"
  mkdir -p "$dir/src"
  # the workspace's own Ubuntu steps, run in $dir instead of ~/ros2_ws; sudo steps are left to the user
  node -e '
    const [root, ws, dir] = process.argv.slice(1);
    const w = require(`${root}/public/robots/ws/${ws}/workspace.json`), repos = `${root}/public/robots/ws/${ws}/${w.ubuntu.repos_file}`;
    const out = ["set -x", "source /opt/ros/jazzy/setup.bash", `cd "${dir}"`];
    for (let s of w.ubuntu.steps) {
      if (/^sudo |udevadm|rosdep init|>> ~\/\.bashrc|^mkdir -p ~\/ros2_ws|^source /.test(s)) continue;
      if (/^vcs import/.test(s)) { out.push(`[ -n "$(ls -A src)" ] || ${s.replace(/<\s*\S+\.repos/, `< "${repos}"`)}`); continue; }
      if (/^colcon build/.test(s)) s += " --continue-on-error";
      out.push(s.replace(/^rm /, "rm -f "));
    }
    console.log(out.join("\n"));' "$ROOT" "$ws" "$dir" > "$dir/build-steps.sh"
  ( bash "$dir/build-steps.sh" ) > "$dir/build.log" 2>&1
  if grep -qE "^Summary: .* packages? finished" "$dir/build.log" && ! grep -qE "packages? failed" "$dir/build.log"; then
    touch "$dir/.built"; echo "   built: $(grep '^Summary:' "$dir/build.log" | tail -1)"
  else
    echo "   BUILD PROBLEM in $ws (the scenarios below run against a partial workspace; their recordings may be empty)."
    grep -E "^[[:space:]]*[0-9]+ packages? failed:" "$dir/build.log" | sed 's/^/   | /'
    echo "   Full log: $dir/build.log. Install the missing system packages (see the log), then: rm $dir/.built and re-run."
  fi
}
for ws in $(printf '%s\n' "${WSS[@]}" | awk '!seen[$0]++'); do build_ws "$ws"; done

# --- run one scenario ------------------------------------------------------------------------------------------
stop_all() {   # Ctrl+C every process group we started, as a user would; then make sure nothing is left
  local g; for g in "$@"; do kill -INT -- "-$g" 2>/dev/null; done; sleep 8
  for g in "$@"; do kill -KILL -- "-$g" 2>/dev/null; done
  pkill -KILL -f "gz sim" 2>/dev/null; pkill -KILL -f "ruby.*gz" 2>/dev/null; sleep 2
}
fname() { local n="${1#/}"; echo "${n//\//__}"; }

run_scenario() {
  local id=$1 ws=$2 robot=$3 env=$4 steps=$5 settle=$6 dir=$GT_WS/$2 o=$OUT/$1
  echo; echo "==================== $id ($robot)"
  rm -rf "$o"; mkdir -p "$o/topic"; : > "$o/commands.txt"
  # environment: the workspace's per-robot env (as the site sets it) + the scenario's
  local exports
  exports=$(node -e 'const w = require(process.argv[1]); const e = (w.env || {})[process.argv[2]] || {};
    console.log(Object.entries(e).map(([k, v]) => `export ${k}=${v}`).join("; "))' "$ROOT/public/robots/ws/$ws/workspace.json" "$robot")
  [ "$env" != "-" ] && exports="$exports; $(echo "$env" | tr ',' '\n' | sed 's/^ */export /' | paste -sd';')"
  # no separator when the scenario sets no environment ("; ;" is a bash syntax error that stops the launch)
  local envpart=${exports#; }; envpart=${envpart:+$envpart; }
  local pre="source /opt/ros/jazzy/setup.bash; source '$dir/install/setup.bash'; ${envpart}cd ~"
  ros2 daemon stop >/dev/null 2>&1
  local groups=() k=0 step cmd
  while IFS= read -r step; do
    step=$(trim "$step"); [ -z "$step" ] && continue
    if [[ $step == sleep:* ]]; then sleep "${step#sleep:}"; continue; fi
    cmd=${step#bg:}; cmd=${cmd#fg:}; k=$((k + 1))
    echo "\$ $cmd" >> "$o/commands.txt"; echo "   $ $cmd"
    if [[ $step == fg:* ]]; then
      setsid bash -c "set +u; $pre; timeout 60 $cmd" > "$o/launch_$k.log" 2>&1 < /dev/null
    else
      setsid bash -c "set +u; $pre; exec $cmd" > "$o/launch_$k.log" 2>&1 < /dev/null & groups+=($!)
    fi
  done < <(echo "$steps" | sed 's/ ;; /\n/g')
  # start the ros2 daemon now, so it has discovered the whole graph by the end of the settle time (a daemon
  # started by the first query answers with part of the graph)
  ( set +u; eval "$pre"; ros2 daemon start > /dev/null 2>&1 )
  sleep "$settle"
  # the same introspection tests/sim-capture.mjs does
  (
    set +u; eval "$pre"; cd "$o"
    ros2 topic list > /dev/null 2>&1; sleep 2
    ros2 node list > nodes.txt 2>&1
    ros2 topic list -t > topics.txt 2>&1
    ros2 service list -t > services.txt 2>&1
    ros2 action list -t > actions.txt 2>&1
    : > controllers.txt; : > hardware_interfaces.txt
    for cm in $(grep -E '(^|/)controller_manager$' nodes.txt); do
      { echo "## $cm"; timeout 20 ros2 control list_controllers -c "$cm" 2>&1; } >> controllers.txt
      { echo "## $cm"; timeout 20 ros2 control list_hardware_interfaces -c "$cm" 2>&1; } >> hardware_interfaces.txt
    done
    tmp=$(mktemp -d); ( cd "$tmp" && timeout 30 ros2 run tf2_tools view_frames > /dev/null 2>&1 )
    cp "$tmp"/frames_*.gv tf_frames.gv 2>/dev/null || : > tf_frames.gv; rm -rf "$tmp"
    n=0
    while IFS= read -r line; do
      t=${line%% \[*}; t=$(trim "$t")
      [[ -z "$t" || "$t" == /parameter_events || "$t" == /rosout ]] && continue
      f=topic/$(fname "$t")
      (
        timeout 10 ros2 topic info -v "$t" > "$f.info.txt" 2>&1
        timeout -s INT 8 ros2 topic hz "$t" > "$f.hz.txt" 2>&1
        timeout 8 ros2 topic echo --once "$t" 2>&1 | head -c 8000 > "$f.echo.txt"
      ) &
      n=$((n + 1)); [ $((n % 8)) -eq 0 ] && wait   # 8 topics at a time
    done < topics.txt
    wait
    echo "   recorded: $(grep -c . topics.txt) topics, $(grep -c . nodes.txt) nodes -> $o"
  )
  stop_all "${groups[@]}"
  ros2 daemon stop >/dev/null 2>&1
}

pkill -KILL -f "gz sim" 2>/dev/null
for i in "${!IDS[@]}"; do
  if [ ! -f "$GT_WS/${WSS[$i]}/install/setup.bash" ]; then echo; echo "== ${IDS[$i]}: SKIPPED, ${WSS[$i]} has no install/ (build failed)"; continue; fi
  run_scenario "${IDS[$i]}" "${WSS[$i]}" "${ROBOTS[$i]}" "${ENVS[$i]}" "${STEPS[$i]}" "${SETTLES[$i]}"
done
echo; echo "Done. Record the site with:  node tests/sim-capture.mjs   then compare:  node tools/ground-truth/compare.mjs"
