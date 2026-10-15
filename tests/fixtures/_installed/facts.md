# Facts from installed Jazzy packages
Generated 2026-10-15T11:47:13+05:30. Raw grep output – read it, do not assume.

## Optional packages present?
```
INSTALLED: nav2_route
INSTALLED: opennav_docking
INSTALLED: nav2_graceful_controller
INSTALLED: nav2_rotation_shim_controller
INSTALLED: nav2_mppi_controller
INSTALLED: nav2_regulated_pure_pursuit_controller
INSTALLED: nav2_theta_star_planner
INSTALLED: nav2_smac_planner
NOT INSTALLED: nav2_loopback_sim
INSTALLED: nav2_collision_monitor
NOT INSTALLED: turtlebot4_gz_bringup
INSTALLED: rosbridge_server
INSTALLED: foxglove_bridge
INSTALLED: robot_localization
INSTALLED: cartographer_ros
no package with 'vector' in its name (Vector Pursuit not installed)
```

## cmd_vel type in TurtleBot3 Gazebo bridge YAML
```
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_bridge.yaml-28-
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_bridge.yaml-29-# gz topic subscribed to by DiffDrive plugin
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_bridge.yaml:30:- ros_topic_name: "cmd_vel"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_bridge.yaml:31:  gz_topic_name: "cmd_vel"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_bridge.yaml-32-  ros_type_name: "geometry_msgs/msg/TwistStamped" # If you use Twist, you need to change the type to Twist
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_bridge.yaml-33-  gz_type_name: "gz.msgs.Twist"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_bridge.yaml-34-  direction: ROS_TO_GZ
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_bridge.yaml-35-
--
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_cam_bridge.yaml-28-
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_cam_bridge.yaml-29-# gz topic subscribed to by DiffDrive plugin
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_cam_bridge.yaml:30:- ros_topic_name: "cmd_vel"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_cam_bridge.yaml:31:  gz_topic_name: "cmd_vel"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_cam_bridge.yaml-32-  ros_type_name: "geometry_msgs/msg/TwistStamped"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_cam_bridge.yaml-33-  gz_type_name: "gz.msgs.Twist"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_cam_bridge.yaml-34-  direction: ROS_TO_GZ
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_burger_cam_bridge.yaml-35-
--
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_bridge.yaml-28-
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_bridge.yaml-29-# gz topic subscribed to by DiffDrive plugin
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_bridge.yaml:30:- ros_topic_name: "cmd_vel"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_bridge.yaml:31:  gz_topic_name: "cmd_vel"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_bridge.yaml-32-  ros_type_name: "geometry_msgs/msg/TwistStamped"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_bridge.yaml-33-  gz_type_name: "gz.msgs.Twist"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_bridge.yaml-34-  direction: ROS_TO_GZ
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_bridge.yaml-35-
--
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_pi_bridge.yaml-28-
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_pi_bridge.yaml-29-# gz topic subscribed to by DiffDrive plugin
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_pi_bridge.yaml:30:- ros_topic_name: "cmd_vel"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_pi_bridge.yaml:31:  gz_topic_name: "cmd_vel"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_pi_bridge.yaml-32-  ros_type_name: "geometry_msgs/msg/TwistStamped"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_pi_bridge.yaml-33-  gz_type_name: "gz.msgs.Twist"
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_pi_bridge.yaml-34-  direction: ROS_TO_GZ
tests/fixtures/_installed/turtlebot3_gazebo/params/turtlebot3_waffle_pi_bridge.yaml-35-
```

## enable_stamped_cmd_vel in installed params
```
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle.yaml:99:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle.yaml:161:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle.yaml:317:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle.yaml:340:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle.yaml:433:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger_cam.yaml:99:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger_cam.yaml:161:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger_cam.yaml:317:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger_cam.yaml:340:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger_cam.yaml:433:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle_pi.yaml:99:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle_pi.yaml:161:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle_pi.yaml:317:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle_pi.yaml:340:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/waffle_pi.yaml:433:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger.yaml:99:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger.yaml:161:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger.yaml:317:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger.yaml:340:    enable_stamped_cmd_vel: true
tests/fixtures/_installed/turtlebot3_navigation2/param/burger.yaml:433:    enable_stamped_cmd_vel: true
not found
```

## Camera / depth sensors per TB3 model.sdf
```
== turtlebot3_burger
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model-1_4.sdf:44:      <sensor name="tb3_imu" type="imu">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model-1_4.sdf:46:        <update_rate>200</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model-1_4.sdf:132:      <sensor name="hls_lfcd_lds" type="ray">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model-1_4.sdf:136:        <update_rate>5</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model-1_4.sdf:371:      <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model-1_4.sdf:403:      <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf:48:      <sensor name="tb3_imu" type="imu">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf:50:        <update_rate>200</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf:51:        <topic>imu</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf:135:      <sensor name="hls_lfcd_lds" type="gpu_lidar">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf:139:        <update_rate>5</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf:140:        <topic>scan</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf:141:        <gz_frame_id>base_scan</gz_frame_id>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf:389:      <topic>cmd_vel</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf:401:      <topic>joint_states</topic>
== turtlebot3_burger_cam
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model-1_4.sdf:44:      <sensor name="tb3_imu" type="imu">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model-1_4.sdf:46:        <update_rate>200</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model-1_4.sdf:132:      <sensor name="hls_lfcd_lds" type="ray">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model-1_4.sdf:136:        <update_rate>5</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model-1_4.sdf:371:      <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model-1_4.sdf:403:      <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:48:      <sensor name="tb3_imu" type="imu">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:50:        <update_rate>200</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:51:        <topic>imu</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:135:      <sensor name="hls_lfcd_lds" type="gpu_lidar">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:139:        <update_rate>5</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:140:        <topic>scan</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:141:        <gz_frame_id>base_scan</gz_frame_id>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:339:      <sensor name="camera" type="wideanglecamera">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:342:        <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:343:        <topic>camera/image_raw</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:344:        <gz_frame_id>camera_rgb_frame</gz_frame_id>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:346:          <camera_info_topic>camera/camera_info</camera_info_topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:347:          <horizontal_fov>3.183</horizontal_fov>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:349:            <width>320</width>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:350:            <height>240</height>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:449:      <topic>cmd_vel</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_burger_cam/model.sdf:461:      <topic>joint_states</topic>
== turtlebot3_common
== turtlebot3_dqn_world
== turtlebot3_house
== turtlebot3_waffle
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:44:      <sensor name="tb3_imu" type="imu">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:46:        <update_rate>200</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:132:      <sensor name="hls_lfcd_lds" type="ray">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:136:        <update_rate>5</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:369:      <sensor name="camera" type="camera">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:372:        <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:374:          <horizontal_fov>1.02974</horizontal_fov>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:376:            <width>1920</width>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:377:            <height>1080</height>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:482:      <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model-1_4.sdf:514:      <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:48:      <sensor name="tb3_imu" type="imu">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:50:        <update_rate>200</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:51:        <topic>imu</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:135:      <sensor name="hls_lfcd_lds" type="gpu_lidar">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:139:        <update_rate>10</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:140:        <topic>scan</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:141:        <gz_frame_id>base_scan</gz_frame_id>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:374:      <sensor name="camera" type="camera">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:377:        <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:378:        <topic>camera/image_raw</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:379:        <gz_frame_id>camera_rgb_frame</gz_frame_id>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:381:          <camera_info_topic>camera/camera_info</camera_info_topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:382:          <horizontal_fov>1.02974</horizontal_fov>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:384:            <width>1920</width>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:385:            <height>1080</height>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:493:      <topic>cmd_vel</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf:505:      <topic>joint_states</topic>
== turtlebot3_waffle_pi
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:44:      <sensor name="tb3_imu" type="imu">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:46:        <update_rate>200</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:132:      <sensor name="hls_lfcd_lds" type="ray">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:136:        <update_rate>5</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:369:      <sensor name="camera" type="camera">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:372:        <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:374:          <horizontal_fov>1.085595</horizontal_fov>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:376:              <width>640</width>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:377:              <height>480</height>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:482:      <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model-1_4_.sdf:514:      <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:48:      <sensor name="tb3_imu" type="imu">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:50:        <update_rate>200</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:51:        <topic>imu</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:135:      <sensor name="hls_lfcd_lds" type="gpu_lidar">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:139:        <update_rate>10</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:140:        <topic>scan</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:141:        <gz_frame_id>base_scan</gz_frame_id>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:374:      <sensor name="camera" type="camera">
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:377:        <update_rate>30</update_rate>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:378:        <topic>camera/image_raw</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:379:        <gz_frame_id>camera_rgb_frame</gz_frame_id>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:381:          <camera_info_topic>camera/camera_info</camera_info_topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:382:          <horizontal_fov>1.085595</horizontal_fov>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:384:              <width>640</width>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:385:              <height>480</height>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:493:      <topic>cmd_vel</topic>
tests/fixtures/_installed/turtlebot3_gazebo/models/turtlebot3_waffle_pi/model.sdf:505:      <topic>joint_states</topic>
== turtlebot3_world
```

## Planner / controller plugins and key defaults in nav2_params.yaml (nav2_bringup)
```
3:    alpha1: 0.2
4:    alpha2: 0.2
5:    alpha3: 0.2
6:    alpha4: 0.2
7:    alpha5: 0.2
8:    base_frame_id: "base_footprint"
13:    global_frame_id: "map"
18:    laser_model_type: "likelihood_field"
20:    max_particles: 2000
21:    min_particles: 500
28:    robot_model_type: "nav2_amcl::DifferentialMotionModel"
43:    global_frame: map
52:      plugin: "nav2_bt_navigator::NavigateToPoseNavigator"
54:      plugin: "nav2_bt_navigator::NavigateThroughPosesNavigator"
83:      plugin: "nav2_controller::SimpleProgressChecker"
88:    #  plugin: "nav2_controller::SimpleGoalChecker"
94:      plugin: "nav2_controller::SimpleGoalChecker"
98:      plugin: "nav2_mppi_controller::MPPIController"
99:      time_steps: 56
100:      model_dt: 0.05
119:      motion_model: "DiffDrive"
193:      global_frame: odom
195:      rolling_window: true
196:      width: 3
197:      height: 3
198:      resolution: 0.05
199:      robot_radius: 0.22
202:        plugin: "nav2_costmap_2d::InflationLayer"
203:        cost_scaling_factor: 3.0
204:        inflation_radius: 0.70
206:        plugin: "nav2_costmap_2d::VoxelLayer"
210:        z_resolution: 0.05
212:        max_obstacle_height: 2.0
217:          max_obstacle_height: 2.0
226:        plugin: "nav2_costmap_2d::StaticLayer"
235:      global_frame: map
237:      robot_radius: 0.22
238:      resolution: 0.05
242:        plugin: "nav2_costmap_2d::ObstacleLayer"
247:          max_obstacle_height: 2.0
256:        plugin: "nav2_costmap_2d::StaticLayer"
259:        plugin: "nav2_costmap_2d::InflationLayer"
260:        cost_scaling_factor: 3.0
261:        inflation_radius: 0.7
284:      plugin: "nav2_navfn_planner::NavfnPlanner"
286:      use_astar: false
293:      plugin: "nav2_smoother::SimpleSmoother"
307:      plugin: "nav2_behaviors::Spin"
309:      plugin: "nav2_behaviors::BackUp"
311:      plugin: "nav2_behaviors::DriveOnHeading"
313:      plugin: "nav2_behaviors::Wait"
315:      plugin: "nav2_behaviors::AssistedTeleop"
317:    global_frame: map
330:    waypoint_task_executor_plugin: "wait_at_waypoint"
332:      plugin: "nav2_waypoint_follower::WaitAtWaypoint"
347:      plugin: "nav2_route::ReroutingService"
349:      plugin: "nav2_route::AdjustSpeedLimit"
351:      plugin: "nav2_route::CollisionMonitor"
355:      plugin: "nav2_route::DistanceScorer"
357:      plugin: "nav2_route::CostmapScorer"
376:    base_frame_id: "base_footprint"
401:      min_height: 0.15
402:      max_height: 2.0
422:      plugin: 'opennav_docking::SimpleChargingDock'
460:    base_frame_id: "base_footprint"
```

## Same keys in TurtleBot3 navigation2 params (per model)
```
== burger_cam.yaml
13:    global_frame_id: "map"
20:    max_particles: 2000
21:    min_particles: 500
52:    global_frame: map
64:      plugin: "nav2_bt_navigator::NavigateToPoseNavigator"
66:      plugin: "nav2_bt_navigator::NavigateThroughPosesNavigator"
85:      plugin: 'opennav_docking::SimpleChargingDock'
99:    enable_stamped_cmd_vel: true
112:      plugin: "nav2_controller::SimpleProgressChecker"
117:      plugin: "nav2_controller::SimpleGoalChecker"
121:      plugin: "dwb_core::DWBLocalPlanner"
161:    enable_stamped_cmd_vel: true
168:      global_frame: odom
171:      width: 3
172:      height: 3
174:      robot_radius: 0.1
177:        plugin: "nav2_costmap_2d::InflationLayer"
178:        inflation_radius: 0.5
179:        cost_scaling_factor: 5.0
181:        plugin: "nav2_costmap_2d::ObstacleLayer"
186:          max_obstacle_height: 2.0
191:        plugin: "nav2_costmap_2d::VoxelLayer"
197:        max_obstacle_height: 2.0
202:          max_obstacle_height: 2.0
219:      global_frame: map
222:      robot_radius: 0.1
227:        plugin: "nav2_costmap_2d::ObstacleLayer"
232:          max_obstacle_height: 2.0
241:        plugin: "nav2_costmap_2d::VoxelLayer"
247:        max_obstacle_height: 2.0
252:          max_obstacle_height: 2.0
261:        plugin: "nav2_costmap_2d::StaticLayer"
265:        plugin: "nav2_costmap_2d::InflationLayer"
266:        inflation_radius: 0.5
267:        cost_scaling_factor: 5.0
286:      plugin: "nav2_navfn_planner::NavfnPlanner"
300:      plugin: "nav2_behaviors::Spin" # In Iron and older versions, "/" was used instead of "::"
302:      plugin: "nav2_behaviors::BackUp" # In Iron and older versions, "/" was used instead of "::"
304:      plugin: "nav2_behaviors::DriveOnHeading" # In Iron and older versions, "/" was used instead of "::"
306:      plugin: "nav2_behaviors::Wait" # In Iron and older versions, "/" was used instead of "::"
308:      plugin: "nav2_behaviors::AssistedTeleop" # In Iron and older versions, "/" was used instead of "::"
310:    global_frame: map
317:    enable_stamped_cmd_vel: true
323:    waypoint_task_executor_plugin: "wait_at_waypoint"
325:      plugin: "nav2_waypoint_follower::WaitAtWaypoint"
340:    enable_stamped_cmd_vel: true
433:    enable_stamped_cmd_vel: true
== burger.yaml
13:    global_frame_id: "map"
20:    max_particles: 2000
21:    min_particles: 500
52:    global_frame: map
64:      plugin: "nav2_bt_navigator::NavigateToPoseNavigator"
66:      plugin: "nav2_bt_navigator::NavigateThroughPosesNavigator"
85:      plugin: 'opennav_docking::SimpleChargingDock'
99:    enable_stamped_cmd_vel: true
112:      plugin: "nav2_controller::SimpleProgressChecker"
117:      plugin: "nav2_controller::SimpleGoalChecker"
121:      plugin: "dwb_core::DWBLocalPlanner"
161:    enable_stamped_cmd_vel: true
168:      global_frame: odom
171:      width: 3
172:      height: 3
174:      robot_radius: 0.1
177:        plugin: "nav2_costmap_2d::InflationLayer"
178:        inflation_radius: 0.5
179:        cost_scaling_factor: 5.0
181:        plugin: "nav2_costmap_2d::ObstacleLayer"
186:          max_obstacle_height: 2.0
191:        plugin: "nav2_costmap_2d::VoxelLayer"
197:        max_obstacle_height: 2.0
202:          max_obstacle_height: 2.0
219:      global_frame: map
222:      robot_radius: 0.1
227:        plugin: "nav2_costmap_2d::ObstacleLayer"
232:          max_obstacle_height: 2.0
241:        plugin: "nav2_costmap_2d::VoxelLayer"
247:        max_obstacle_height: 2.0
252:          max_obstacle_height: 2.0
261:        plugin: "nav2_costmap_2d::StaticLayer"
265:        plugin: "nav2_costmap_2d::InflationLayer"
266:        inflation_radius: 0.5
267:        cost_scaling_factor: 5.0
286:      plugin: "nav2_navfn_planner::NavfnPlanner"
300:      plugin: "nav2_behaviors::Spin" # In Iron and older versions, "/" was used instead of "::"
302:      plugin: "nav2_behaviors::BackUp" # In Iron and older versions, "/" was used instead of "::"
304:      plugin: "nav2_behaviors::DriveOnHeading" # In Iron and older versions, "/" was used instead of "::"
306:      plugin: "nav2_behaviors::Wait" # In Iron and older versions, "/" was used instead of "::"
308:      plugin: "nav2_behaviors::AssistedTeleop" # In Iron and older versions, "/" was used instead of "::"
310:    global_frame: map
317:    enable_stamped_cmd_vel: true
323:    waypoint_task_executor_plugin: "wait_at_waypoint"
325:      plugin: "nav2_waypoint_follower::WaitAtWaypoint"
340:    enable_stamped_cmd_vel: true
433:    enable_stamped_cmd_vel: true
== humble
== waffle_pi.yaml
13:    global_frame_id: "map"
20:    max_particles: 2000
21:    min_particles: 500
52:    global_frame: map
64:      plugin: "nav2_bt_navigator::NavigateToPoseNavigator"
66:      plugin: "nav2_bt_navigator::NavigateThroughPosesNavigator"
85:      plugin: 'opennav_docking::SimpleChargingDock'
99:    enable_stamped_cmd_vel: true
112:      plugin: "nav2_controller::SimpleProgressChecker"
117:      plugin: "nav2_controller::SimpleGoalChecker"
121:      plugin: "dwb_core::DWBLocalPlanner"
161:    enable_stamped_cmd_vel: true
168:      global_frame: odom
171:      width: 3
172:      height: 3
174:      robot_radius: 0.15
177:        plugin: "nav2_costmap_2d::InflationLayer"
178:        inflation_radius: 0.5
179:        cost_scaling_factor: 5.0
181:        plugin: "nav2_costmap_2d::ObstacleLayer"
186:          max_obstacle_height: 2.0
191:        plugin: "nav2_costmap_2d::VoxelLayer"
197:        max_obstacle_height: 2.0
202:          max_obstacle_height: 2.0
219:      global_frame: map
222:      robot_radius: 0.15
227:        plugin: "nav2_costmap_2d::ObstacleLayer"
232:          max_obstacle_height: 2.0
241:        plugin: "nav2_costmap_2d::VoxelLayer"
247:        max_obstacle_height: 2.0
252:          max_obstacle_height: 2.0
261:        plugin: "nav2_costmap_2d::StaticLayer"
265:        plugin: "nav2_costmap_2d::InflationLayer"
266:        inflation_radius: 0.5
267:        cost_scaling_factor: 5.0
286:      plugin: "nav2_navfn_planner::NavfnPlanner"
300:      plugin: "nav2_behaviors::Spin" # In Iron and older versions, "/" was used instead of "::"
302:      plugin: "nav2_behaviors::BackUp" # In Iron and older versions, "/" was used instead of "::"
304:      plugin: "nav2_behaviors::DriveOnHeading" # In Iron and older versions, "/" was used instead of "::"
306:      plugin: "nav2_behaviors::Wait" # In Iron and older versions, "/" was used instead of "::"
308:      plugin: "nav2_behaviors::AssistedTeleop" # In Iron and older versions, "/" was used instead of "::"
310:    global_frame: map
317:    enable_stamped_cmd_vel: true
323:    waypoint_task_executor_plugin: "wait_at_waypoint"
325:      plugin: "nav2_waypoint_follower::WaitAtWaypoint"
340:    enable_stamped_cmd_vel: true
433:    enable_stamped_cmd_vel: true
== waffle.yaml
13:    global_frame_id: "map"
20:    max_particles: 2000
21:    min_particles: 500
52:    global_frame: map
64:      plugin: "nav2_bt_navigator::NavigateToPoseNavigator"
66:      plugin: "nav2_bt_navigator::NavigateThroughPosesNavigator"
85:      plugin: 'opennav_docking::SimpleChargingDock'
99:    enable_stamped_cmd_vel: true
112:      plugin: "nav2_controller::SimpleProgressChecker"
117:      plugin: "nav2_controller::SimpleGoalChecker"
121:      plugin: "dwb_core::DWBLocalPlanner"
161:    enable_stamped_cmd_vel: true
168:      global_frame: odom
171:      width: 3
172:      height: 3
174:      robot_radius: 0.15
177:        plugin: "nav2_costmap_2d::InflationLayer"
178:        inflation_radius: 0.5
179:        cost_scaling_factor: 5.0
181:        plugin: "nav2_costmap_2d::ObstacleLayer"
186:          max_obstacle_height: 2.0
191:        plugin: "nav2_costmap_2d::VoxelLayer"
197:        max_obstacle_height: 2.0
202:          max_obstacle_height: 2.0
219:      global_frame: map
222:      robot_radius: 0.15
227:        plugin: "nav2_costmap_2d::ObstacleLayer"
232:          max_obstacle_height: 2.0
241:        plugin: "nav2_costmap_2d::VoxelLayer"
247:        max_obstacle_height: 2.0
252:          max_obstacle_height: 2.0
261:        plugin: "nav2_costmap_2d::StaticLayer"
265:        plugin: "nav2_costmap_2d::InflationLayer"
266:        inflation_radius: 0.5
267:        cost_scaling_factor: 5.0
286:      plugin: "nav2_navfn_planner::NavfnPlanner"
300:      plugin: "nav2_behaviors::Spin" # In Iron and older versions, "/" was used instead of "::"
302:      plugin: "nav2_behaviors::BackUp" # In Iron and older versions, "/" was used instead of "::"
304:      plugin: "nav2_behaviors::DriveOnHeading" # In Iron and older versions, "/" was used instead of "::"
306:      plugin: "nav2_behaviors::Wait" # In Iron and older versions, "/" was used instead of "::"
308:      plugin: "nav2_behaviors::AssistedTeleop" # In Iron and older versions, "/" was used instead of "::"
310:    global_frame: map
317:    enable_stamped_cmd_vel: true
323:    waypoint_task_executor_plugin: "wait_at_waypoint"
325:      plugin: "nav2_waypoint_follower::WaitAtWaypoint"
340:    enable_stamped_cmd_vel: true
433:    enable_stamped_cmd_vel: true
```

## RViz display plugins available (DepthCloud? ParticleCloud?)
```
name="nav2_rviz_plugins/CostmapCostTool"
name="nav2_rviz_plugins/Docking"
name="nav2_rviz_plugins/GoalTool"
name="nav2_rviz_plugins/Navigation 2"
name="nav2_rviz_plugins/ParticleCloud"
name="nav2_rviz_plugins/Route Tool"
name="nav2_rviz_plugins/Selector"
name="rviz_default_plugins/AccelStamped"
name="rviz_default_plugins/Axes"
name="rviz_default_plugins/Camera"
name="rviz_default_plugins/CameraInfo"
name="rviz_default_plugins/DepthCloud"
name="rviz_default_plugins/Effort"
name="rviz_default_plugins/FluidPressure"
name="rviz_default_plugins/FocusCamera"
name="rviz_default_plugins/FPS"
name="rviz_default_plugins/FrameAligned"
name="rviz_default_plugins/Grid"
name="rviz_default_plugins/GridCells"
name="rviz_default_plugins/Illuminance"
name="rviz_default_plugins/Image"
name="rviz_default_plugins/Interact"
name="rviz_default_plugins/InteractiveMarkers"
name="rviz_default_plugins/LaserScan"
name="rviz_default_plugins/Map"
name="rviz_default_plugins/Marker"
name="rviz_default_plugins/MarkerArray"
name="rviz_default_plugins/Measure"
name="rviz_default_plugins/MoveCamera"
name="rviz_default_plugins/Odometry"
name="rviz_default_plugins/Orbit"
name="rviz_default_plugins/Path"
name="rviz_default_plugins/PointCloud"
name="rviz_default_plugins/PointCloud2"
name="rviz_default_plugins/PointStamped"
name="rviz_default_plugins/Polygon"
name="rviz_default_plugins/Pose"
name="rviz_default_plugins/PoseArray"
name="rviz_default_plugins/PoseWithCovariance"
name="rviz_default_plugins/PublishPoint"
name="rviz_default_plugins/Range"
name="rviz_default_plugins/RelativeHumidity"
name="rviz_default_plugins/RobotModel"
name="rviz_default_plugins/Select"
name="rviz_default_plugins/SetGoal"
name="rviz_default_plugins/SetInitialPose"
name="rviz_default_plugins/Temperature"
name="rviz_default_plugins/TF"
name="rviz_default_plugins/ThirdPersonFollower"
name="rviz_default_plugins/TopDownOrtho"
name="rviz_default_plugins/TwistStamped"
name="rviz_default_plugins/Wrench"
name="rviz_default_plugins/XYOrbit"
```

## RViz defaults in nav2_default_view.rviz (Frame Rate, Fixed Frame, TF Frame Timeout)
```
2:  - Class: rviz_common/Displays
12:  - Class: rviz_common/Selection
14:  - Class: rviz_common/Tool Properties
19:  - Class: rviz_common/Views
24:  - Class: nav2_rviz_plugins/Navigation 2
26:  - Class: nav2_rviz_plugins/Selector
28:  - Class: nav2_rviz_plugins/Docking
31:  Class: ""
35:      Class: rviz_default_plugins/Grid
49:      Reference Frame: <Fixed Frame>
52:      Class: rviz_default_plugins/RobotModel
77:    - Class: rviz_default_plugins/TF
81:      Frame Timeout: 15
129:      Class: rviz_default_plugins/LaserScan
152:      Use Fixed Frame: true
163:      Class: rviz_default_plugins/PointCloud2
185:      Use Fixed Frame: true
191:      Class: rviz_default_plugins/Map
212:      Class: nav2_rviz_plugins/ParticleCloud
227:    - Class: rviz_common/Group
232:          Class: rviz_default_plugins/Map
255:          Class: rviz_default_plugins/Map
277:          Class: rviz_default_plugins/Path
311:          Class: rviz_default_plugins/PointCloud2
333:          Use Fixed Frame: true
337:          Class: rviz_default_plugins/Polygon
351:    - Class: rviz_common/Group
356:          Class: rviz_default_plugins/Map
378:          Class: rviz_default_plugins/Path
404:        - Class: rviz_default_plugins/MarkerArray
417:          Class: rviz_default_plugins/Polygon
437:          Class: rviz_default_plugins/PointCloud2
459:          Use Fixed Frame: true
464:    - Class: rviz_common/Group
466:        - Class: rviz_default_plugins/Image
488:          Class: rviz_default_plugins/PointCloud2
510:          Use Fixed Frame: true
515:    - Class: rviz_default_plugins/MarkerArray
530:    Fixed Frame: map
531:    Frame Rate: 30
534:    - Class: rviz_default_plugins/MoveCamera
535:    - Class: rviz_default_plugins/Select
536:    - Class: rviz_default_plugins/FocusCamera
537:    - Class: rviz_default_plugins/Measure
539:    - Class: rviz_default_plugins/SetInitialPose
549:    - Class: rviz_default_plugins/PublishPoint
557:    - Class: nav2_rviz_plugins/GoalTool
560:      Class: rviz_default_plugins/TF
565:      Class: rviz_default_plugins/TopDownOrtho
575:      Target Frame: <Fixed Frame>
```

## SLAM Toolbox mode/params
```
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:14:    odom_frame: odom
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:15:    map_frame: map
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:16:    base_frame: base_footprint
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:17:    scan_topic: /scan
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:19:    mode: mapping
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:41:    map_update_interval: 5.0
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:42:    resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:70:    correlation_search_space_resolution: 0.01
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:75:    loop_search_space_resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_lifelong.yaml:84:    coarse_angle_resolution: 0.0349        
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:11:    odom_frame: odom
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:12:    map_frame: map
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:13:    base_frame: base_footprint
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:14:    scan_topic: /scan
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:15:    mode: mapping #localization
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:24:    map_update_interval: 5.0
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:25:    resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:52:    correlation_search_space_resolution: 0.01
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:57:    loop_search_space_resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_localization.yaml:67:    coarse_angle_resolution: 0.0349        
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:13:    odom_frame: odom
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:14:    map_frame: map
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:15:    base_frame: base_footprint
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:16:    scan_topic: /scan
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:18:    mode: mapping #localization
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:22:    map_update_interval: 10.0
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:23:    resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:31:    enable_interactive_mode: true
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:52:    correlation_search_space_resolution: 0.01
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:57:    loop_search_space_resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_offline.yaml:66:    coarse_angle_resolution: 0.0349        
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:13:    odom_frame: odom
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:14:    map_frame: map
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:15:    base_frame: base_footprint
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:16:    scan_topic: /scan
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:18:    mode: mapping #localization
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:30:    map_update_interval: 5.0
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:31:    resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:39:    enable_interactive_mode: true
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:60:    correlation_search_space_resolution: 0.01
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:65:    loop_search_space_resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_async.yaml:74:    coarse_angle_resolution: 0.0349        
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:13:    odom_frame: odom
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:14:    map_frame: map
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:15:    base_frame: base_footprint
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:16:    scan_topic: /scan
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:18:    mode: mapping #localization
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:30:    map_update_interval: 5.0
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:31:    resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:39:    enable_interactive_mode: true
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:60:    correlation_search_space_resolution: 0.01
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:65:    loop_search_space_resolution: 0.05
tests/fixtures/_installed/slam_toolbox/config/mapper_params_online_sync.yaml:74:    coarse_angle_resolution: 0.0349        
```
