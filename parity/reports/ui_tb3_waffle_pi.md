# UI & Concept Hierarchy Review: TurtleBot3 Waffle Pi (tb3_waffle_pi)

**Evaluation Date:** 2026-10-16  
**Reference Specification:** `parity/reference/nav2_jazzy_spec.md` (S12)  
**Robot ID:** `tb3_waffle_pi`  
**Status:** PASS (with noted polish items)

---

## Item-by-Item Review

### 1. The 10 Levels Exist in Order
- **Status:** PASS
- **Details:** The left-rail stepper correctly presents all 10 levels in the exact required order:
  1. Robot & URDF/TF
  2. Sensors
  3. Teleop & odometry
  4. Mapping
  5. Localization
  6. Costmaps
  7. Global planning
  8. Local control
  9. Behaviour trees & recoveries
  10. Missions
- **Screenshot Path:** `parity/reports/screenshots/tb3_waffle_pi_levels_order.png`

### 2. Level Content Structure (Concept Text, "Try it", ROS 2 Panel, Check Yourself)
- **Status:** PASS
- **Details:** Each level contains:
  - One short concept text matching `parity/reference/concepts.md` (all paragraphs under ~40 words, no long blocks).
  - A functional "Try it" control executing the corresponding ROS 2 launch command or action.
  - A "What real ROS 2 shows" panel detailing active topics, message types, QoS policies, TF frames, and terminal commands.
  - A "Check yourself" validation task.
- **Screenshot Path:** `parity/reports/screenshots/tb3_waffle_pi_level_detail.png`

### 3. Navigation Locks & Prerequisites
- **Status:** PASS
- **Details:** Navigation levels (6 through 10) are correctly locked until a map + localization (AMCL) or SLAM (`slam_toolbox` / `cartographer`) is active. The lock banner clearly explains why ("Navigation requires an active map and localization or SLAM session. Start mapping or localization in levels 4-5 first.").
- **Screenshot Path:** `parity/reports/screenshots/tb3_waffle_pi_nav_locked.png`

### 4. Layout & Dual View Synchronisation
- **Status:** PASS
- **Details:** 
  - Top bar displays robot (`tb3_waffle_pi`), world (`turtlebot3_world`), and active mode (Mapping / Localization / Navigation).
  - Left rail contains the 10-level stepper.
  - Centre split shows Gazebo-like 3D view alongside the RViz-like view with camera view switching (Orbit <-> TopDownOrtho).
  - Right panel holds the Displays tree and Tool Properties.
  - Bottom bar provides the RViz toolbar and topic/TF inspector.
  - State comparison via `window.__ros2lab` confirms both centre views render the exact same robot pose simultaneously.
- **Screenshot Path:** `parity/reports/screenshots/tb3_waffle_pi_layout.png`

### 5. Robot Truth & Sensor Capabilities
- **Status:** PASS
- **Details:** `tb3_waffle_pi` accurately reflects the real hardware and workspace definition: features LDS-01 LiDAR (`/scan`), IMU (`/imu`), odometry (`/odom`), and the Raspberry Pi Camera v2 (`/camera/image_raw`, `/camera/camera_info`), while correctly omitting unsupported features like depth camera / PointCloud2 (unlike `tb3_waffle_depth`). Non-standard or variant badges render correctly where applicable.
- **Screenshot Path:** `parity/reports/screenshots/tb3_waffle_pi_sensors.png`

### 6. Usability, Responsiveness & Accessibility
- **Status:** PASS
- **Details:** 
  - Tested at 375 px (mobile viewport) and 1280 px (desktop) wide; zero page-level horizontal scroll.
  - Keyboard navigation successfully reaches all controls with visible focus rings (`:focus-visible`).
  - Icon-only buttons feature clear tooltips and `aria-label` attributes.
  - Error messages output the faithful ROS 2 text first, followed by a beginner-friendly hint.
- **Screenshot Path:** `parity/reports/screenshots/tb3_waffle_pi_responsive.png`

### 7. Technical Accuracy of Concept Texts
- **Status:** PASS
- **Details:** Concept texts align precisely with `parity/reference/concepts.md` and ROS 2 Jazzy technical specifications (e.g. `TwistStamped` on `/cmd_vel_nav` / `/cmd_vel`, lifecycle node states, AMCL particle filter mechanics).

---

## Concrete Fixes & Recommendations for Emulator-Fixer
1. **Focus Ring Contrast:** Ensure all interactive elements in the left stepper maintain at least 3:1 contrast ratio on focus.
2. **Tooltip Timing:** Add a 300ms hover delay on icon-only toolbar tooltips for improved desktop ergonomics.
