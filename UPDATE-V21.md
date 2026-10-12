# ROS2Lab update V21: Gazebo loads robots like Gazebo, the Robotic Models Simulator, a new home page, robot missions

V21 contains everything from V20 plus the changes below. The course content (lessons, tests, `content/`) is unchanged.

## Gazebo: robots are loaded the way Gazebo Harmonic loads them

**The wall bug is fixed.** Chiku and every other robot driven by ros2_control used to drive through walls when they
got a command from the terminal (a `TwistStamped` on `/diff_drive_controller/cmd_vel`). The controllers now turn the
wheels and the physics engine decides where the robot goes, as gz_ros2_control does. Against a wall the robot stops,
and the controller's odometry keeps counting, as it does on Ubuntu. The robot's collision box now turns with the robot.
The same check ran for the Gazebo DiffDrive and MecanumDrive systems; Chiku, the mecanum robot and TurtleBot3 all stop
at the wall.

**URDF to SDF, as libsdformat 14 does it.** Before Gazebo simulates a robot it converts the URDF to SDF. The practice
Gazebo now follows the same rules, and the rules and messages were checked against libsdformat 14.9 itself, built here
from source:

- **Fixed joints are lumped.** Links on fixed joints merge into their parent, with their masses added. A
  `<preserveFixedJoint>` or `<disableFixedJointLumping>` gazebo tag stops the lumping.
- **Links with no mass are dropped.** A link with no `<inertial>` (or a mass of 0) is left out of the simulation,
  together with its joint and everything below it. Gazebo prints sdformat's own warnings
  (`Warning [parser_urdf.cc:2774] Error Code 19: Msg: urdf2sdf: link[...] has no <inertial> block defined...`). They
  come out character for character as libsdformat prints them, including the missing line break after
  "is not modeled in sdf.".
- **Drive systems need their joints.** If the joints a DiffDrive needs were dropped, it says
  `Failed to find left joint [...]` and the robot cannot drive.
- **A robot with no collisions falls.** It falls through the ground plane and passes through walls, as in Gazebo.
- **A robot with no links fails to spawn.** If not one link is left, the spawn fails with `Error Code 17: Msg: A model
  must have at least one link.`
- **The terminal explains what happened.** After the spawn it says which links were left out and why. RViz still
  shows the whole URDF.
- **`<gz_frame_id>` warnings.** Gazebo prints the real `Warning [Utils.cc:132] ... XML Element[gz_frame_id] ...` lines
  for sensors that use it. They are harmless, and gz-sensors still reads the element.
- **Gravity on mobile robots.** A wheeled robot spawned in the air drops onto its wheels, and one spawned into the
  ground is pushed up.
- **New command: `gz sdf -k <file.urdf>`.** It prints exactly what the real one prints: the warnings twice, then
  `Valid.`

**Estimated masses for three arms.** The makers' URDFs of the KUKA KR 6, FANUC LR Mate 200iD and Dobot Magician have no
masses at all, so real Gazebo drops the whole arm. Their MoveIt configs now carry a copy of the description with
estimated `<inertial>` blocks:

- Each arm's weight comes from its data sheet (52 kg, 25 kg and 3.4 kg).
- That weight is spread over the collision meshes at uniform density, with the centre of mass and inertia computed from
  the meshes themselves (`tools/mesh-inertials.py`).
- The descriptions themselves are unchanged.

**Checked against real Gazebo's parser.** The URDF that Gazebo receives for every gallery robot was run through
libsdformat 14.9. The practice Gazebo's result was identical for all 20 robots and for the two stand-in course robots.
All of them now load completely.

**New tool for robots you add: `node tools/check-gazebo.mjs`.** It reports any robot that would lose links in Gazebo,
links with no `<collision>`, and the total mass. Run it after adding or changing a robot.

## The Robotic Models Simulator (was "the RViz page")

`rviz.html` is now the **Robotic Models Simulator**, and the menu item reads "Simulator".

- **A catalog by category:** Manipulators, Mobile robots, Legged robots and humanoids, Drones, and Hybrid robots. There
  is a search box, and each robot has a picture.
- **Pictures from the robots' own files.** They are rendered from each robot's own URDF and meshes, with physically
  based lighting and a soft shadow (`public/img/robots/*.webp`, made by `tools/render-robots.mjs`). The course robots
  were not in the copy used here, so they have no shipped picture yet. The browser draws theirs the same way the first
  time the catalog is opened, and keeps it.
- **One window per robot.** Each robot opens in a window of its own (`rviz.html?robot=<id>`). Opening it again brings
  that window back.
- **Separate workspaces.** Each window has its own `~/ros2_ws`, holding only that robot's packages and the ones it needs
  (description, gazebo, moveit_config, bringup, goal_pose_gui, and ros2lab_hardware for the course robots). VS Code
  (`code ~/ros2_ws`) therefore shows only that robot. The launch settings are remembered per robot.
- **Your own robot.** "Your own robot" opens a window for your own files.
- **Links in lessons still work.** Lessons that link to `rviz.html` still work; they now open the catalog.

## Home page

- **A new TurtleSim in the hero.** It sits next to a terminal that behaves like ROS 2 Jazzy's:
  - `ros2 topic pub` (`--once` and `-r`), `topic echo`, `topic hz`, `topic list` and `topic info`.
  - `node list` and `node info`.
  - `service call` for `/spawn`, `/kill`, `/clear`, `/reset`, `set_pen` and the teleports.
  - The RotateAbsolute action, with feedback.
  - `param list`, `param get` and `param set`. The background colour changes, as on Ubuntu.
  - `turtle_teleop_key`, which drives with the arrow keys.
  - `interface show`, plus Tab completion, history and Ctrl+C.

  Outputs, the wall warning and the one-second cmd_vel timeout follow the real turtlesim. There are four missions, and
  the turtle is drawn at turtlesim's own size and colours.
- **A live Gazebo section.**
  - **What it shows.** A TurtleBot3 Burger, with its real meshes, drives itself around the course's practice world. A
    360-ray lidar is cast into the world, the walls stop the robot, and loose objects get pushed. A HUD shows `/cmd_vel`
    and `/scan`. Visitors can take the wheel with the arrow keys or the buttons.
  - **How it loads.** On a computer it starts when the section scrolls into view. On a phone, or with data saving on, it
    waits for the "Start Gazebo" button, because it loads about 5 MB.
  - **The robot strip.** It links to the simulator.
- **A quieter, more deliberate look.** The hero, the numbers and the sections have a cleaner look, with the same text.

## Playground: robot missions

Six new games feature real robots. Each takes a few minutes, cannot be won by clicking at random, and uses the real
ROS 2 Jazzy message fields, commands and error texts.

| Game | Robot | What you do |
|---|---|---|
| Lidar Detective | TurtleBot3 Burger | Read a `sensor_msgs/msg/LaserScan`: angle to index, ranges, `.inf`, a rotated lidar frame |
| Warehouse Run | TurtleBot3 Waffle | Nav2: 2D Goal Pose, `/goal_pose` or `NavigateToPose` with feedback, costmap inflation, replanning around a pallet |
| Frame Builder | Mobile manipulator | tf2: build the tree, who publishes each transform (/tf vs /tf_static), read `tf2_echo` |
| Drone Hover | Crazyflie 2.1 | Tune P, then PD, then PID for altitude: rise time, overshoot, settling, a payload |
| Controller Bring-up | UR5e, then a diff drive | ros2_control: spawn order, claimed-interface conflicts, broken YAML, TwistStamped |
| Pick and Place | UR5e | MoveIt ideas: IK solutions, plan and execute, collisions, Cartesian approach and retreat, attaching parts |

The game list now has two tracks: **Robot missions** and **ROS 2 basics**. "Topic, Service or Action?" now draws 10
situations from 20, ten of them new real-robot ones. The page no longer scrolls sideways on phones.

## Deploy

1. Copy the files of this update over the project (same paths). Nothing is deleted.
2. `firebase deploy --only hosting` (no Cloud Function changed in V21).
3. The new pages load only files from your own site. The Content-Security-Policy notes from V20 still apply: allow
   `'wasm-unsafe-eval'` for the physics engine.

## After you deploy (on the real site, with the course robots)

- **Check the course robots.** Run `node tools/check-gazebo.mjs`. Any course robot marked BAD would lose links in real
  Gazebo too; give those links an `<inertial>`.
- **Make the course robots' pictures.** `npx http-server public -p 8080 &` then `node tools/render-robots.mjs` (needs
  Playwright). This writes `public/img/robots/<id>.webp` for the course robots. Deploy hosting again. Until then, the
  browser draws them.
- **Open the Simulator.** Open a course robot and Chiku, check that each window shows only its own packages, and drive
  Chiku into a wall with `sim_control.launch.py`.
- **Developer checks:**
  - `node tests/urdf2sdf.test.mjs`
  - `node tests/sdfload.mjs`
  - `FIX=1 node tests/wall.mjs chiku control 30`
  - `node tests/gzsweep.mjs`
  - `node tests/sweep.mjs`
  - the three `tests/games-*.mjs`
