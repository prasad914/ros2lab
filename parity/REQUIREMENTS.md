# Requirements checklist (kit v2) – every request, and where the kit handles it

| # | Your request | Where it is handled |
|---|---|---|
| 1 | TurtleBot3 loads in Gazebo and in RViz with 3D and 2D views separately | Spec S1 (one shared scene, 2D = TopDownOrtho camera); P3b; web-tester checks both views show the same pose |
| 2 | Check whether 2D Goal Pose and 2D Pose Estimate work for a given algorithm | Spec S4; P4 (tests per planner × controller); P2 step 5 captures every combination on real Jazzy; mistakes `goal_before_initial_pose`, `pose_estimate_during_slam`, `planner_switch_no_effect` |
| 3 | Different ways to use Nav2 for path planning | Spec S5 table (planners, controllers, behaviours, modes); P4, P6; course levels 7–10 (S12) |
| 4 | What is global map, local map, the Nav2 stack, costmap, AMCL | Spec S5–S8; short student cards in parity/reference/concepts.md; course levels 5–6 |
| 5 | Cannot select any Fixed Frame other than map | Spec S3 (real behaviour, 8 likely causes, fix, DevTools checks); P3e (failing test first, RCA document, fix); mistakes `wrong_fixed_frame`, `fixed_frame_typed_unknown`; game "TF Detective" |
| 6 | Other RViz functions for Nav2 and SLAM Toolbox not working | Spec S8, S10 (Navigation 2 panel, SlamToolboxPlugin, all displays); P6; P8 option-by-option audit |
| 7 | Adapt Nav2, costmaps, AMCL into RViz and Gazebo emulation | P6 (full stack, params from installed files); spec S6, S7, S11 |
| 8 | Arrange each robot's windows in a concept hierarchy, easy to use, short explanations | Spec S12 (10-level stepper, layout, locks); parity/reference/concepts.md; P7; course-ui-reviewer agent |
| 9 | Neat, interactive, user-friendly UI per robot, beginner to advanced | Spec S12; P7; course-ui-reviewer (layout, 375–1280 px, keyboard, tooltips, short text, robot-specific content) |
| 10 | Check every robot against real ROS 2 Jazzy with all packages installed | parity/scripts/check_env.sh, capture_installed.sh, verify_facts.sh; P0 step 4; P2; ros-reference agent; spec S13 |
| 11 | Use multiple agents to test every robot | .claude/agents (ros-reference, web-tester, parity-judge, student-persona, course-ui-reviewer, emulator-fixer); P7, P9, P10, P11 run them in parallel |
| 12 | Implement the exact working in the browser without mistakes | P3–P6 build to fixtures; P11 fix loop (failing test first, merge only when it passes); emulator-fixer forbids hard-coding |
| 13 | Review stable working combinations per robot and problems in real ROS 2 and browser | Spec S13; P0 step 4; P2 (UNVERIFIED list); verify_results.md; SUMMARY "UNVERIFIED robots" |
| 14 | How accurate the browser is per robot | Spec S14 metrics; parity-judge; thresholds.yaml (your limits); P13 SUMMARY + per-robot badge; no invented numbers |
| 15 | Correct Claude Code prompts; /deep-research, /paper-search, /engineering:code-review | parity/KICKOFF_PROMPT.md P0–P13; P13 uses /engineering:code-review and /paper-search if installed, otherwise does the same work directly |
| 16 | Add all tools required for autonomous navigation | Spec S11 inventory + bridge mappings; P6; parity/scripts/check_env.sh lists required and optional packages |
| 17 | Interesting tasks or games in the Playground after the stack works | parity/playground.md (15 games, learning goal, levels, checks, scoring); P12 with readiness gating |
| 18 | PointCloud2 and Image topics not working for TurtleBot | Spec S9 sensor truth table and emulation; P5; verify_facts.sh reads installed model.sdf; mistakes `image_on_burger`, `pointcloud_on_burger`, `pointcloud_on_scan`, `image_qos_mismatch`, `camera_display_no_info` |
| 19 | Check all options individually against real ROS 2 | Spec S10; P8 (one test per RViz element/property, real defaults from installed .rviz files); web-tester step 4 |
| 20 | Agents act as students doing the courses, make mistakes, check whether the errors match, and fix them | student-persona agent (4 personas); parity/mistakes.yaml (27 mistakes); P10; fixes in P11; course-text problems in COURSE_ISSUES.md |
| 21 | Paper search | parity/reference/papers.md (verified list + gaps); P13 step 4 re-verifies with /paper-search |
| 22 | Run it in Claude Code in the terminal against real ROS 2 Jazzy on Ubuntu | parity/README.md; parity/CLAUDE.md; .claude/settings.json permissions; headless scripts |
| 23 | Items the research could not confirm (cmd_vel type in TB3 bridge, Waffle Pi camera, Route Server, Vector Pursuit, DepthCloud, inflation values, RViz defaults, TB4 topics) | Marked [VERIFY] in the spec; answered from installed files by verify_facts.sh in P0; results in parity/reference/verify_results.md |
| 24 | Other robots on the site (TB4, Clearpath, Husarion, manipulators, etc.) | P0 step 4 lists them in parity/robots/STATUS.md; P2b installs and verifies them; P2c records mobile ones |
| 25 | Optional live ROS 2 mode | Spec S1 (bus designed to bind to rosbridge_suite + roslibjs or foxglove_bridge; ros2-web-bridge is archived) – not built by default |
| 26 | Install all robots; port Humble-only robots to Jazzy | P2b (strict: built + launched + moving, with evidence); parity/robots/STATUS.md, PORTING.md, scenarios/sim.sh; ROBOTS_WS via parity/scripts/env.sh |
| 27 | Never claim a robot works without proof | parity/CLAUDE.md rule 4 and STATUS columns Built / Verified; P2b rule 8 |
| 28 | Don't overwrite the site's own files | Everything under parity/; the site's CLAUDE.md only gains the line `@parity/CLAUDE.md` |
| 29 | Claude must not run sudo, even inside scripts | .claude/settings.json denies sudo, apt and the two sudo scripts by name |
| 30 | Run the site locally | `npm run dev` → http://127.0.0.1:8000 (python http.server on public/); parity/playwright.config.ts |
| 31 | Ground truth for TurtleBot4, Scout and other verified mobile robots | P2c |
| 32 | Arm robots (UR5e, Franka FR3, xArm Lite 6, Interbotix WX250s, Dobot CR5) | Installed and verified in P2b; manipulation parity tests (M-series) to be added later |
