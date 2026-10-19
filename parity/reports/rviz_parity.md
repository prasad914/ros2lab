# RViz Option-by-Option Parity Audit (Spec S10)

Date: 2026-10-16  
Scope: TurtleBot3 models only (`tb3_burger`, `tb3_waffle`, `tb3_waffle_pi`). Other robots are skipped: P2b/P2c have not run.

Real default evidence comes from installed ROS 2 Jazzy configs:
- `parity/fixtures/_installed/nav2_bringup/rviz/nav2_default_view.rviz`
- `parity/fixtures/_installed/turtlebot3_navigation2/rviz/tb3_navigation2.rviz`
- Plugin declarations: `parity/fixtures/_installed/rviz_default_plugins/plugins_description.xml`, `parity/fixtures/_installed/nav2_rviz_plugins/plugins_description.xml`

PENDING means no adequate emulator test or captured real runtime fixture was found during this step. Installed config/plugin declarations establish saved defaults and plugin declarations only; they do not establish that the emulator's controls, rendering, effects, or status text match real RViz. No runtime defaults or status strings are inferred.

| Element | Property / behavior | Real default/evidence | ROS2Lab evidence | Status |
|---|---|---|---|---|
| Global Options | Fixed Frame | `map` in both installed configs | Fixed Frame exercised by `parity/e2e/fixed-frame.spec.ts`; full config default parity not established | PENDING |
| Global Options | Background Color | `48; 48; 48` | No property-level e2e assertion | PENDING |
| Global Options | Frame Rate | `30` | No property-level e2e assertion | PENDING |
| Global Status | Status and errors | Runtime text not captured in installed config; no real status fixture | Fixed-frame negative case checks error class/pattern, not complete S10 status parity (`parity/e2e/fixed-frame.spec.ts`) | PENDING |
| Grid | Reference Frame | `<Fixed Frame>` | No property-level assertion | PENDING |
| Grid | Cell Count / Cell Size | Plane Cell Count `10`; Cell Size `1` | No property-level assertion | PENDING |
| Grid | Plane | `XY` | No property-level assertion | PENDING |
| RobotModel | Description Source / Topic / File | Topic; `/robot_description`; empty Description File | No S10 property-level assertion | PENDING |
| TF | Show Names / Axes / Arrows | `false` / `true` / `true` | Frame options are tested, not these display properties | PENDING |
| TF | Marker Scale / Frame Timeout / per-frame toggles | `1` / `15` / listed config frame values | No property-level assertion | PENDING |
| LaserScan | Style / Size / Color Transformer / Decay Time | Points / `3` px and `0.01` m / Intensity / `0` | Sensor tests do not verify RViz display properties | PENDING |
| LaserScan | Missing-TF message-filter status | No real runtime status fixture; S10 marks this [VERIFY] | Not tested | PENDING |
| PointCloud2 | Properties, Add-by-topic, wrong type / no-data behavior | Generic Nav2 config includes `Bumper Hit` on `/mobile_base/sensors/bumper_pointcloud`; S9 says no PointCloud2 source for TB3 | Robot-specific behavior not covered by a property-level test | PENDING |
| Image | Topic, transport, reliability and no-image/QoS status | Generic config contains Image display; S9 documents model topics; exact runtime status not captured | S9 browser test covers Burger no-camera and Waffle camera frame presence only | PENDING |
| Camera | CameraInfo and TF requirements / status | No captured real runtime status fixture | Not tested | PENDING |
| Map | Topic / Update Topic | `/map` / `/map_updates` | No property-level assertion | PENDING |
| Map | Durability / Color Scheme / Alpha | Transient Local / `map` / `1` | No property-level assertion | PENDING |
| Path | Topic and display properties | Nested Path displays in installed Nav2 config | No property-level assertion | PENDING |
| Pose | Properties and effect | No complete real config/runtime audit captured | Existing `/initialpose` and `/goal_pose` tests cover tool publication, not Pose display (`parity/e2e/rviz-tools.spec.ts`) | PENDING |
| PoseArray | Properties and effect | No complete real config/runtime audit captured | Not tested | PENDING |
| PoseWithCovariance | Properties and effect | No complete real config/runtime audit captured | Initial-pose tool covariance test is not a display test (`parity/e2e/rviz-tools.spec.ts`) | PENDING |
| ParticleCloud | Topic and display properties | `/particle_cloud` in installed config | Stack tests do not assert RViz display settings | PENDING |
| Marker / MarkerArray | Topics and display properties | MarkerArray entries in installed config | Not tested property by property | PENDING |
| Polygon | Topic and display properties | Polygon entries in installed config | Not tested property by property | PENDING |
| Odometry | Keep / Shape / Covariance | No selected config defaults captured | Not tested | PENDING |
| Axes | Properties | No selected config defaults captured | Not tested | PENDING |
| Views panel | View types / Target Frame | Current view `TopDownOrtho`; Target Frame `<Fixed Frame>` in Nav2 config | Existing UI checks are not full Views-panel parity | PENDING |
| Time panel | Presence and behavior | Not present in the installed config's `Panels` list | Not compared against real runtime | PENDING |
| Selection panel | Presence and behavior | `rviz_common/Selection` | Not compared against real runtime | PENDING |
| Tool Properties panel | Presence and behavior | `rviz_common/Tool Properties` | Tool publication tests do not verify panel behavior | PENDING |
| Displays panel | Presence and behavior | `rviz_common/Displays` | Not compared property by property | PENDING |
| Add dialog | By display type / By topic; topic compatibility; display effect | Runtime behavior not represented by saved config | No S10-specific Add dialog test retained; no real runtime fixture | PENDING |
| Navigation 2 panel | Startup / Pause / Reset; waypoint modes; feedback; load/save/loop | Installed config declares `nav2_rviz_plugins/Navigation 2` | Plugin declaration is not evidence of functional parity; no panel interaction test | PENDING |
| Jazzy panel inventory | Docking panel presence | Installed `nav2_default_view.rviz` explicitly includes `nav2_rviz_plugins/Docking` | No emulator comparison or version-specific parity test | PENDING |
| SlamToolboxPlugin panel | Modes and controls | Not declared in the selected installed default configs; no runtime fixture | No real panel comparison | PENDING |
| Default display set | Nav2 and TurtleBot3 configs | Both config files listed above; generic Nav2 config includes additional robot-agnostic entries | Per-model parity against the relevant TB3 config not fully verified | PENDING |

## Test outcome and report generation

No new S10 e2e spec was retained: initial assertions were found to be invalid or did not test the claimed behavior, so they were removed rather than recorded as passing. Existing tests are cited only for the narrower behavior they actually exercise. The report is currently a hand-maintained inventory; automatic regeneration from Playwright results was not implemented, so the requested `npm run parity:report` remains PENDING.
