#!/usr/bin/env python3
"""
run_matrix.py - Planner x controller matrix on the real nav2_bringup TB3 demo (tb3_simulation_launch.py).

Planners NavFn, Smac2D, ThetaStar, SmacHybrid, SmacLattice x controllers MPPI, DWB, RPP, RotationShimRPP, Graceful.
Each pair's params file is the installed nav2_params.yaml with only the pair's changes (generate_matrix_configs.py).

  run_matrix.py --frame-check   installed params: localize, frame_check.py (goals.yaml vs this map frame), stop.
  run_matrix.py                 every pair without a complete result.json (resume after a restart). Refuses to run
                                unless the frame check said VALID.
  run_matrix.py --dwb-burger    the 5 planners x DWB_burger (DWB with every FollowPath key of the installed
                                turtlebot3_navigation2/param/burger.yaml) into matrix_dwb_burger/ and
                                bags/matrix_dwb_burger/ instead of matrix/ and bags/matrix/.
Per pair, into parity/fixtures/tb3_burger/nav2_bringup/matrix/<pair>/:
  params.yaml, params.diff     the pair's params and its diff against the installed file
  run_info.txt, logs/          start_reference.sh (git_commit, package versions); logs/nav2demo.log is gitignored
  domain_check.txt             domain 41 processes before start and after stop (must be empty)
  ready_localization.txt, ready_navigation.txt   wait_nav_ready.py output (configure/activate result)
  cmd_vel_info.txt             ros2 topic info /cmd_vel -v --no-daemon --spin-time 5, once Nav2 is active
  cmd_vel_params.txt           enable_stamped_cmd_vel of the nodes on /cmd_vel; topic_list.txt (types)
  params_effective/            ros2 param dump of controller_server and planner_server (values in effect)
  goal_goal1/                  send_goal_capture.py: result.json (status, error_code, error_msg, sim duration)
  nav2_errors.txt, collision_monitor.txt, goal_goal1/nav2_goal_lines.txt   log_excerpts.py
  result.json                  the pair's summary
Bags: parity/fixtures/tb3_burger/nav2_bringup/bags/matrix/<pair>/ (MCAP, gitignored). The run stops before a pair
when the bags under parity/fixtures exceed 8 GB (8e9 bytes) in total.
Runs only with committed parity/scripts (run_info.txt records git_commit). Do not export ROS_DOMAIN_ID=41 in the
shell that runs this: domain_pids would count this script.
"""
import argparse
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_matrix_configs as gen  # noqa: E402

DOMAIN, PARTITION, ROBOT, SCEN = 41, "ref41", "tb3_burger", "nav2_bringup"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FIX = os.path.join(ROOT, "parity", "fixtures", ROBOT, SCEN)
MATRIX = os.path.join(FIX, "matrix")
BAG_SUB = "matrix"
CONTROLLERS = list(gen.CONTROLLERS)
FRAME = os.path.join(FIX, "frame_check")
MAP = os.path.join(ROOT, "parity", "fixtures", "maps", "turtlebot3_world.yaml")
BAG_LIMIT = 8e9
READY_LIMIT = 300      # wall s, per wait_nav_ready.py phase
LOCALIZE_LIMIT = 120   # wall s
STEP_TIMEOUT = 1500    # wall s, hard limit on any one command (a goal has 180 s sim inside send_goal_capture.py)
# Nodes that can publish or subscribe /cmd_vel in nav2_bringup (for enable_stamped_cmd_vel)
CMD_VEL_NODES = ["controller_server", "velocity_smoother", "collision_monitor", "behavior_server", "docking_server"]


def log(msg):
    print(f"[{time.strftime('%Y-%m-%dT%H:%M:%S%z')}] {msg}", flush=True)


def clean_env():
    e = os.environ.copy()
    e.pop("ROS_DOMAIN_ID", None)
    return e


def sh(cmd, env=None, timeout=STEP_TIMEOUT):
    """bash -c cmd from the repo root; returns (rc, stdout+stderr). rc 124 on timeout."""
    e = clean_env()
    e.update(env or {})
    try:
        r = subprocess.run(["bash", "-c", cmd], cwd=ROOT, env=e, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout + r.stderr
    except subprocess.TimeoutExpired as ex:
        out = (ex.stdout or b"").decode(errors="replace") + (ex.stderr or b"").decode(errors="replace")
        return 124, out + f"\nTIMEOUT after {timeout} s wall: {cmd}\n"


def ros(cmd, timeout=STEP_TIMEOUT):
    return sh(f"source parity/scripts/env.sh >/dev/null && export ROS_DOMAIN_ID={DOMAIN} && {cmd}", timeout=timeout)


def domain_pids():
    _, out = sh(f"source parity/scripts/domain_procs.sh && domain_pids {DOMAIN}", timeout=60)
    return out.split()


def check_domain(where, path):
    pids = domain_pids()
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%S%z')} {where}: domain {DOMAIN} " + \
        ("empty" if not pids else f"NOT EMPTY: {' '.join(pids)}")
    with open(path, "a") as f:
        f.write(line + "\n")
    log(line)
    return not pids


def stop_all():
    sh(f"bash parity/scripts/record_bag.sh stop {DOMAIN}", timeout=60)
    rc, out = sh(f"bash parity/scripts/stop_reference.sh {DOMAIN}", timeout=120)
    log(out.strip())


def bags_total():
    total = 0
    for d, _, files in os.walk(os.path.join(ROOT, "parity", "fixtures")):
        if "/bags" in d[len(ROOT):]:
            total += sum(os.path.getsize(os.path.join(d, f)) for f in files if not os.path.islink(os.path.join(d, f)))
    return total


def save(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(text)


def start(out_dir, params_file=None):
    """Domain must be empty first. Returns True if the launch started."""
    dc = os.path.join(out_dir, "domain_check.txt")
    stop_all()
    if not check_domain("before start", dc):
        return None
    # No ROS_DOMAIN_ID here: start_reference.sh exports it itself, and its domain check would see this wrapper
    env = {"MAP": MAP, "OUT_DIR": out_dir, "REF_RENDER": "egl"}
    if params_file:
        env["PARAMS_FILE"] = params_file
    rc, out = sh(f"bash parity/scripts/start_reference.sh {ROBOT} {SCEN} {DOMAIN} {PARTITION}", env=env, timeout=120)
    log(out.strip())
    return rc == 0


def stop(out_dir):
    stop_all()
    return check_domain("after stop", os.path.join(out_dir, "domain_check.txt"))


def wait(out_file, managers, localize=False):
    extra = f" --localize --localize-limit {LOCALIZE_LIMIT}" if localize else ""
    rc, out = ros(f"python3 parity/scripts/wait_nav_ready.py --managers {managers} --limit {READY_LIMIT}{extra}",
                  timeout=READY_LIMIT + LOCALIZE_LIMIT + 60)
    with open(out_file, "a") as f:
        f.write(f"# wait_nav_ready.py --managers {managers}{extra}: exit {rc}\n{out}\n")
    return rc, out


def frame_check():
    os.makedirs(FRAME, exist_ok=True)
    started = start(FRAME)
    if started is None:
        log("ABORT: domain not empty before start")
        return 2
    rc = 1
    if started:
        r1, _ = wait(os.path.join(FRAME, "ready.txt"), "lifecycle_manager_localization", localize=True)
        if r1 == 0:
            rc, out = ros(f"python3 parity/scripts/frame_check.py --map {MAP} --out {FRAME}/frame_check.txt",
                          timeout=180)
            log(out.strip())
            # the same three values the check compares, from the CLI
            for name, cmd in [("amcl_pose_echo.txt", "ros2 topic echo --once --qos-durability transient_local "
                               "--qos-reliability reliable /amcl_pose"),
                              ("tf_map_base_footprint.txt", "ros2 run tf2_ros tf2_echo map base_footprint")]:
                _, o = ros(f"timeout -k 2s 15 {cmd}", timeout=40)
                save(os.path.join(FRAME, name), f"# {cmd}\n{o}")
    stop(FRAME)
    sh(f"python3 parity/scripts/log_excerpts.py {FRAME}", timeout=300)
    return rc


def frame_valid():
    p = os.path.join(FRAME, "frame_check.txt")
    return os.path.exists(p) and "VERDICT: VALID" in open(p).read()


def cmd_vel_capture(pdir):
    _, out = ros("timeout -k 2s 30 ros2 topic info /cmd_vel -v --no-daemon --spin-time 5", timeout=60)
    save(os.path.join(pdir, "cmd_vel_info.txt"), "# ros2 topic info /cmd_vel -v --no-daemon --spin-time 5\n" + out)
    _, out = ros("timeout -k 2s 30 ros2 topic list -t --no-daemon --spin-time 5", timeout=60)
    save(os.path.join(pdir, "topic_list.txt"), "# ros2 topic list -t --no-daemon --spin-time 5\n" + out)
    lines = []
    for n in CMD_VEL_NODES:
        _, o = ros(f"timeout -k 2s 20 ros2 param get --no-daemon /{n} enable_stamped_cmd_vel", timeout=40)
        lines.append(f"/{n} enable_stamped_cmd_vel: {o.strip()}")
    save(os.path.join(pdir, "cmd_vel_params.txt"), "# ros2 param get --no-daemon /<node> enable_stamped_cmd_vel\n"
         + "\n".join(lines) + "\n")
    for n in ["controller_server", "planner_server"]:
        _, o = ros(f"timeout -k 2s 30 ros2 param dump --no-daemon /{n}", timeout=60)
        save(os.path.join(pdir, "params_effective", f"{n}.yaml"), f"# ros2 param dump --no-daemon /{n}\n" + o)


def tail(text, n):
    return [l for l in text.strip().splitlines() if l.strip()][-n:]


def run_pair(planner, controller):
    pair = f"{planner}_{controller}"
    pdir = os.path.join(MATRIX, pair)
    sh(f"rm -rf '{pdir}' 'parity/fixtures/{ROBOT}/{SCEN}/bags/{BAG_SUB}/{pair}'", timeout=60)  # partial run of an earlier start
    params = gen.generate_pair(planner, controller, pdir)
    res = {"pair": pair, "planner": planner, "controller": controller, "complete": False,
           "start_wall": time.strftime('%Y-%m-%dT%H:%M:%S%z')}
    started = start(pdir, params)
    if started is None:
        return None
    if not started:
        res.update(status="UNVERIFIED", stage="start_reference.sh failed")
    else:
        rl = os.path.join(pdir, "ready_localization.txt")
        rc, out = wait(rl, "lifecycle_manager_localization")
        if rc != 0:
            res.update(status="UNVERIFIED", stage="localization lifecycle / navigate_to_pose not ready",
                       ready=tail(out, 3))
        else:
            sh(f"bash parity/scripts/record_bag.sh start {ROBOT} {SCEN} {DOMAIN} {BAG_SUB}/{pair}", timeout=60)
            time.sleep(2)  # the recorder subscribes after discovery; no ready signal
            rc, out = wait(rl, "lifecycle_manager_localization", localize=True)
            if rc != 0:
                res.update(status="NOT_LOCALIZED", ready=tail(out, 2))
            else:
                res["localized"] = tail(out, 2)[0]
                rc, out = wait(os.path.join(pdir, "ready_navigation.txt"), "lifecycle_manager_navigation")
                if rc != 0:
                    res.update(status="UNVERIFIED", stage="navigation lifecycle not active", ready=tail(out, 3))
                else:
                    res["active"] = True
                    cmd_vel_capture(pdir)
                    log(f"{pair}: send goal1")
                    rc, out = ros(f"python3 parity/scripts/send_goal_capture.py --goal goal1 "
                                  f"--out-dir {pdir}/goal_goal1")
                    log(out.strip()[-600:])
                    gp = os.path.join(pdir, "goal_goal1", "result.json")
                    g = json.load(open(gp)) if os.path.exists(gp) else {}
                    r = g.get("result") or {}
                    res.update(status=g.get("status_name") or ("TIMEOUT" if rc == 124 else "NO_RESULT"),
                               accepted=g.get("accepted"), error_code=r.get("error_code"),
                               error_msg=r.get("error_msg"), duration_sim_s=g.get("duration_sim_s"),
                               timed_out_after_sim_s=g.get("timed_out_after_sim_s"), goal_error=g.get("error"))
    res["domain_empty_after_stop"] = stop(pdir)
    sh(f"python3 parity/scripts/log_excerpts.py {pdir}", timeout=300)
    bag = os.path.join(FIX, "bags", BAG_SUB, pair)
    res["bag"] = os.path.relpath(bag, ROOT) if os.path.isdir(bag) else None
    res["bag_bytes"] = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(bag) for f in fs) \
        if os.path.isdir(bag) else 0
    res["end_wall"] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
    res["complete"] = True
    save(os.path.join(pdir, "result.json"), json.dumps(res, indent=2) + "\n")
    log(f"{pair}: {res['status']}")
    return res


def collect():
    out = []
    for p in gen.PLANNERS:
        for c in CONTROLLERS:
            f = os.path.join(MATRIX, f"{p}_{c}", "result.json")
            if os.path.exists(f):
                out.append(json.load(open(f)))
    save(os.path.join(MATRIX, "matrix_results.json"), json.dumps(out, indent=2) + "\n")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frame-check", action="store_true")
    ap.add_argument("--only", help="comma-separated pair names")
    ap.add_argument("--dwb-burger", action="store_true", help="planners x DWB_burger into matrix_dwb_burger/")
    args = ap.parse_args()
    global MATRIX, BAG_SUB, CONTROLLERS
    if args.dwb_burger:
        MATRIX, BAG_SUB, CONTROLLERS = os.path.join(FIX, "matrix_dwb_burger"), "matrix_dwb_burger", ["DWB_burger"]
    if os.environ.get("ROS_DOMAIN_ID") == str(DOMAIN):
        sys.exit(f"ROS_DOMAIN_ID={DOMAIN} is set in this shell; domain_pids would count this script")
    _, dirty = sh("git status --porcelain -- parity/scripts", timeout=30)
    if dirty.strip():
        sys.exit(f"parity/scripts has uncommitted changes (commit them first):\n{dirty}")
    if args.frame_check:
        sys.exit(frame_check())
    if not frame_valid():
        sys.exit(f"no VALID frame check in {FRAME}/frame_check.txt: run --frame-check first")
    only = set(args.only.split(",")) if args.only else None
    for p in gen.PLANNERS:
        for c in CONTROLLERS:
            pair = f"{p}_{c}"
            if only and pair not in only:
                continue
            f = os.path.join(MATRIX, pair, "result.json")
            if os.path.exists(f) and json.load(open(f)).get("complete"):
                log(f"{pair}: complete, skipped")
                continue
            total = bags_total()
            if total > BAG_LIMIT:
                log(f"STOP: bags under parity/fixtures total {total} bytes > {BAG_LIMIT:.0f}")
                break
            r = run_pair(p, c)
            if r is None:
                log("ABORT: domain not empty before start")
                break
            collect()
            if not r["domain_empty_after_stop"]:
                log("ABORT: domain not empty after stop")
                break
    results = collect()
    log(f"{len(results)} of {len(gen.PLANNERS) * len(CONTROLLERS)} pairs complete: " + ", ".join(f"{r['pair']}={r['status']}" for r in results))


if __name__ == "__main__":
    main()
