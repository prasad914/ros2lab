# Nav2 Jazzy Reference Facts & Specification

This specification documents the exact architecture, coordinate conventions, message definitions, and algorithmic parameters of the ROS 2 Jazzy Navigation 2 (Nav2) stack, SLAM Toolbox, and RViz2 as implemented on Ubuntu 24.04 LTS.

---

## 1. REP-105 Coordinate Frames and TF Architecture

A valid ROS 2 mobile navigation system must maintain a **single-parent directed acyclic tree** for coordinate transformations:

```
map ──► odom ──► base_footprint ──► base_link ──┬──► base_scan (LiDAR)
                                                ├──► imu_link (IMU)
                                                ├──► camera_link (RGB-D)
                                                ├──► wheel_left_link
                                                └──► wheel_right_link
```

### Frame Definitions
1. **`map`**: World-fixed coordinate frame with origin at a known global coordinate or mapping origin. Discrete jumps occur due to localization updates (AMCL / SLAM loop closures). Continuous in world space.
2. **`odom`**: World-fixed coordinate frame where robot pose is continuous and smooth without discrete jumps. Susceptible to drift over time.
3. **`base_footprint`**: 2D projection of `base_link` onto the ground plane ($Z = 0$, roll = 0, pitch = 0, yaw = robot heading).
4. **`base_link`**: Rigidly attached robot coordinate center.
5. **Sensor Frames**: `base_scan` (LiDAR), `imu_link` (IMU), `camera_link` / `camera_rgb_frame` (optical frames).

### Single-Parent Invariant Rules
- The transform `map -> odom` must have **exactly one publisher** at any given moment:
  - When **AMCL** is running, AMCL broadcasts `map -> odom`.
  - When **SLAM Toolbox** or **Cartographer** is running, the SLAM node broadcasts `map -> odom`.
  - AMCL and SLAM must NEVER both broadcast `map -> odom` simultaneously.
  - When `set_initial_pose=false` (default Jazzy bringup), AMCL publishes NO transform until the user provides an initial pose on `/initialpose` or invokes `set_initial_pose`.
- The transform `odom -> base_footprint` is broadcasted exclusively by the odometry source (`diff_drive_controller`, Gazebo `DiffDrive` system, or EKF `robot_localization`).
- The transforms from `base_footprint -> base_link -> [sensors/wheels]` are static or joint-driven and broadcasted by `robot_state_publisher`.

---

## 2. Nav2 Costmaps (`nav2_costmap_2d`)

Nav2 utilizes layered 2D occupancy grids representing spatial obstacle risks:

### Global Costmap (`global_costmap`)
- **Coordinate Frame**: `map`
- **Layers**:
  1. `static_layer`: Populated from `map_server` occupancy grid (`nav_msgs/msg/OccupancyGrid`).
  2. `obstacle_layer` / `voxel_layer`: 2D raycasting from `/scan` laser scan ranges (`sensor_msgs/msg/LaserScan`) and 3D point clouds.
  3. `inflation_layer`: Inscribes robot footprint and exponentially decays risk out to `inflation_radius`.
- **Purpose**: Global path search across entire known map.

### Local Costmap (`local_costmap`)
- **Coordinate Frame**: `odom` (rolling window centered on robot base)
- **Default Dimensions**: 3.0 m × 3.0 m (rolling window)
- **Resolution**: 0.05 m/cell (60 × 60 cells)
- **Layers**:
  1. `obstacle_layer`: Real-time clearing and marking from LiDAR rays.
  2. `inflation_layer`: Inscribed radius + exponential decay.
- **Purpose**: Dynamic collision avoidance and local velocity trajectory evaluation.

### Cost Values (0 to 255)
| Value | Symbol | Semantic Meaning |
|---|---|---|
| `0` | `FREE_SPACE` | Clear area, safe to traverse |
| `1` - `252` | Decayed cost | Near obstacle; cost decays with distance |
| `253` | `INSCRIBED_INFLATED_OBSTACLE` | Inside robot inscribed radius (collision if robot center is here) |
| `254` | `LETHAL_OBSTACLE` | Physical obstacle detected |
| `255` | `NO_INFORMATION` | Unknown/unexplored cell |

### Exponential Inflation Formula
For distance $d$ between cell center and nearest obstacle:
- If $d \le r_{\text{inscribed}}$: $\text{cost} = 253$ (`INSCRIBED_INFLATED_OBSTACLE`)
- If $r_{\text{inscribed}} < d \le r_{\text{inflation}}$:
  $$\text{cost} = \lfloor 253 \cdot \exp\left( -\alpha \cdot (d - r_{\text{inscribed}}) \right) \rfloor$$
  where $\alpha = \text{cost\_scaling\_factor}$.
- If $d > r_{\text{inflation}}$: $\text{cost} = 0$.

---

## 3. Adaptive Monte Carlo Localization (`nav2_amcl`)

AMCL uses a KLD-sampling adaptive particle filter:
- **Motion Model**: `DifferentialMotionModel` with odometry noise parameters ($\alpha_1, \alpha_2, \alpha_3, \alpha_4, \alpha_5$).
- **Laser Model**: `likelihood_field` (computes probability of beam matching nearest map obstacle) or `beam`.
- **Particle Count**:
  - `min_particles`: 500
  - `max_particles`: 2000
- **Topics**:
  - Subscribes: `/scan` (`sensor_msgs/msg/LaserScan`), `/initialpose` (`geometry_msgs/msg/PoseWithCovarianceStamped`), `/map` (`nav_msgs/msg/OccupancyGrid`).
  - Publishes: `/amcl_pose` (`geometry_msgs/msg/PoseWithCovarianceStamped`), `/particle_cloud` (`nav2_msgs/msg/ParticleCloud` with individual particle weights), `/tf` (`map -> odom`).
- **Services**:
  - `reinitialize_global_localization` (`std_srvs/srv/Empty`): scatters particles across all free cells.
  - `request_nomotion_update` (`std_srvs/srv/Empty`): forces particle filter update without robot movement.
  - `set_initial_pose` (`nav2_msgs/srv/SetInitialPose`).

---

## 4. Nav2 Global Planners (`planner_server`)

Planners compute a collision-free path (`nav_msgs/msg/Path`) from start to goal on the global costmap:

1. **NavFn Planner (`nav2_navfn_planner::NavfnPlanner`)**:
   - Dijkstra or A* wavefront propagation on cost grid.
   - Smooth gradient descent along cost field.
2. **Smac Planner 2D (`nav2_smac_planner::SmacPlanner2D`)**:
   - 2D A* with 4-way or 8-way neighborhood with cost penalties.
3. **Smac Planner Hybrid-A* (`nav2_smac_planner::SmacPlannerHybrid`)**:
   - Kinematically feasible paths for non-holonomic robots (Ackermann, DiffDrive) with Dubins or Reeds-Shepp analytic expansions.
4. **Smac Planner Lattice (`nav2_smac_planner::SmacPlannerLattice`)**:
   - State lattice planner using pre-generated motion primitives.
5. **Theta* Planner (`nav2_theta_star_planner::ThetaStarPlanner`)**:
   - Any-angle path planning checking line-of-sight between non-adjacent cells.

---

## 5. Nav2 Local Planners / Controllers (`controller_server`)

Controllers generate velocity commands to follow the planned path while respecting kinematic limits and obstacle clearances:

1. **DWB Local Planner (`dwb_core::DWBLocalPlanner`)**:
   - Dynamic Window Approach generating forward trajectory velocity samples $(v, \omega)$.
   - Scored by critics: `GoalDist`, `PathDist`, `PathAlign`, `GoalAlign`, `BaseObstacle`, `RotateToGoal`.
2. **Regulated Pure Pursuit (`nav2_regulated_pure_pursuit_controller::RegulatedPurePursuitController`)**:
   - Geometric tracking of lookahead point on path.
   - Regulates speed when approaching sharp turns or obstacles.
3. **MPPI Controller (`nav2_mppi_controller::MPPIController`)**:
   - Model Predictive Path Integral controller.
   - Stochastically generates batches of rollouts optimized by dynamic model constraints.
4. **Rotation Shim Controller (`nav2_rotation_shim_controller::RotationShimController`)**:
   - Wrapper rotating the robot in place until heading matches path orientation before passing control to base controller.
5. **Command Velocity Output**:
   - ROS 2 Jazzy TurtleBot3: `geometry_msgs/msg/TwistStamped` on `/cmd_vel`.
   - Legacy / un-stamped: `geometry_msgs/msg/Twist` on `/cmd_vel`.

---

## 6. Behavior Tree Navigator (`bt_navigator`)

Coordinates navigation goals, planning loops, and recovery behaviors:
- **Actions**:
  - `navigate_to_pose` (`nav2_msgs/action/NavigateToPose`)
  - `navigate_through_poses` (`nav2_msgs/action/NavigateThroughPoses`)
- **Recoveries Pipeline**:
  - `ClearEntireCostmap`
  - `Spin` (in-place rotation)
  - `BackUp` (linear reverse motion)
  - `Wait` (brief pause for dynamic obstacles to clear)
  - `DriveOnHeading`

---

## 7. SLAM Toolbox (`slam_toolbox`)

Pose-graph SLAM based on Karto SLAM with Ceres scan-matching:
- **Modes**:
  - `online_async`: Real-time mapping on a background thread.
  - `online_sync`: Deterministic mapping synchronizing every laser scan.
  - `localization`: Pose graph localization against a serialized map.
- **RViz2 Plugin**: `slam_toolbox/SlamToolboxPlugin`
  - Save Map (`nav2_map_server` format)
  - Serialize Map (pose graph and laser data)
  - Deserialize Map (load existing graph)

---

## 8. RViz2 Navigation Tools & UI Contracts

1. **Fixed Frame**:
   - Must be dynamically selectable from all frames present in the TF tree buffer (e.g. `map`, `odom`, `base_footprint`, `base_link`).
   - Must also allow free-text input for anticipated frames.
   - If a frame is missing, RViz displays: `Global Status: Error` -> `Fixed Frame [X] does not exist` without crashing.
2. **2D Pose Estimate**:
   - Publishes `geometry_msgs/msg/PoseWithCovarianceStamped` on `/initialpose`.
   - Frame ID equals current `Fixed Frame`.
3. **2D Goal Pose**:
   - Publishes `geometry_msgs/msg/PoseStamped` on `/goal_pose`.
   - Frame ID equals current `Fixed Frame`.
4. **Publish Point**:
   - Publishes `geometry_msgs/msg/PointStamped` on `/clicked_point`.
5. **Camera Views**:
   - `Orbit`, `TopDownOrtho`, `ThirdPersonFollower` are view controllers over **one unified scene graph**.
