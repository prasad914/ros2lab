# B5: `ros2 launch nav2_bringup tb4_simulation_launch.py headless:=True` (timeout 300), domain 47 / ref47, 2026-10-18 23:55

Tool: `parity/scripts/capture_tb4_nav2_bringup.sh`. Packages: `run_info.txt`. Launch exit 124 (stopped by timeout).
- **Gazebo world did not load**: `launch_log.txt:315-320` – Fuel download of `openrobotics/models/depot` got REST
  response code 502 from fuel.gazebosim.org; `Server.cc:86 Error Code 14 ... Unable to find uri
  [https://fuel.gazebosim.org/1.0/OpenRobotics/models/Depot]`; `[gz-6]: process has finished cleanly`.
- **create**: started (`launch_log.txt:7`), then only "Requesting list of world names." every 5 s until the timeout
  (`create_lines.txt`). It printed no "unknown command line flag" error and did not exit. Whether create spawns the
  TurtleBot 4 with this launch's arguments is UNVERIFIED (no world to spawn into).
- `error_lines.txt`: one rviz2 shader ERROR line besides the gz errors above. No `process has died`.
- Lifecycle at 150 s (`at_150s/lifecycle.txt`): amcl, map_server active; local_costmap activating [13];
  controller_server no answer; the other Nav2 servers inactive. `/odom` not published (`at_*/odom_once.txt`);
  gz world service timed out (`at_*/gz_models.txt`).
- At 270 s `ros2 node list` / `ros2 lifecycle nodes` returned nothing (`at_270s/`): not explained (UNVERIFIED).
Rerun when fuel.gazebosim.org serves the Depot model (or with it in the local Fuel cache) to answer the spawn question.
