# Lesson terminal parity: Weeks 1 to 3 (W1, W2, IN)

Date: 2026-10-19 · Branch: parity-v2 · Auditor: read-only lesson-parity audit (no code or content changed)
**Updated after the real re-capture** (`parity/fixtures/lessons/RECAPTURE_DONE`, 2026-10-19T22:12:45+05:30). See section 0.

**Ground truth:** `parity/fixtures/lessons/<lesson>/term<N>.json` (real Ubuntu 24.04 + ROS 2 Jazzy bash on a pty, captured with `parity/scripts/lessons/run_lesson_terms.py`, re-captured).
**Site output** (unchanged by the re-capture, so still valid):
- Node (the site's own `Shell` from `public/js/terminal-sim.js`, using the same loop as `tools/check-content.mjs`): `parity/browser_out/lessons/<lesson>/term<N>.site.json`
- Browser (headless Chromium on the dev server http://127.0.0.1:8000). The block was rendered with the site's `renderLesson()` from `public/js/lesson-render.js`, which is what `lesson.html` calls after sign-in. A Playwright route served one harness page so no Firebase login was needed. Each solution was typed into the terminal input and Enter pressed. **+ New terminal** was clicked for `{newTerminal}`. The real nano textarea was edited and saved with Ctrl+O then Ctrl+X. **Ctrl+C (stop it)** was clicked before typing into a busy terminal and again at the end. Output: `parity/browser_out/lessons/<lesson>/term<N>.browser.json`
- Tools: `parity/browser_out/lessons/tools/{site_node.mjs, site_browser.mjs, compare.py, appendix.py, code_in8.mjs}`. Comparison data: `parity/browser_out/lessons/compare.weeks1-3.{site,browser}.json`. The pre-re-capture comparison is kept in `compare.weeks1-3.browser.before-recapture.json`.

**Scope:** 32 practice-terminal blocks in 25 lessons. W1: A1, A2, A2b, A3, A3b, A4, A5, A5b, A6. W2: C1, C2, R1, R2, A7, R4. IN: IN1, IN2, IN3, IN4, IN6 to IN11. These lessons have no practice terminal: A0, P1 to P3, B2 to B8, C3, C4, R2b, IN5. **All 32 blocks have a real fixture (no "NO FIXTURE").**

**Normalisation before comparing:** I made the following changes before comparing:
- Log stamps: `[INFO] [1792…]` became `[INFO] [T]`.
- Launch log folder name and `pid N` were masked.
- UUIDs were masked, and so were `GID:` values and action goal IDs.
- The names `prasad`, `student` and `ros2lab` became `<U>`. The real user and host are both `prasad`. The site uses `student@ros2lab`.
- In `ls -l`, link count, owner, size and date were masked, but the permission bits and the `total N` line were kept.
- Trailing blank lines were dropped.

For a command that was still running in real (a node), I compared only the lines real printed in its window against the site's first lines. Message counters `Hello World: N` were masked there, because they depend on timing. Site lines with class `hint` are left out of the comparison and listed in section 5.

**Node vs browser:** both gave the same verdict for every command. They differ in only two ways:
- The browser hides the "(Practice terminal: … keeps running in the background …)" hint while a node runs in a pane.
- The browser keeps streaming talker and listener lines once per second.

## 0. Changes after re-capture

The old capture had a runner bug that killed the shared ros2 daemon after every block. Re-running the same comparison scripts on the new fixtures changed the totals from 116 / 44 / 26 to **119 / 41 / 26** (MATCH / DIFFERS / PENDING).

**These verdicts changed from DIFFERS to MATCH.** All three had been flagged [FIXTURE?]:
- IN2 term1 task 4 `ros2 node list`: real now lists `/listener`, `/talker`, the same as the site.
- IN3 term2 task 1 `ros2 node list`: real now lists `/turtlesim`.
- IN3 term2 task 3 `ros2 service call /spawn …`: the real `waiting for service to become available...` line is gone.

**These are still DIFFERS, but for a different reason now:**
- **IN3 term2 task 2 `ros2 topic echo --once /turtle1/pose`.** It used to fail in real ("does not appear to be published yet"). It now prints the pose, so this is a **site** difference. Real gives `x: 5.544444561004639` / `y: 5.544444561004639` (float32 printed in full). The site gives `x: 5.544445` / `y: 5.544445`.
- **IN11 term1 `ros2 topic info -v /chatter`.** Real now shows `Subscription count: 1` with the listener, so it is no longer a fixture issue. The only difference left is that the site shortens the type hash to `RIHS01_…`.
- **IN8 term1 task 3 and IN9 term1 task 2 `ros2 doctor`.** These were UNVERIFIED, because real had printed nothing in 40 s. Real now finishes in 47 s and 88 s with exit 0:
  - first 102 lines of the form `…/ros2doctor/api/package.py: 122: UserWarning: <pkg> has been updated to a new version. local: X < latest: Y` (this machine's packages are behind the repository);
  - then a blank line and `All 5 checks passed`.

  The site prints the same last two lines at once. The difference now depends on the machine ([MACHINE]).
- **IN8 code block `ros2 doctor --report | grep middleware`** (`IN8/termcode1.json`). This was UNVERIFIED and is now a **site** difference. Real (57 s, exit 0): `middleware name    : rmw_fastrtps_cpp`. Site: `             middleware name : rmw_fastrtps_cpp`. The alignment and padding differ.
- **IN10 term1 task 4 `ros2 daemon stop`.** Real again says `The daemon is not running`, so the earlier finding is **confirmed**. The site still says `The daemon has been stopped`.
- The R4 fixture's interrupt `of` labels are now correct. The R4 launch, rosdep and colcon output was captured again with the same content, so those findings stand. The real TurtleBot3 launch printed 23 lines in 25 s this time, against 50 before.

**Still fixture-environment items:**
- IN10 `echo $ROS_DOMAIN_ID` prints `52`, which the runner exports.
- A6 term2 `tree` is already installed on this machine.

**No item in the top list was removed.** Item 10 now also covers the IN3 pose floats, and item 16 (the IN8 doctor/grep format) is new.

## 1. Totals

| | Commands |
|---|---|
| Compared (string commands with a real step) | 186 |
| **MATCH** | **119** |
| **DIFFERS** | **41** |
| PENDING (real step not run: sudo/apt, per the run rules) | 26 |
| Blocks: MATCH / DIFFERS / NO FIXTURE | 11 / 21 / 0 |

The 41 DIFFERS fall into three groups:
- **29 are site defects** ([SITE]).
- **10 depend on the machine** ([MACHINE]): `free`, `df`, `nproc`, the `lsb_release` point release, `ros2 pkg list` on a machine with many extra packages, and the `ros2 doctor` UserWarnings.
- **2 come from the real capture environment** ([FIXTURE?], section 4).

The first version of this report wrongly counted 9 MATCH blocks. The table in section 7 showed 11 then too.

All 32 blocks reach "All steps done" in the browser with their solutions (the Node checker agrees). The browser showed no page errors.

The Python code blocks were checked separately. `parity/fixtures/lessons/_python_out/code_out.json` compares 12 lesson Python code blocks' shown output with real `python3`, and **all 12 match**.

Code-block extra fixtures: `parity/fixtures/lessons/IN8/termcode1.json` is the only in-scope one. See section 6.

## 2. Differences a student would notice (priority order)

1. **A script with no shebang runs as Python on the site** (A5b term1 task 5, `./blink.py`, file `print("blink blink")`, after `chmod 755`).
   - REAL, exit 2:
     ```text
     ./blink.py: line 1: syntax error near unexpected token `"blink blink"'
     ./blink.py: line 1: `print("blink blink")'
     ```
   - SITE: `blink blink`

   The site teaches the wrong mental model: a `.py` file needs `#!/usr/bin/env python3` to run as `./file`.
2. **The ROS 1 commands print the wrong "not found" text** (IN7 term1 tasks 1 and 2).
   - REAL, exit 127:
     ```text
     Command 'roscore' not found, but can be installed with:
     sudo apt install python3-roslaunch
     ```
     and
     ```text
     Command 'rosrun' not found, but can be installed with:
     sudo apt install rosbash
     ```
   - SITE: `roscore: command not found` / `rosrun: command not found` (err)
3. **`ros2 daemon stop` after changing the domain** (IN10 term1 task 4, after `export ROS_DOMAIN_ID=7`). Confirmed by the re-capture.
   - REAL: `The daemon is not running` (no daemon was ever started in domain 7).
   - SITE: `The daemon has been stopped`
4. **The launch files in the R4 "dress rehearsal" are canned and end with a fake Ctrl+C** (R4 term1 tasks 9 and 10).
   - SITE: prints 5 lines, then `^C` and a hint, and the prompt comes back at once, though the student never pressed Ctrl+C.
   - REAL keeps running.
   - The process names and order are wrong for TurtleBot3:
     - REAL: `gazebo-1, gazebo-2, create-3, parameter_bridge-4, robot_state_publisher-5`
     - SITE: `gz-1, robot_state_publisher-2, ros_gz_bridge-3, create-4`
   - The process names and order are wrong for Panda:
     - REAL: `rviz2-1, static_transform_publisher-2, robot_state_publisher-3, move_group-4, ros2_control_node-5, spawner-6/7/8`
     - SITE: `robot_state_publisher-1, ros2_control_node-2, move_group-3, rviz2-4`, with no static_transform_publisher and no spawners.
   - The site leaves out `[INFO] [launch]: Default logging verbosity is set to INFO` and the `urdf_file_name : turtlebot3_burger.urdf` lines.
   - SITE log line: `…/.ros/log` (with no dated sub-folder).
5. **Node log lines have no timestamp** (every `ros2 run`: IN1, IN7, A6 turtlesim; IN2, R2 talker/listener).
   - REAL: `[INFO] [1792…] [turtlesim]: Starting turtlesim …`
   - SITE: `[INFO] [turtlesim]: Starting turtlesim …`
6. **The Ctrl+C line is wrong** (every node stopped at the end: A6, IN1, IN2, IN7, R2; confirmed again in the re-capture).
   - REAL C++ node: `[INFO] [1792…] [rclcpp]: signal_handler(SIGINT/SIGTERM)`
   - REAL Python listener (demo_nodes_py): prints no line at all.
   - SITE, for both: `^C[INFO] [rclcpp]: signal_handler(signum=2)`
7. **The g++ error is incomplete and has the wrong column** (C1 term2 task 1, missing `;`).
   - REAL:
     ```text
     speed.cpp: In function ‘int main()’:
     speed.cpp:5:47: error: expected ‘;’ before ‘return’
     ```
     followed by four source and caret lines.
   - SITE: `speed.cpp:5:45: error: expected ';' before 'return'` plus a hint. The column is 45 instead of 47, the quotes are ASCII instead of ‘ ’, and the `In function` line and the caret lines are missing. The hint stands in for the caret lines.
8. **`ros2 pkg executables demo_nodes_py` is missing 7 of 13 executables** (IN4 term2 task 3). The site leaves out:
   - `add_two_ints_client_async`
   - `async_param_client`
   - `introspection`
   - `listener_serialized`
   - `matched_event_detect`
   - `set_parameters_callback`
   - `use_logger_service`
9. **The listener replays old messages** (IN2 term1 task 3, browser). The site's listener prints `I heard: [Hello World: 1]`, `2`, `3`, then jumps to `14`, `15`, …. The real listener, started later, begins at the talker's current count (re-capture: `I heard: [Hello World: 12]`, `13`, …).
10. **Float values from turtlesim** (IN3 term2).
    - `ros2 action send_goal … RotateAbsolute "{theta: 1.57}"`: REAL `delta: -1.5520000457763672`, SITE `delta: -1.572`. Both the value and the format differ.
    - `ros2 topic echo --once /turtle1/pose`: REAL `x: 5.544444561004639`, SITE `x: 5.544445`. This is new after the re-capture.
11. **`printenv | grep ROS` is missing `ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET`** (A7 term2 task 3). The installed `/opt/ros/jazzy/share/ros_environment/environment/1.ros_discovery.dsv` sets it, and `ROS_ENV` in terminal-sim.js does not have it.
    - Order: REAL is `ROS_VERSION, ROS_PYTHON_VERSION, ROS_DOMAIN_ID, ROS_AUTOMATIC_DISCOVERY_RANGE, ROS_DISTRO`. SITE is `ROS_DISTRO, ROS_PYTHON_VERSION, ROS_VERSION`.
    - `ROS_DOMAIN_ID=52` comes from the runner, so it does not count.
12. **`locale` prints only 4 of 15 lines** (R2 term1 task 1). The site leaves out `LC_NUMERIC` through `LC_IDENTIFICATION`.
13. **`tree` has no summary line** (A5 term1 task 7, A6 term2 task 4). REAL ends with a blank line, then `6 directories, 1 file`.
14. **`ls -l` is missing `total N`, and a folder's link count is 1** (A1 term2 task 3, A5 term1 task 1, A5b term1 tasks 1 and 4).
    - REAL: `total 20` / `drwxrwxr-x 2 …`
    - SITE: no total line / `drwxr-xr-x 1 …`
    - The permission bits of the seeded home folders (rwxrwxr-x vs rwxr-xr-x) may come from how the runner seeded the folders (umask 002). The missing `total` line and the link count of 1 are site errors.
15. **`ros2 topic info -v` shortens the type hash** (IN11). This is now the only difference in that command.
    - REAL: `Topic type hash: RIHS01_df668c740482bbd48fb39d76a70dfd4bd59db1288021743503259e948f6b1a18`
    - SITE: `Topic type hash: RIHS01_…`
16. **`ros2 doctor --report | grep middleware`** (IN8 code block). REAL `middleware name    : rmw_fastrtps_cpp`, SITE `             middleware name : rmw_fastrtps_cpp`. This is new after the re-capture.

Cosmetic differences:
- **`date` format.** REAL: `Mon Oct 19 07:42:31 PM IST 2026` (en_US.UTF-8, 12-hour). SITE: `Mon Oct 19 2026 19:55:30 IST`.
- **`rosdep update`** (R4 task 3). The site prints only `base.yaml` and `python.yaml` `Hit` lines. REAL first prints `osx-homebrew.yaml`, `base`, `python`, `ruby`, `releases/fuerte.yaml`, then `Query rosdistro index …` and one `Skip end-of-life distro` / `Add distro` line per distro. The real command was still running after 180 s, because it needs the network, so its end was not compared.
- **`curl -L -o … ros2-apt-source.deb`** (R2 task 10). The progress meter differs. REAL has two header lines and the size is `4536` bytes. SITE has one header line and `6012`.
- **`colcon build` in an empty workspace** (R4 task 11). REAL first prints the progress line `[0.4s] [0/0 complete]`. SITE prints only `Summary: 0 packages finished [0.90s]`.
- **`ros2 doctor`** (IN8, IN9). Real takes 47 to 88 s; the site answers at once. The real UserWarning lines depend on the machine (see above).
- **`ros2 service call /spawn`.** The real turtlesim terminal logs `Spawning turtle [buddy] at x=[3.000000], y=[3.000000], theta=[0.000000]`, and the real action server logs `Rotation goal completed successfully`. The site's "running" nodes from the block spec have no visible terminal, so these lines are never shown. This is by design; I note it only.

## 3. UNVERIFIED

- The `ros2 doctor` items from the first version are now resolved (section 0).
- One item is left: the A6 term2 `tree` "not found" message. The site prints a blank line between `Command 'tree' not found, but can be installed with:` and `sudo apt install tree`. The real `roscore` / `rosrun` messages (IN7) have **no** blank line there. `tree` is installed on this machine, so the exact real text for `tree` cannot be captured here.

## 4. Real capture environment (not site defects)

- **IN10 term1 task 1 `echo $ROS_DOMAIN_ID`.** REAL printed `52` because the runner exports `ROS_DOMAIN_ID=52`. SITE prints an empty line, which is what a fresh Ubuntu prints.
- **A6 term2 task 1 `tree`.** `tree` is already installed on the real machine, so the "not found" step this lesson is built around cannot be reproduced (see section 3).

The discovery-related [FIXTURE?] items of the first version (IN2 node list, IN3 term2, IN11) are resolved by the re-capture (section 0).

Machine-dependent differences, expected and not defects:
- R1: `free -h`, `df -h`, `nproc`.
- `lsb_release -a`: REAL `Ubuntu 24.04.5 LTS`, SITE `24.04.1` (IN6, R1).
- `ros2 pkg list`: REAL 660 packages here, SITE 52 (IN4 term1, IN9). `ros2 pkg list | grep turtle` also differs: REAL lists the turtlebot3 packages installed on this machine, SITE lists only `turtlesim`. The site's list is much shorter than any Jazzy desktop install, but this machine is not a plain desktop install, so I did not judge the exact count.
- `ros2 doctor` UserWarning lines about out-of-date packages (IN8, IN9).

## 5. Beginner hints (rule 5)

The site added a `hint` line after these commands. Each hint comes **after** output that matches real, so none replaces real output:
- A1 `LS`
- A5 and A5b `./move.py` / `./blink.py` (Permission denied)
- A7 `ros2 topic list` before sourcing
- IN3 `ros2 param set … background_r 230`
- R2 `export ROS_APT_SOURCE_VERSION=…`
- the `sudo` password note on PENDING apt steps
- `(New terminal …)` notes when a pane opens
- the "keeps running in the background" note, Node only. The browser hides it while the node runs.

Flagged hints:
- **C1 term2 g++.** "Line 5 needs a semicolon ; at the end." stands in for gcc's caret and context lines, and the error line itself differs (item 7).
- **R4 tasks 9 and 10 `ros2 launch`.** "Practice terminal: Gazebo would open …" / "RViz would open …" replace the real running output, and come after a `^C` the student did not type (item 4).
- IN3 `ros2 service call /spawn`: "(A new turtle, buddy, appeared …)" is fine. It follows a response that now matches real exactly.

## 6. Code-block extra fixture

`parity/fixtures/lessons/IN8/termcode1.json` covers `ros2 doctor --report | grep middleware` with the talker running.
- REAL (re-captured, 57 s, exit 0): `middleware name    : rmw_fastrtps_cpp`
- SITE (`parity/browser_out/lessons/IN8/code1.site.json`): `             middleware name : rmw_fastrtps_cpp` at once.
- Verdict: **DIFFERS [SITE]**, padding and alignment (item 16). This command is not in the 186-command totals above, because it is a code block and not a practice-terminal step.

When this report was written, the other `termcode1` fixtures (D6, D8, D11, F9, F15, N4) were for lessons outside Weeks 1 to 3. IN8 was the only in-scope one.

## 7. Per-block verdicts
| Lesson | Term | Title | MATCH | DIFFERS | PENDING | Verdict |
|---|---|---|---|---|---|---|
| A1 | 1 | Practice terminal: your first commands | 4 | 0 | 0 | MATCH |
| A1 | 2 | Practice: more useful first commands | 5 | 2 | 0 | DIFFERS |
| A2 | 1 | Practice: walk around the computer | 6 | 0 | 0 | MATCH |
| A2b | 1 | Treasure hunt: find today's delivery list | 9 | 0 | 0 | MATCH |
| A3 | 1 | Practice: build a ROS 2 workspace | 7 | 0 | 0 | MATCH |
| A3b | 1 | Practice: tidy Chiku's messy Desktop | 9 | 0 | 0 | MATCH |
| A4 | 1 | Practice: read a robot log and edit a file | 4 | 0 | 0 | MATCH |
| A4 | 2 | Practice: be a log detective | 6 | 0 | 0 | MATCH |
| A5 | 1 | Practice: fix a Permission denied | 3 | 2 | 2 | DIFFERS |
| A5b | 1 | Practice: lock and unlock files | 4 | 3 | 0 | DIFFERS |
| A6 | 1 | Practice: install turtlesim | 1 | 1 | 3 | DIFFERS |
| A6 | 2 | Practice: install and use a new tool | 0 | 2 | 3 | DIFFERS |
| C1 | 1 | Practice: compile and run C++ | 6 | 0 | 0 | MATCH |
| C1 | 2 | Practice: fix the missing semicolon | 2 | 1 | 0 | DIFFERS |
| C2 | 1 | Practice: a counting loop in C++ | 4 | 0 | 0 | MATCH |
| R1 | 1 | Practice: check a computer is ready | 0 | 4 | 1 | DIFFERS |
| R2 | 1 | Dress rehearsal: install ROS 2 Jazzy on a fresh Ubuntu | 3 | 3 | 9 | DIFFERS |
| A7 | 1 | Practice: make ROS 2 load automatically | 6 | 0 | 0 | MATCH |
| A7 | 2 | Practice: your own variable | 6 | 1 | 0 | DIFFERS |
| R4 | 1 | Dress rehearsal: set up the lab | 4 | 4 | 6 | DIFFERS |
| IN1 | 1 | Practice: see a standard message | 4 | 1 | 0 | DIFFERS |
| IN2 | 1 | Practice: C++ and Python talking (multi-lingual) | 5 | 2 | 0 | DIFFERS |
| IN3 | 1 | Practice: find every part in a running system | 5 | 0 | 0 | MATCH |
| IN3 | 2 | Practice: find all five parts on a live turtle | 3 | 2 | 0 | DIFFERS |
| IN4 | 1 | Practice: explore installed packages | 1 | 1 | 0 | DIFFERS |
| IN4 | 2 | Practice: explore the ecosystem | 1 | 2 | 2 | DIFFERS |
| IN6 | 1 | Practice: which ROS am I running? | 4 | 1 | 0 | DIFFERS |
| IN7 | 1 | Practice: spot ROS 1 commands | 1 | 3 | 0 | DIFFERS |
| IN8 | 1 | Practice: check and switch the middleware | 2 | 1 | 0 | DIFFERS |
| IN9 | 1 | Practice: a quick health check of ROS 2 | 2 | 2 | 0 | DIFFERS |
| IN10 | 1 | Practice: set your domain | 2 | 2 | 0 | DIFFERS |
| IN11 | 1 | Practice: see the QoS of a real topic | 0 | 1 | 0 | DIFFERS |

## Appendix A: every differing command (REAL from the fixture, SITE from the browser capture)

Lines are shown raw (not normalised), max 14 per side. `«cls»` = the CSS class of the site line (err / hint / dir / exe). Tag: [SITE] = site defect, [MACHINE] = depends on the machine (expected to differ), [FIXTURE?] = real capture environment differs from a student machine (see section 4).

### A1 term2 task 1 [SITE]: `date`
```text
REAL (exit 0):
  Mon Oct 19 07:42:31 PM IST 2026
SITE:
  Mon Oct 19 2026 19:58:42 IST
```
### A1 term2 task 3 [SITE]: `ls -l`
```text
REAL (exit 0):
  total 20
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:42 Desktop
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:42 Documents
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:42 Downloads
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:42 Music
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:42 Pictures
SITE:
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Desktop   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Documents   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Downloads   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Music   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Pictures   «dir»
```
### A5 term1 task 1 [SITE]: `ls -l`
```text
REAL (exit 0):
  total 24
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Desktop
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Documents
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Downloads
  -rw-r--r-- 1 prasad prasad   53 Oct 19 19:43 move.py
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Music
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Pictures
SITE:
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Desktop   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Documents   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Downloads   «dir»
  -rw-r--r-- 1 student student    53 Oct  2 10:15 move.py
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Music   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Pictures   «dir»
```
### A5 term1 task 7 [SITE]: `tree`
```text
REAL (exit 0):
  .
  ├── Desktop
  ├── Documents
  ├── Downloads
  ├── move.py
  ├── Music
  └── Pictures
  
  6 directories, 1 file
SITE:
  .   «dir»
  ├── Desktop   «dir»
  ├── Documents   «dir»
  ├── Downloads   «dir»
  ├── move.py
  ├── Music   «dir»
  └── Pictures   «dir»
```
### A5b term1 task 1 [SITE]: `ls -l`
```text
REAL (exit 0):
  total 28
  -rw-r--r-- 1 prasad prasad   21 Oct 19 19:43 blink.py
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Desktop
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Documents
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Downloads
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Music
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Pictures
  -rw-r--r-- 1 prasad prasad   30 Oct 19 19:43 secret_plan.txt
SITE:
  -rw-r--r-- 1 student student    21 Oct  2 10:15 blink.py
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Desktop   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Documents   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Downloads   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Music   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Pictures   «dir»
  -rw-r--r-- 1 student student    30 Oct  2 10:15 secret_plan.txt
```
### A5b term1 task 4 [SITE]: `ls -l`
```text
REAL (exit 0):
  total 28
  -rwxr-xr-x 1 prasad prasad   21 Oct 19 19:43 blink.py
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Desktop
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Documents
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Downloads
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Music
  drwxrwxr-x 2 prasad prasad 4096 Oct 19 19:43 Pictures
  -rw------- 1 prasad prasad   30 Oct 19 19:43 secret_plan.txt
SITE:
  -rwxr-xr-x 1 student student    21 Oct  2 10:15 blink.py   «exe»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Desktop   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Documents   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Downloads   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Music   «dir»
  drwxr-xr-x 1 student student  4096 Oct  2 10:15 Pictures   «dir»
  -rw------- 1 student student    30 Oct  2 10:15 secret_plan.txt
```
### A5b term1 task 5 [SITE]: `./blink.py`
```text
REAL (exit 2):
  ./blink.py: line 1: syntax error near unexpected token `"blink blink"'
  ./blink.py: line 1: `print("blink blink")'
SITE:
  blink blink
```
### A6 term1 task 5 [SITE]: `ros2 run turtlesim turtlesim_node`
_running node: compared first 2 line(s) (real 2, site 2); real state: still running after 8 s_
```text
REAL (exit None):
  [INFO] [1792424839.383528983] [turtlesim]: Starting turtlesim with node name /turtlesim
  [INFO] [1792424839.417172647] [turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
SITE:
  [INFO] [turtlesim]: Starting turtlesim with node name /turtlesim
  [INFO] [turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
```
### A6 term2 task 1 [FIXTURE?]: `tree`
```text
REAL (exit 0):
  .
  ├── Desktop
  ├── Documents
  ├── Downloads
  ├── Music
  └── Pictures
  
  6 directories, 0 files
SITE:
  Command 'tree' not found, but can be installed with:   «err»
  
  sudo apt install tree
```
### A6 term2 task 4 [SITE]: `tree`
```text
REAL (exit 0):
  .
  ├── Desktop
  ├── Documents
  ├── Downloads
  ├── Music
  └── Pictures
  
  6 directories, 0 files
SITE:
  .   «dir»
  ├── Desktop   «dir»
  ├── Documents   «dir»
  ├── Downloads   «dir»
  ├── Music   «dir»
  └── Pictures   «dir»
```
### C1 term2 task 1 [SITE]: `g++ speed.cpp -o speed`
```text
REAL (exit 1):
  speed.cpp: In function ‘int main()’:
  speed.cpp:5:47: error: expected ‘;’ before ‘return’
      5 |   std::cout << "Speed: " << speed << std::endl
        |                                               ^
        |                                               ;
      6 |   return 0;
        |   ~~~~~~                                       
SITE:
  speed.cpp:5:45: error: expected ';' before 'return'   «err»
  Line 5 needs a semicolon ; at the end.   «hint»
```
### R1 term1 task 1 [MACHINE]: `lsb_release -a`
```text
REAL (exit 0):
  No LSB modules are available.
  Distributor ID:	Ubuntu
  Description:	Ubuntu 24.04.5 LTS
  Release:	24.04
  Codename:	noble
SITE:
  No LSB modules are available.
  Distributor ID:	Ubuntu
  Description:	Ubuntu 24.04.1 LTS
  Release:	24.04
  Codename:	noble
```
### R1 term1 task 2 [MACHINE]: `free -h`
```text
REAL (exit 0):
                 total        used        free      shared  buff/cache   available
  Mem:            15Gi       8.1Gi       1.1Gi       1.2Gi       6.9Gi       7.3Gi
  Swap:          4.0Gi       415Mi       3.6Gi
SITE:
                 total        used        free      shared  buff/cache   available
  Mem:            15Gi       3.1Gi       9.2Gi       412Mi       3.4Gi        12Gi
  Swap:          4.0Gi          0B       4.0Gi
```
### R1 term1 task 3 [MACHINE]: `df -h`
```text
REAL (exit 0):
  Filesystem      Size  Used Avail Use% Mounted on
  tmpfs           1.6G  3.5M  1.6G   1% /run
  /dev/nvme0n1p5   89G   66G   19G  78% /
  tmpfs           7.7G  109M  7.6G   2% /dev/shm
  tmpfs           5.0M   12K  5.0M   1% /run/lock
  efivarfs        192K  136K   52K  73% /sys/firmware/efi/efivars
  /dev/nvme0n1p1  296M   39M  258M  13% /boot/efi
  tmpfs           1.6G  5.0M  1.6G   1% /run/user/1000
SITE:
  Filesystem      Size  Used Avail Use% Mounted on
  /dev/sda2       234G   38G  184G  18% /
  tmpfs           7.7G     0  7.7G   0% /dev/shm
```
### R1 term1 task 4 [MACHINE]: `nproc`
```text
REAL (exit 0):
  12
SITE:
  8
```
### R2 term1 task 1 [SITE]: `locale`
```text
REAL (exit 0):
  LANG=en_US.UTF-8
  LANGUAGE=
  LC_CTYPE="en_US.UTF-8"
  LC_NUMERIC="en_US.UTF-8"
  LC_TIME="en_US.UTF-8"
  LC_COLLATE="en_US.UTF-8"
  LC_MONETARY="en_US.UTF-8"
  LC_MESSAGES="en_US.UTF-8"
  LC_PAPER="en_US.UTF-8"
  LC_NAME="en_US.UTF-8"
  LC_ADDRESS="en_US.UTF-8"
  LC_TELEPHONE="en_US.UTF-8"
  LC_MEASUREMENT="en_US.UTF-8"
  LC_IDENTIFICATION="en_US.UTF-8"
  … (1 more)
SITE:
  LANG=en_US.UTF-8
  LANGUAGE=
  LC_CTYPE="en_US.UTF-8"
  LC_ALL=
```
### R2 term1 task 10 [SITE]: `curl -L -o /tmp/ros2-apt-source.deb "https://github.com/ros-infrastructure/ros-apt-source/releases/download/${`
_running node: compared first 2 line(s) (real 20, site 2); real state: still running after 15 s_
```text
REAL (exit None):
    % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                   Dload  Upload   Total   Spent    Left  Speed
  
    0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
    0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
    0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
  
    0     0    0     0    0     0      0      0 --:--:--  0:00:02 --:--:--     0
    0     0    0     0    0     0      0      0 --:--:--  0:00:03 --:--:--     0
    0     0    0     0    0     0      0      0 --:--:--  0:00:04 --:--:--     0
    0     0    0     0    0     0      0      0 --:--:--  0:00:05 --:--:--     0
    0     0    0     0    0     0      0      0 --:--:--  0:00:06 --:--:--     0
    0     0    0     0    0     0      0      0 --:--:--  0:00:07 --:--:--     0
    0     0    0     0    0     0      0      0 --:--:--  0:00:08 --:--:--     0
  … (6 more)
SITE:
    % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
  100  6012  100  6012    0     0  19500      0 --:--:-- --:--:-- --:--:-- 19500
```
### R2 term1 task 15 [SITE]: `ros2 run demo_nodes_cpp talker`
_running node: compared first 7 line(s) (real 7, site 11); real state: still running after 8 s_
```text
REAL (exit None):
  [INFO] [1792424869.196046350] [talker]: Publishing: 'Hello World: 1'
  [INFO] [1792424870.195987847] [talker]: Publishing: 'Hello World: 2'
  [INFO] [1792424871.196136473] [talker]: Publishing: 'Hello World: 3'
  [INFO] [1792424872.195968541] [talker]: Publishing: 'Hello World: 4'
  [INFO] [1792424873.195969725] [talker]: Publishing: 'Hello World: 5'
  [INFO] [1792424874.196016174] [talker]: Publishing: 'Hello World: 6'
  [INFO] [1792424875.196024504] [talker]: Publishing: 'Hello World: 7'
SITE:
  [INFO] [talker]: Publishing: 'Hello World: 1'
  [INFO] [talker]: Publishing: 'Hello World: 2'
  [INFO] [talker]: Publishing: 'Hello World: 3'
  [INFO] [talker]: Publishing: 'Hello World: 4'
  [INFO] [talker]: Publishing: 'Hello World: 5'
  [INFO] [talker]: Publishing: 'Hello World: 6'
  [INFO] [talker]: Publishing: 'Hello World: 7'
  [INFO] [talker]: Publishing: 'Hello World: 8'
  [INFO] [talker]: Publishing: 'Hello World: 9'
  [INFO] [talker]: Publishing: 'Hello World: 10'
  [INFO] [talker]: Publishing: 'Hello World: 11'
```
### A7 term2 task 3 [SITE]: `printenv | grep ROS`
```text
REAL (exit 0):
  ROS_VERSION=2
  ROS_PYTHON_VERSION=3
  ROS_DOMAIN_ID=52
  ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET
  ROS_DISTRO=jazzy
SITE:
  ROS_DISTRO=jazzy
  ROS_PYTHON_VERSION=3
  ROS_VERSION=2
```
### R4 term1 task 3 [SITE]: `rosdep update`
_running node: compared first 4 line(s) (real 22, site 4); real state: still running after 180 s_
```text
REAL (exit None):
  reading in sources list data from /etc/ros/rosdep/sources.list.d
  Hit https://raw.githubusercontent.com/ros/rosdistro/master/rosdep/osx-homebrew.yaml
  Hit https://raw.githubusercontent.com/ros/rosdistro/master/rosdep/base.yaml
  Hit https://raw.githubusercontent.com/ros/rosdistro/master/rosdep/python.yaml
  Hit https://raw.githubusercontent.com/ros/rosdistro/master/rosdep/ruby.yaml
  Hit https://raw.githubusercontent.com/ros/rosdistro/master/releases/fuerte.yaml
  Query rosdistro index https://raw.githubusercontent.com/ros/rosdistro/master/index-v4.yaml
  Skip end-of-life distro "ardent"
  Skip end-of-life distro "bouncy"
  Skip end-of-life distro "crystal"
  Skip end-of-life distro "dashing"
  Skip end-of-life distro "eloquent"
  Skip end-of-life distro "foxy"
  Skip end-of-life distro "galactic"
  … (8 more)
SITE:
  reading in sources list data from /etc/ros/rosdep/sources.list.d
  Hit https://raw.githubusercontent.com/ros/rosdistro/master/rosdep/base.yaml
  Hit https://raw.githubusercontent.com/ros/rosdistro/master/rosdep/python.yaml
  updated cache in /home/student/.ros/rosdep/sources.cache
```
### R4 term1 task 9 [SITE]: `ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py`
_running node: compared first 6 line(s) (real 23, site 6); real state: still running after 25 s_
```text
REAL (exit None):
  [INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-19-21-21-11-732541-prasad-1188567
  [INFO] [launch]: Default logging verbosity is set to INFO
  urdf_file_name : turtlebot3_burger.urdf
  urdf_file_name : turtlebot3_burger.urdf
  [INFO] [gazebo-1]: process started with pid [1188590]
  [INFO] [gazebo-2]: process started with pid [1188591]
  [INFO] [create-3]: process started with pid [1188593]
  [INFO] [parameter_bridge-4]: process started with pid [1188595]
  [INFO] [robot_state_publisher-5]: process started with pid [1188596]
  [robot_state_publisher-5] [INFO] [1792425073.716964977] [robot_state_publisher]: Robot initialized
  [create-3] [INFO] [1792425073.717034763] [ros_gz_sim]: Requesting list of world names.
  [gazebo-1] [Wrn] [LocalCache.cc:104] Server directory does not exist [/home/student/.gz/fuel/fuel.gazebosim.org]
  [parameter_bridge-4] [INFO] [1792425074.759225283] [ros_gz_bridge]: Creating GZ->ROS Bridge: [clock (gz.msgs.Clock) -> clock (rosgraph_msgs/msg/Clock)] (Lazy 0)
  [parameter_bridge-4] [INFO] [1792425074.772980259] [ros_gz_bridge]: Creating GZ->ROS Bridge: [joint_states (gz.msgs.Model) -> joint_states (sensor_msgs/msg/JointState)] (Lazy 0)
  … (9 more)
SITE:
  [INFO] [launch]: All log files can be found below /home/student/.ros/log
  [INFO] [gz-1]: process started with pid [4100]
  [INFO] [robot_state_publisher-2]: process started with pid [4107]
  [INFO] [ros_gz_bridge-3]: process started with pid [4114]
  [INFO] [create-4]: process started with pid [4121]
  ^C
  Practice terminal: Gazebo would open with a TurtleBot3 in the TurtleBot3 world. Drive it from a second terminal with teleop_twist_keyboard. On a real computer it keeps running until you press Ctrl+C.   «hint»
```
### R4 term1 task 10 [SITE]: `ros2 launch moveit_resources_panda_moveit_config demo.launch.py`
_running node: compared first 6 line(s) (real 246, site 6); real state: still running after 25 s_
```text
REAL (exit None):
  [INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-19-21-21-42-158295-prasad-1188859
  [INFO] [launch]: Default logging verbosity is set to INFO
  [INFO] [rviz2-1]: process started with pid [1188865]
  [INFO] [static_transform_publisher-2]: process started with pid [1188866]
  [INFO] [robot_state_publisher-3]: process started with pid [1188867]
  [INFO] [move_group-4]: process started with pid [1188868]
  [INFO] [ros2_control_node-5]: process started with pid [1188869]
  [INFO] [spawner-6]: process started with pid [1188870]
  [INFO] [spawner-7]: process started with pid [1188871]
  [INFO] [spawner-8]: process started with pid [1188872]
  [static_transform_publisher-2] [WARN] [1792425102.957297873] []: Old-style arguments are deprecated; see --help for new-style arguments
  [robot_state_publisher-3] [WARN] [1792425103.029506066] [kdl_parser]: The root link panda_link0 has an inertia specified in the URDF, but KDL does not support a root link with an inertia.  As a workaround, you can add an extra dummy link to your URDF.
  [robot_state_publisher-3] [INFO] [1792425103.029901204] [robot_state_publisher]: Robot initialized
  [static_transform_publisher-2] [INFO] [1792425103.042569711] [static_transform_publisher]: Spinning until stopped - publishing transform
  … (232 more)
SITE:
  [INFO] [launch]: All log files can be found below /home/student/.ros/log
  [INFO] [robot_state_publisher-1]: process started with pid [4100]
  [INFO] [ros2_control_node-2]: process started with pid [4107]
  [INFO] [move_group-3]: process started with pid [4114]
  [INFO] [rviz2-4]: process started with pid [4121]
  ^C
  Practice terminal: RViz would open with the Panda robot arm. Drag the arm's target, then press Plan & Execute. On a real computer it keeps running until you press Ctrl+C.   «hint»
```
### R4 term1 task 11 [SITE]: `colcon build`
```text
REAL (exit 0):
  [0.4s] [0/0 complete]
                       
  
  Summary: 0 packages finished [0.44s]
SITE:
  Summary: 0 packages finished [0.90s]
```
### IN1 term1 task 2 [SITE]: `ros2 run turtlesim turtlesim_node`
_running node: compared first 2 line(s) (real 2, site 2); real state: still running after 8 s_
```text
REAL (exit None):
  [INFO] [1792425143.602648066] [turtlesim]: Starting turtlesim with node name /turtlesim
  [INFO] [1792425143.618375976] [turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
SITE:
  [INFO] [turtlesim]: Starting turtlesim with node name /turtlesim
  [INFO] [turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
```
### IN2 term1 task 2 [SITE]: `ros2 run demo_nodes_cpp talker`
_running node: compared first 7 line(s) (real 7, site 11); real state: still running after 8 s_
```text
REAL (exit None):
  [INFO] [1792425162.090693835] [talker]: Publishing: 'Hello World: 1'
  [INFO] [1792425163.090684660] [talker]: Publishing: 'Hello World: 2'
  [INFO] [1792425164.090605822] [talker]: Publishing: 'Hello World: 3'
  [INFO] [1792425165.090642564] [talker]: Publishing: 'Hello World: 4'
  [INFO] [1792425166.090641026] [talker]: Publishing: 'Hello World: 5'
  [INFO] [1792425167.090646265] [talker]: Publishing: 'Hello World: 6'
  [INFO] [1792425168.090673595] [talker]: Publishing: 'Hello World: 7'
SITE:
  [INFO] [talker]: Publishing: 'Hello World: 1'
  [INFO] [talker]: Publishing: 'Hello World: 2'
  [INFO] [talker]: Publishing: 'Hello World: 3'
  [INFO] [talker]: Publishing: 'Hello World: 4'
  [INFO] [talker]: Publishing: 'Hello World: 5'
  [INFO] [talker]: Publishing: 'Hello World: 6'
  [INFO] [talker]: Publishing: 'Hello World: 7'
  [INFO] [talker]: Publishing: 'Hello World: 8'
  [INFO] [talker]: Publishing: 'Hello World: 9'
  [INFO] [talker]: Publishing: 'Hello World: 10'
  [INFO] [talker]: Publishing: 'Hello World: 11'
```
### IN2 term1 task 3 [SITE]: `ros2 run demo_nodes_py listener`
_running node: compared first 7 line(s) (real 7, site 11); real state: still running after 8 s_
```text
REAL (exit None):
  [INFO] [1792425173.144290080] [listener]: I heard: [Hello World: 12]
  [INFO] [1792425174.094110269] [listener]: I heard: [Hello World: 13]
  [INFO] [1792425175.093717980] [listener]: I heard: [Hello World: 14]
  [INFO] [1792425176.093946352] [listener]: I heard: [Hello World: 15]
  [INFO] [1792425177.093911082] [listener]: I heard: [Hello World: 16]
  [INFO] [1792425178.094228229] [listener]: I heard: [Hello World: 17]
  [INFO] [1792425179.092189889] [listener]: I heard: [Hello World: 18]
SITE:
  [INFO] [listener]: I heard: [Hello World: 1]
  [INFO] [listener]: I heard: [Hello World: 2]
  [INFO] [listener]: I heard: [Hello World: 3]
  [INFO] [listener]: I heard: [Hello World: 14]
  [INFO] [listener]: I heard: [Hello World: 15]
  [INFO] [listener]: I heard: [Hello World: 16]
  [INFO] [listener]: I heard: [Hello World: 17]
  [INFO] [listener]: I heard: [Hello World: 18]
  [INFO] [listener]: I heard: [Hello World: 19]
  [INFO] [listener]: I heard: [Hello World: 20]
  [INFO] [listener]: I heard: [Hello World: 21]
```
### IN3 term2 task 2 [SITE]: `ros2 topic echo --once /turtle1/pose`
```text
REAL (exit 0):
  x: 5.544444561004639
  y: 5.544444561004639
  theta: 0.0
  linear_velocity: 0.0
  angular_velocity: 0.0
  ---
SITE:
  x: 5.544445
  y: 5.544445
  theta: 0.0
  linear_velocity: 0.0
  angular_velocity: 0.0
  ---
```
### IN3 term2 task 4 [SITE]: `ros2 action send_goal /turtle1/rotate_absolute turtlesim/action/RotateAbsolute "{theta: 1.57}"`
```text
REAL (exit 0):
  Waiting for an action server to become available...
  Sending goal:
       theta: 1.57
  
  Goal accepted with ID: 695bbb18e7284d5d93c609f11839509e
  
  Result:
      delta: -1.5520000457763672
  
  Goal finished with status: SUCCEEDED
SITE:
  Waiting for an action server to become available...
  Sending goal:
       theta: 1.57
  
  Goal accepted with ID: ccc9df7e72e9f7b478e9d2cce509b7a3
  
  Result:
      delta: -1.572
  
  Goal finished with status: SUCCEEDED
```
### IN4 term1 task 1 [MACHINE]: `ros2 pkg list`
```text
REAL (exit 0):
  ackermann_msgs
  ackermann_steering_controller
  action_msgs
  action_tutorials_cpp
  action_tutorials_interfaces
  action_tutorials_py
  actionlib_msgs
  actuator_msgs
  admittance_controller
  ament_clang_format
  ament_clang_tidy
  ament_cmake
  ament_cmake_auto
  ament_cmake_clang_format
  … (646 more)
SITE:
  action_msgs
  ament_cmake
  ament_cmake_python
  ament_index_python
  builtin_interfaces
  control_msgs
  demo_nodes_cpp
  demo_nodes_py
  example_interfaces
  geometry_msgs
  interactive_markers
  joint_state_publisher
  joint_state_publisher_gui
  launch
  … (38 more)
```
### IN4 term2 task 2 [MACHINE]: `ros2 pkg list | grep turtle`
```text
REAL (exit 0):
  turtlebot3
  turtlebot3_applications
  turtlebot3_applications_msgs
  turtlebot3_aruco_tracker
  turtlebot3_automatic_parking
  turtlebot3_automatic_parking_vision
  turtlebot3_autorace
  turtlebot3_autorace_camera
  turtlebot3_autorace_detect
  turtlebot3_autorace_mission
  turtlebot3_bringup
  turtlebot3_cartographer
  turtlebot3_description
  turtlebot3_example
  … (34 more)
SITE:
  turtlesim
```
### IN4 term2 task 3 [SITE]: `ros2 pkg executables demo_nodes_py`
```text
REAL (exit 0):
  demo_nodes_py add_two_ints_client
  demo_nodes_py add_two_ints_client_async
  demo_nodes_py add_two_ints_server
  demo_nodes_py async_param_client
  demo_nodes_py introspection
  demo_nodes_py listener
  demo_nodes_py listener_qos
  demo_nodes_py listener_serialized
  demo_nodes_py matched_event_detect
  demo_nodes_py set_parameters_callback
  demo_nodes_py talker
  demo_nodes_py talker_qos
  demo_nodes_py use_logger_service
SITE:
  demo_nodes_py add_two_ints_client
  demo_nodes_py add_two_ints_server
  demo_nodes_py listener
  demo_nodes_py listener_qos
  demo_nodes_py talker
  demo_nodes_py talker_qos
```
### IN6 term1 task 5 [MACHINE]: `lsb_release -a`
```text
REAL (exit 0):
  No LSB modules are available.
  Distributor ID:	Ubuntu
  Description:	Ubuntu 24.04.5 LTS
  Release:	24.04
  Codename:	noble
SITE:
  No LSB modules are available.
  Distributor ID:	Ubuntu
  Description:	Ubuntu 24.04.1 LTS
  Release:	24.04
  Codename:	noble
```
### IN7 term1 task 1 [SITE]: `roscore`
```text
REAL (exit 127):
  Command 'roscore' not found, but can be installed with:
  sudo apt install python3-roslaunch
SITE:
  roscore: command not found   «err»
```
### IN7 term1 task 2 [SITE]: `rosrun turtlesim turtlesim_node`
```text
REAL (exit 127):
  Command 'rosrun' not found, but can be installed with:
  sudo apt install rosbash
SITE:
  rosrun: command not found   «err»
```
### IN7 term1 task 3 [SITE]: `ros2 run turtlesim turtlesim_node`
_running node: compared first 2 line(s) (real 2, site 2); real state: still running after 8 s_
```text
REAL (exit None):
  [INFO] [1792425246.655375946] [turtlesim]: Starting turtlesim with node name /turtlesim
  [INFO] [1792425246.667886842] [turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
SITE:
  [INFO] [turtlesim]: Starting turtlesim with node name /turtlesim
  [INFO] [turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
```
### IN8 term1 task 3 [MACHINE]: `ros2 doctor`
```text
REAL (exit 0):
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: dwb_plugins has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_loopback_sim has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: range_sensor_broadcaster has been updated to a new version. local: 4.42.1 < latest: 4.43.0
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: controller_manager has been updated to a new version. local: 4.48.1 < latest: 4.49.0
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_behaviors has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_core has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: ros_gz_interfaces has been updated to a new version. local: 1.0.24 < latest: 1.0.25
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_voxel_grid has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: realsense2_description has been updated to a new version. local: 4.58.4 < latest: 4.59.1
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav_2d_utils has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_graceful_controller has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: opennav_docking_bt has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: position_controllers has been updated to a new version. local: 4.42.1 < latest: 4.43.0
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: tricycle_controller has been updated to a new version. local: 4.42.1 < latest: 4.43.0
  … (89 more)
SITE:
  
  All 5 checks passed
```
### IN9 term1 task 2 [MACHINE]: `ros2 doctor`
```text
REAL (exit 0):
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: dwb_plugins has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_loopback_sim has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: range_sensor_broadcaster has been updated to a new version. local: 4.42.1 < latest: 4.43.0
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: controller_manager has been updated to a new version. local: 4.48.1 < latest: 4.49.0
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_behaviors has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_core has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: ros_gz_interfaces has been updated to a new version. local: 1.0.24 < latest: 1.0.25
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_voxel_grid has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: realsense2_description has been updated to a new version. local: 4.58.4 < latest: 4.59.1
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav_2d_utils has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_graceful_controller has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: opennav_docking_bt has been updated to a new version. local: 1.3.13 < latest: 1.3.14
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: position_controllers has been updated to a new version. local: 4.42.1 < latest: 4.43.0
  /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: tricycle_controller has been updated to a new version. local: 4.42.1 < latest: 4.43.0
  … (89 more)
SITE:
  
  All 5 checks passed
```
### IN9 term1 task 3 [MACHINE]: `ros2 pkg list | wc -l`
```text
REAL (exit 0):
  660
SITE:
  52
```
### IN10 term1 task 1 [FIXTURE?]: `echo $ROS_DOMAIN_ID`
```text
REAL (exit 0):
  52
SITE:
  
```
### IN10 term1 task 4 [SITE]: `ros2 daemon stop`
```text
REAL (exit 0):
  The daemon is not running
SITE:
  The daemon has been stopped
```
### IN11 term1 task 1 [SITE]: `ros2 topic info -v /chatter`
```text
REAL (exit 0):
  Type: std_msgs/msg/String
  
  Publisher count: 1
  
  Node name: talker
  Node namespace: /
  Topic type: std_msgs/msg/String
  Topic type hash: RIHS01_df668c740482bbd48fb39d76a70dfd4bd59db1288021743503259e948f6b1a18
  Endpoint type: PUBLISHER
  GID: 01.0f.17.2e.d8.2d.31.4a.00.00.00.00.00.00.14.03
  QoS profile:
    Reliability: RELIABLE
    History (Depth): UNKNOWN
    Durability: VOLATILE
  … (21 more)
SITE:
  Type: std_msgs/msg/String
  
  Publisher count: 1
  
  Node name: talker
  Node namespace: /
  Topic type: std_msgs/msg/String
  Topic type hash: RIHS01_…
  Endpoint type: PUBLISHER
  GID: b7.75.f6.ef.ef.53.fb.b3.62.f5.f7.1d.ad.7a.58.75
  QoS profile:
    Reliability: RELIABLE
    History (Depth): UNKNOWN
    Durability: VOLATILE
  … (22 more)
```
