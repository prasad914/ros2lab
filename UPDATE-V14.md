# ROS2Lab update V14: RViz2 and joint_state_publisher_gui as on Ubuntu, Weeks 7 to 9 labels

This package contains **everything from V13** plus the changes below. Build it on your saved version (the one with RViz2 and Weeks 7 to 9), the same way as V13.

## What changed

**Certificate: Weeks 1 to 6 only**
- Weeks 7 to 9 are now called an **introductory experience**, not part of the certificate:
  - on the home page route, the FAQ and the link-preview text;
  - in the Terms of Use;
  - on each Week 7 to 9 card and lesson in My course;
  - in the milestone timeline and on the Project & certificate tab.
- The rules themselves did not change. Only Weeks 1 to 6 count for lifetime access and the certificate (`CORE_MODULES` in functions/config.js, course.js and lesson.js must stay the same).

**RViz2 in the browser looks like real RViz2 on Ubuntu 24.04 (Jazzy)**
Every measurement was taken from real Qt 5.15 (the version RViz2 Jazzy uses), with the Fusion style and the Ubuntu font, and from the RViz2 source code.
- **Window:**
  - Ubuntu (Yaru) title bar; same menu bar, toolbar and tool icons;
  - Displays, Views and Time panels, and the status bar with Reset and fps;
  - the same pixel sizes as the default 1200 × 846 RViz window.
- **Fonts:** Ubuntu Sans 11 pt for the interface. TF frame names use Liberation Sans, as in RViz.
- **Displays tree:**
  - icons, the blue / orange / red status colours and bold names as in RViz;
  - check boxes and value editors;
  - the help box below the tree.
- **Menus and dialogs:**
  - File, Panels and Help menus with their shortcuts;
  - Add display ("By display type" / "By topic"), Add tool and Add panel, using the descriptions from RViz itself;
  - Rename, Save Config As and Open Config.
- **3D view:**
  - RViz's lighting (one light following the camera);
  - grid, TF axes and arrows with the RViz sizes and colours;
  - the Orbit, XYOrbit and TopDownOrtho views;
  - the robot is framed automatically until the student moves the camera.
- **Hide-dock arrows and draggable splitters:**
  - On narrow windows, the Views dock (below 900 px) and both docks (below 560 px) start hidden.
  - On a phone the toolbar can be swiped, so no tool is lost.
- **Keyboard:**
  - In the trees, the arrow keys select, expand and collapse; Space ticks a box; Enter or F2 edits a value.
  - Focus frames show where you are.

**joint_state_publisher_gui window looks like the real one**
- It has the same layout as the ROS 2 source: Randomize and Center on top, one box per joint, bold joint names, and 200 px sliders. The number box shows `0.00` until a slider moves, then 3 decimals.
- Moving the sliders:
  - Drag, click the groove (it steps like Qt), or use the mouse wheel.
  - Arrow keys move 0.5% of the range (Shift+arrow for fine steps); PageUp and PageDown move 5%.
- Window buttons:
  - minimise (collapses the window);
  - maximise (opens the sliders in a separate browser window, still driving RViz);
  - close.
- You can drag the window by its title bar.

**Where it appears:** the RViz page, every Week 7 to 9 lesson block, the practice terminal (`ros2 launch urdf_tutorial display.launch.py …`) and the Python playground's 3D markers. The lesson URDF editor box also has proper styling now (it was unstyled before).

**RViz page:** a note says it is ROS2Lab's practice RViz and that ROS2Lab is not affiliated with or endorsed by Open Robotics.

## Publish

If you already published V13, only the website changed:

```
firebase deploy --only hosting
```

If you have not published V13 yet, follow UPDATE-V13.md (it deploys functions, rules and hosting). On Windows, run `set FUNCTIONS_DISCOVERY_TIMEOUT=120` before deploying functions.

Then open www.ros2lab.com/rviz.html and press **Ctrl+F5** once so the browser loads the new styles and fonts.

## New files and licences

| Files | Licence |
|---|---|
| `public/css/rviz.css`, `public/js/rviz-data.js` | New code |
| `public/fonts/UbuntuSans-Var.woff2` | Ubuntu Font Licence 1.0 (`UbuntuSans-LICENSE.txt`) |
| `public/fonts/NimbusSans-Bold.woff2` (the joint names in the slider window) | AGPL-3 with font exception (`NimbusSans-LICENSE.txt`) |
| `public/fonts/LiberationSans-Arimo.woff2` (TF frame names) | SIL Open Font Licence 1.1 (`Arimo-LICENSE.txt`) |
| `public/img/rviz/*` (display and tool icons) | From RViz2 (BSD / public domain icons) |
| `public/img/rviz/qt/dlg_ok*`, `dlg_cancel*` | Yaru icon theme, CC BY-SA 4.0 |
| Other `public/img/rviz/qt/*` (Qt Fusion buttons, check boxes, scroll bars) | Drawn by rendering Qt; part of this package |

Keep the licence text files next to the fonts.

The old DejaVu fonts and `UbuntuSans-Bold.woff2` are no longer used. You can delete them from `public/fonts` if they are still there.
