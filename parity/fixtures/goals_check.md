# Ground Truth Goals Verification (turtlebot3_world)

This document verifies the robot start pose, 5 free navigation goals, and 1 obstacle goal against the real ROS 2 Jazzy SLAM map (`turtlebot3_world.yaml` / `turtlebot3_world.pgm`) captured during Prompt P2 Step 2.

## 1. Map Parameters & Coordinates

- **YAML File**: `parity/fixtures/maps/turtlebot3_world.yaml`
- **PGM File**: `parity/fixtures/maps/turtlebot3_world.pgm`
- **Resolution**: `0.050 m/pixel`
- **Origin**: `[-0.932, -2.095, 0.0]` (world coordinates of the lower-left grid cell `(x_cell=0, y_cell=0)`)
- **Dimensions**: `111` columns (width) $\times$ `103` rows (height) = 11,433 cells
- **Pixel Value Thresholds**:
  - `0`: Occupied (black)
  - `205`: Unknown (grey)
  - `254`: Free space (white)
- **Coordinate Conversion Formulas**:
  $$\text{cell}_x = \text{round}\left(\frac{x - \text{origin}_x}{\text{resolution}}\right)$$
  $$\text{cell}_y = \text{round}\left(\frac{y - \text{origin}_y}{\text{resolution}}\right)$$
  $$\text{pgm}_\text{col} = \text{cell}_x$$
  $$\text{pgm}_\text{row} = (\text{height} - 1) - \text{cell}_y$$

---

## 2. Start Pose Verification

### Launch File Defaults
In `/opt/ros/jazzy/share/turtlebot3_gazebo/launch/turtlebot3_world.launch.py`:
- `x_pose`: default `"-2.0"`
- `y_pose`: default `"-0.5"`
- Spawn command in `spawn_turtlebot3.launch.py`: robot model spawned at Gazebo world coordinates $(x=-2.0, y=-0.5, z=0.01)$.

### First `/odom` Message in Real Bag
Inspected from `parity/fixtures/tb3_burger/slam/bags/run1/run1_0.mcap`:
- `header.frame_id`: `"odom"`
- `child_frame_id`: `"base_footprint"`
- `pose.pose.position`: $x = 9.6008 \times 10^{-9}\text{ m}, y = -2.2140 \times 10^{-21}\text{ m}, z = 0.0\text{ m}$
- `pose.pose.orientation`: $x = 0.0, y = 0.0, z = -2.3025 \times 10^{-13}, w = 1.0$
- **Result**: The Gazebo diff-drive plugin zeroes odometry at spawn time. Thus, the origin of the `odom` frame coincides with the spawn location $(x=-2.0, y=-0.5)$ in Gazebo world coordinates.

### Map Frame Alignment
- When `slam_toolbox` initializes mapping with the robot stationary at spawn, it establishes the initial map frame rooted at the robot's initial odometry pose:
  $$\text{Initial } \mathbf{T}_\text{map}^\text{odom} = \begin{bmatrix} 0.0 \\ 0.0 \\ 0.0 \end{bmatrix}, \quad \mathbf{q} = \begin{bmatrix} 0 \\ 0 \\ 0 \\ 1 \end{bmatrix}$$
- Therefore, in the SLAM map coordinate system:
  $$\text{Robot Start Pose} = (x = 0.00\text{ m}, y = 0.00\text{ m}, \text{yaw} = 0.00\text{ rad})$$
- Corresponding map cell:
  $$\text{cell}_x = \text{round}\left(\frac{0.00 - (-0.932)}{0.050}\right) = 19$$
  $$\text{cell}_y = \text{round}\left(\frac{0.00 - (-2.095)}{0.050}\right) = 42$$
  $$\text{pgm}_\text{col} = 19, \quad \text{pgm}_\text{row} = 103 - 1 - 42 = 60$$
- **Cell Value**: `254` (FREE space)
- **Obstacle Clearance**: `0.541 m` (well above the 0.40 m clearance limit)
- **Initial Pose Covariance** (per Spec S4):
  $$\text{cov}[0] = 0.25\text{ (x)}, \quad \text{cov}[7] = 0.25\text{ (y)}, \quad \text{cov}[35] = 0.06853891909122467\text{ (yaw)}$$

---

## 3. Goals Verification Table

All goals were evaluated using Euclidean Distance Transform (`scipy.ndimage.distance_transform_edt`) against all occupied cells (`cell_value == 0`).

| Goal ID | Target Region | Metric Pose $(x, y, \text{yaw})$ | Grid Cell $(x, y)$ | PGM Pixel $(\text{col}, \text{row})$ | Cell Value | Status | Clearance to Obstacle | $\ge 0.40\text{ m}$? |
|---|---|---|---|---|---|---|---|---|
| **start_pose** | Spawn position | $(0.00, 0.00, 0.00)$ | $(19, 42)$ | $(19, 60)$ | `254` | FREE | $0.541\text{ m}$ | **PASS** |
| **goal1** | NW open area (North of start) | $(0.20, 1.00, 1.5708)$ | $(23, 62)$ | $(23, 40)$ | `254` | FREE | $0.711\text{ m}$ | **PASS** |
| **goal2** | NE open area | $(2.50, 1.95, 0.0000)$ | $(69, 81)$ | $(69, 21)$ | `254` | FREE | $0.495\text{ m}$ | **PASS** |
| **goal3** | Far East corridor | $(3.75, 0.50, -1.5708)$ | $(94, 52)$ | $(94, 50)$ | `254` | FREE | $0.550\text{ m}$ | **PASS** |
| **goal4** | South open corridor | $(2.00, -1.40, 3.1416)$ | $(59, 14)$ | $(59, 88)$ | `254` | FREE | $0.650\text{ m}$ | **PASS** |
| **goal5** | Central junction | $(1.50, 0.00, 0.0000)$ | $(49, 42)$ | $(49, 60)$ | `254` | FREE | $0.532\text{ m}$ | **PASS** |
| **obstacle_goal** | Inside central obstacle column | $(1.87, 0.40, 0.0000)$ | $(56, 50)$ | $(56, 52)$ | `0` | OCCUPIED | $0.000\text{ m}$ | **INTENDED OCCUPIED** |

---

## 4. Verification Summary

1. **Clearance Compliance**: All 5 navigation goals have a minimum clearance between $0.495\text{ m}$ and $0.711\text{ m}$ from the nearest obstacle, strictly exceeding the $\ge 0.40\text{ m}$ threshold.
2. **Spatial Distribution**:
   - `goal1` tests navigation northward past the initial obstacle cluster.
   - `goal2` tests navigation to the far northeast sector of the map.
   - `goal3` tests long-range transit across the full world width to the eastern corridor.
   - `goal4` tests navigation southward into the lower corridor.
   - `goal5` tests navigation to the central junction between obstacle clusters.
3. **Obstacle Test**: `obstacle_goal` is situated at cell $(56, 50)$ with value `0` (occupied cylinder), ensuring robust detection of planner rejection and recovery behaviors in Nav2 testing.
