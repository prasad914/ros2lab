# Interbotix WX250s – ROS2LAB-PORT (build fixes on the maker's jazzy branches; fake hardware, NOT Gazebo)

Sources (maker only, ~/robots_ws/src/interbotix/):
- `Interbotix/interbotix_ros_core` branch `jazzy` 41ca7357 – unchanged code. Its earlier working-tree state was saved to
  `pre_build_state.txt` and stashed (`stash@{0}: On jazzy: pre-p2b-2026-10-18`, recoverable with `git stash pop`; not
  discarded). Afterwards `interbotix_ros_xseries/COLCON_IGNORE` was removed and the submodules dynamixel_workbench_toolbox
  (3ed8229) and interbotix_xs_driver (da27b8b) initialised, as the maker's install script does.
- `Interbotix/interbotix_ros_toolboxes` origin/jazzy 27f7628e → local branch `jazzy-ros2lab`, two commits:
  1. 9eae204 `interbotix_xs_ros_control`: drop `#include "hardware_interface/visibility_control.h"`. Build error before
     (build_attempt1.log / build_summary.txt): `xs_hardware_interface.hpp:43:10: fatal error:
     hardware_interface/visibility_control.h: No such file or directory` – the header is not in Jazzy hardware_interface.
  2. 9230216 `interbotix_xs_ros_control`: remove the `std::string get_name() const final` override (not virtual in the
     Jazzy SystemInterface, so `final` does not compile).
  Working tree: COLCON_IGNORE removed from interbotix_moveit_interface and interbotix_moveit_interface_msgs (as the
  maker's install script does).
- `Interbotix/interbotix_ros_manipulators` origin/jazzy 01c557d6 → local branch `jazzy-ros2lab`, one commit:
  3. e8c748c `interbotix_xsarm_descriptions/urdf/control.urdf.xacro` line 19: `fake_components/GenericSystem` →
     `mock_components/GenericSystem`. Launch error before (parity/fixtures/wx250s/sim_attempt1_fake_components/logs):
     `According to the loaded plugin descriptions the class fake_components/GenericSystem with base class type
     hardware_interface::SystemInterface does not exist. Declared types are ... mock_components/GenericSystem ...`

  For M1 (MoveIt), three more commits on the same branch (no rebuild: the launch and config files are symlinked):
  4. a1ad904 `interbotix_xsarm_moveit/launch/xsarm_moveit.launch.py`: pipeline parameters in the Jazzy MoveIt 2.12 form.
     Error before (`parity/fixtures/wx250s/moveit_attempt1_move_group_crash/logs`): move_group `terminate called after
     throwing an instance of 'rclcpp::ParameterTypeException' what(): expected [string_array] got [string]`. The maker's
     `planning_plugin` string became `planning_plugins: [ompl_interface/OMPLPlanner]`. Its request_adapters string
     mapped onto the installed adapter plugins as follows:
     - FixWorkspaceBounds → ValidateWorkspaceBounds
     - FixStartStateBounds → CheckStartStateBounds
     - FixStartStateCollision → CheckStartStateCollision
     - AddTimeOptimalParameterization → `response_adapters`
     - FixStartStatePathConstraints: no Jazzy plugin (`default_request_adapters_plugin_description.xml`), so it was dropped.
  5. 7f38b2d `interbotix_xsarm_moveit/config/kinematics.yaml`: `lma_kinematics_plugin/LMAKinematicsPlugin` →
     `kdl_kinematics_plugin/KDLKinematicsPlugin`. Error before: `The kinematics plugin
     (lma_kinematics_plugin/LMAKinematicsPlugin) failed to load ... Declared types are cached_ik_kinematics_plugin/...
     kdl_kinematics_plugin/KDLKinematicsPlugin ...`. IK results therefore come from KDL, not the maker's LMA choice.
  6. e5087da `xsarm_moveit.launch.py`: remap `/joint_states` → `/<robot_name>/joint_states` for move_group. Before
     (`moveit_attempt2_no_joint_states/`): every execution CONTROL_FAILED, `Didn't receive robot state (joint angles)
     with recent timestamp within 1.000000 seconds ... latest received state has time 0.000000`, while the joint states
     were on /wx250s/joint_states (the maker's `planning_scene_monitor_options.joint_state_topic` did not take effect).

Build: `colcon build --symlink-install --packages-up-to interbotix_xsarm_ros_control interbotix_xsarm_moveit` →
`Summary: 13 packages finished [44.2s]` (build_summary.txt).

What is compared: `ros2 launch interbotix_xsarm_ros_control xsarm_ros_control.launch.py robot_model:=wx250s
hardware_type:=fake use_rviz:=false` – the maker's ros2_control stack with mock hardware, namespace `/wx250s`
(controllers under `/wx250s/controller_manager`, joint states on `/wx250s/joint_states`). This is NOT a physics
simulation: the maker's simulation is Gazebo Classic (`interbotix_xsarm_sim/launch/xsarm_gz_classic.launch.py`,
`hardware_type='gz_classic'`), which Jazzy does not have. A Gazebo Harmonic port was not done (PENDING).
M1 compares against `xsarm_moveit.launch.py robot_model:=wx250s hardware_type:=fake use_moveit_rviz:=false` with fixes 4–6.
