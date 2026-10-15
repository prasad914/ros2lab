#!/usr/bin/env bash
# Answer the [VERIFY] items in docs/reference/nav2_jazzy_spec.md from the installed files.
# Run scripts/capture_installed.sh first. Writes tests/fixtures/_installed/facts.md (raw evidence, no interpretation).
set -u
set +u
source /opt/ros/jazzy/setup.bash
set -u
I=tests/fixtures/_installed
F=$I/facts.md
[ -d "$I" ] || { echo "run scripts/capture_installed.sh first"; exit 1; }

sec() { printf '\n## %s\n```\n' "$1" >> "$F"; }
end() { printf '```\n' >> "$F"; }
has_pkg() { grep -qx "$1" "$I/ros2_pkg_list.txt" && echo "INSTALLED: $1" || echo "NOT INSTALLED: $1"; }

{ echo "# Facts from installed Jazzy packages"; echo "Generated $(date -Iseconds). Raw grep output – read it, do not assume."; } > "$F"

sec "Optional packages present?"
for p in nav2_route opennav_docking nav2_graceful_controller nav2_rotation_shim_controller \
         nav2_mppi_controller nav2_regulated_pure_pursuit_controller nav2_theta_star_planner \
         nav2_smac_planner nav2_loopback_sim nav2_collision_monitor turtlebot4_gz_bringup \
         rosbridge_server foxglove_bridge robot_localization cartographer_ros; do has_pkg "$p"; done >> "$F"
grep -i vector "$I/ros2_pkg_list.txt" >> "$F" || echo "no package with 'vector' in its name (Vector Pursuit not installed)" >> "$F"
end

sec "cmd_vel type in TurtleBot3 Gazebo bridge YAML"
grep -rn -B2 -A4 'cmd_vel' "$I/turtlebot3_gazebo/params" 2>/dev/null >> "$F" || echo "bridge yaml not found" >> "$F"
end

sec "enable_stamped_cmd_vel in installed params"
grep -rn 'enable_stamped_cmd_vel' "$I" 2>/dev/null >> "$F" || echo "not found" >> "$F"
end

sec "Camera / depth sensors per TB3 model.sdf"
for m in "$I"/turtlebot3_gazebo/models/turtlebot3_*; do
  [ -d "$m" ] || continue
  echo "== $(basename "$m")"
  grep -n -E '<sensor |<topic>|camera_info_topic|gz_frame_id|<horizontal_fov>|<width>|<height>|<update_rate>' "$m"/*.sdf 2>/dev/null
done >> "$F"
end

sec "Planner / controller plugins and key defaults in nav2_params.yaml (nav2_bringup)"
grep -n -E 'plugin:|use_astar|motion_model|time_steps|model_dt|min_particles|max_particles|laser_model_type|robot_model_type|set_initial_pose|alpha[1-5]|base_frame_id|global_frame|rolling_window|width:|height:|resolution:|inflation_radius|cost_scaling_factor|robot_radius' \
  "$I"/nav2_bringup/params/nav2_params.yaml >> "$F" 2>/dev/null || echo "nav2_params.yaml not found" >> "$F"
end

sec "Same keys in TurtleBot3 navigation2 params (per model)"
for f in "$I"/turtlebot3_navigation2/param/*; do
  echo "== $(basename "$f")"
  grep -n -E 'plugin:|min_particles|max_particles|inflation_radius|cost_scaling_factor|robot_radius|enable_stamped_cmd_vel|global_frame|width:|height:' "$f"
done >> "$F" 2>/dev/null
end

sec "RViz display plugins available (DepthCloud? ParticleCloud?)"
grep -rhoE 'name="[^"]+"' "$I/rviz_default_plugins" "$I/nav2_rviz_plugins" 2>/dev/null | sort -u >> "$F"
end

sec "RViz defaults in nav2_default_view.rviz (Frame Rate, Fixed Frame, TF Frame Timeout)"
grep -n -E 'Frame Rate|Fixed Frame|Frame Timeout|Class: ' "$I"/nav2_bringup/rviz/nav2_default_view.rviz >> "$F" 2>/dev/null || echo "rviz file not found" >> "$F"
end

sec "SLAM Toolbox mode/params"
grep -n -E 'mode:|resolution:|map_update_interval|base_frame|odom_frame|map_frame|scan_topic' "$I"/slam_toolbox/config/*.yaml >> "$F" 2>/dev/null
end

echo "Wrote $F"
