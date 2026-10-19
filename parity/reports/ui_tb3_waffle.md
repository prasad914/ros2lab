# UI Review: TurtleBot3 Waffle (Prompt P7, Spec S12)

- **Robot**: `tb3_waffle`
- **Category**: Mobile (Official Jazzy)
- **Review Date**: 2026-10-16
- **Test Tool**: Playwright & DOM / `window.__ros2lab` inspection

## Checklist & Findings (Spec S12)

### 1. The 10 levels exist in order
- **Status**: PASS
- **Details**: The left-rail stepper correctly presents all 10 levels in the exact required order:
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

### 2. Level components (Concept text, Try it, What real ROS 2 shows, Check yourself)
- **Status**: PASS
- **Details**: Each level contains:
  - One concise concept text (all paragraphs under ~40 words, matching `parity/reference/concepts.md`).
  - A functional "Try it" control executing the corresponding ROS 2 command.
  - A "What real ROS 2 shows" panel displaying expected topics, TF frames, and commands.
  - A "Check yourself" task for student verification.

### 3. Locks
- **Status**: PASS
- **Details**: Navigation levels (Costmaps, Global planning, Local control, Behaviour trees & recoveries, Missions) are correctly locked until an active map and localization (or SLAM) are established. The lock message explicitly explains why (e.g., missing map/localization).

### 4. Layout & State Synchronization
- **Status**: PASS
- **Details**: 
  - **Top bar**: Displays robot (`tb3_waffle`), world, and mode (Mapping / Localization / Navigation).
  - **Left stepper**: 10 pedagogical levels.
  - **Centre split**: Gazebo-like 3D view | RViz-like view with Orbit ↔ TopDownOrtho cameras. Both centre views synchronize robot pose via `window.__ros2lab` state.
  - **Right panel**: Displays tree + Tool Properties.
  - **Bottom toolbar**: RViz toolbar + topic/TF inspector.

### 5. Robot Truth
- **Status**: PASS
- **Details**: TurtleBot3 Waffle correctly features its real hardware capabilities: LDS-01 360-degree LiDAR (`/scan`), IMU (`/imu`), Odometry (`/odom`), and Intel RealSense RGB camera (`/camera/image_raw`, `/camera/camera_info`), without unsupported sensors (no depth camera or pointcloud2 on standard waffle).

### 6. Usability & Responsiveness
- **Status**: PASS
- **Details**: 
  - Verified at 1280 px (desktop) and 375 px (mobile) viewports without page-level horizontal scroll.
  - Every interactive control is keyboard accessible with visible focus rings.
  - Icon-only buttons include tooltips/labels.
  - Error messages display faithful ROS text first, followed by beginner hints.

### 7. Concept Texts & Technical Correctness
- **Status**: PASS
- **Details**: Concept texts strictly adhere to `parity/reference/concepts.md` and are technically correct per ROS 2 Jazzy specifications.

## Screenshots
- Desktop (1280 px): `/home/prasad/ros2lab-course/parity/reports/screenshots/tb3_waffle_1280.png`
- Mobile (375 px): `/home/prasad/ros2lab-course/parity/reports/screenshots/tb3_waffle_375.png`

**Verdict**: PASS
