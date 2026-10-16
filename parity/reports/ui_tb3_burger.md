# UI Review: TurtleBot3 Burger (Prompt P7, Spec S12)

- **Robot**: `tb3_burger`
- **Category**: Mobile (Official Jazzy)
- **Review Date**: 2026-10-16

## Checklist (Spec S12)
1. **10-level left stepper**: PASS (Robot & URDF/TF, Sensors, Teleop & odometry, Mapping, Localization, Costmaps, Global planning, Local control, Behaviour trees & recoveries, Missions).
2. **Concept texts**: PASS (Short concept lines per level from `parity/reference/concepts.md`, no long paragraphs).
3. **Try it controls & What real ROS 2 shows**: PASS (Topics, TF, commands shown per level).
4. **Locks**: PASS (Navigation levels locked until map + localization/SLAM active, with clear reason).
5. **Layout**: PASS (Top bar robot/world/mode; centre split 3D | RViz with Orbit / TopDownOrtho; right Displays + Tool Properties; bottom toolbar + topic/TF inspector).
6. **Robot truth**: PASS (Burger has no camera; teaching note correctly explains Burger has no camera and no camera topics/frames).
7. **Usability**: PASS (Responsive from 375px to 1280px, keyboard accessible, icon tooltips, faithful error text first then hint).

**Verdict**: PASS
