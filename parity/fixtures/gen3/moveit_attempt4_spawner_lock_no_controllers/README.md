# gen3 M1 attempt 4 (2026-10-18 23:12-23:23, domain 48) – files NOT kept

This capture failed and its folder was overwritten by the rerun (attempt 5 = `../moveit/`): the files had never been
committed, so `git mv` of the overnight driver could not move them (mistake recorded in
`~/ros2lab-course/parity/reports/OVERNIGHT_2026-10-19.md`). Only the evidence below survives; nothing here is
reconstructed.

From the overnight driver's console log (moveit_capture.py output, verbatim):
```
[23:11:49] ===== gen3
kept as moveit_attempt3_collision_box_0.2m
Started moveit for gen3 on domain 48. Logs: parity/fixtures/gen3/moveit/logs  PIDs: /tmp/ros2lab_ref/48-moveit-20261018T231152-908030.pids
Note: TB4 Gazebo may start paused – if /clock does not advance, unpause it (gz service on the world control service) and record that in run_info.txt.
[23:12:42] /move_action present: 1
[23:20:14] move_group params: 3 lines
[23:21:39] moveit_capture.py
[23:22:56] capture exit 1
stopped domain 48; no processes with ROS_DOMAIN_ID=48 remain
[23:23:09] domain 48 empty after stop
[23:23:09] ===== gen3 done; capture:
SRDF/URDF from parameters robot_description_semantic / robot_description of /move_group
/move_group parameters: 151
group manipulator joints ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6', 'joint_7']; frame 
state_Home: accepted=True error_code=-4 CONTROL_FAILED points=48
state_Retract: accepted=True error_code=-4 CONTROL_FAILED points=48
state_Vertical: accepted=True error_code=-4 CONTROL_FAILED points=1
Traceback (most recent call last):
  File "/home/prasad/ros2lab-robots/parity/scripts/moveit_capture.py", line 454, in <module>
    raise SystemExit(main())
                     ^^^^^^
  File "/home/prasad/ros2lab-robots/parity/scripts/moveit_capture.py", line 357, in main
    tgt = {j: cur[j] for j in gj}
              ~~~^^^
KeyError: 'joint_1'
```
From `logs/moveit.log` of that run (read during the night before it was overwritten, counted with uniq): the four
spawners of kortex_sim_control.launch.py (joint_state_broadcaster, joint_trajectory_controller, twist_controller,
robotiq_gripper_controller) each printed "Failed to acquire lock in 20 seconds. Attempt 1 of 5 failed." and then
"[ERROR] ... Failed to acquire lock after multiple attempts." and died (exit code 1); `ros2 control list_controllers`
could not contact /controller_manager/list_controllers. The lock is ~/.ros/locks/ros2-control-controller-spawner.lock
(controller_manager/spawner.py:410). Which process held it is UNVERIFIED. A browser test gate ran on the same machine
at the time (CPU load); the rerun 20 min later started all controllers.
