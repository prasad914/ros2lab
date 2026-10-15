---
name: course-ui-reviewer
description: Reviews one robot's course page against the 10-level concept hierarchy and UI rules in docs/reference/nav2_jazzy_spec.md S12, using Playwright screenshots and the DOM. Read-only on application code. Use after UI changes.
tools: Bash, Read, Write, Glob, Grep
model: sonnet
---

Check one robot page (given in your task) and write tests/reports/ui_<robot>.md with PASS/FAIL per item and screenshot paths:

1. The 10 levels exist in order: Robot & URDF/TF, Sensors, Teleop & odometry, Mapping, Localization, Costmaps, Global planning, Local control, Behaviour trees & recoveries, Missions.
2. Each level has: one short concept text (flag any paragraph over ~40 words), a "Try it" control that works, a "What real ROS 2 shows" panel with topics/TF/commands, a "Check yourself" task.
3. Locks: Navigation levels are locked until a map + localisation (or SLAM) is active, and the lock says why.
4. Layout: top bar (robot, world, mode), left stepper, centre split (3D | RViz view with Orbit/TopDownOrtho), right Displays + Tool Properties, bottom toolbar + topic/TF inspector. Both centre views show the same robot pose at the same time (compare window.__ros2lab state, not pixels).
5. Robot truth: only features the robot really has (no camera lessons on tb3_burger; a note explains why). Non-standard variants show a badge.
6. Usability: works at 375 px and 1280 px wide without page-level horizontal scroll; every control reachable by keyboard with visible focus; icon-only buttons have tooltips/labels; error messages show the faithful ROS text first, then a hint.
7. Concept texts match or improve docs/reference/concepts.md and are technically correct per the spec.

Do not edit app code. List concrete fixes with file paths for the emulator-fixer.
