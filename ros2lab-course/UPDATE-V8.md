# Publishing the v8 update (wider lessons, a new Week 5 with 20 chapters, Week 6 without repeats, Week 7 removed)

This update works whether your site runs **v6 or v7**: the changed-files zip contains every file that changed since v6. Student accounts and test results are kept. Plan about 20 minutes.

## What's new

### Wider lesson pages: no sideways scrolling
- Lesson pages are now up to 1280 px wide (they were 780 px). On a laptop the whole lesson is visible at once.
- Code wraps onto the next line instead of scrolling sideways: code blocks, the step-by-step tracer, Python and C++ tabs, the Python playground and nano.
- Checked on all 95 lessons at 1366 px, 1024 px and phone width (390 px): nothing scrolls sideways.

### Week 5: ROS Programming Fundamentals, rebuilt (Days 21–25, 20 chapters)
Every idea now has a **Python chapter** and then a **separate C++ chapter** (F1 to F20). Each chapter:
- explains the code line by line, in plain words, for beginners;
- has a step-by-step code tracer, puzzles and quick checks;
- has a **live Ubuntu terminal** where students build and run the real code and watch TurtleSim react;
- includes a "Tested on a real system" box with the real output.

| Day | Python chapter | C++ chapter |
|---|---|---|
| 21 | F1 Your first package and node | F2 Your first package and node |
| 21 | F3 A timer and a publisher drive the turtle | F4 The same in C++ (chrono, std::bind, ->) |
| 22 | F5 A subscriber that listens to the robot | F6 The same in C++ (std::optional, const &) |
| 22 | F7 Your own message (RobotStatus.msg) | F8 Publishing your own message from C++ |
| 23 | F9 A service server: switch the robot on and off | F10 The same in C++ |
| 23 | F11 A service client: spawn a turtle, draw a triangle | F12 A service client in C++ |
| 24 | F13 An action: drive a distance, with progress and cancel | F14 The same in C++ (threads, rclcpp_action) |
| 24 | F15 Parameters and YAML files | F16 Parameters in C++ |
| 25 | F17 A launch file starts the whole robot | F18 Launch files for a C++ package |
| 25 | F19 Mini-project: Chiku's battery monitor | F20 The mini-project in C++ |

- In F1, F2 and F7 students create packages from scratch with `ros2 pkg create` and type their own code in nano. The practice terminal now creates exactly the files that real ROS 2 Jazzy creates.
- New real nodes: `speed_driver`, `battery_monitor` and `spawn_client` (Python and C++), and new launch and YAML files.

### Week 6: only new ideas (Days 26–30, 15 topics)
- Lessons that repeated Week 5 have moved into Week 5: node anatomy, package files, the pose subscriber, the custom message, the service, client and action lessons.
- The remaining lessons build on Week 5 without teaching it again:
  - time and logging;
  - a square driven with a state machine;
  - closed-loop go-to-goal, a safety filter that chains nodes, and messages in code;
  - QoS, and safe parameters (descriptors, ranges, callbacks);
  - launch files for two robots;
  - a tf2 broadcaster and listener;
  - executors, lifecycle nodes and components;
  - tests, and a patrol-robot project.

### Week 7 removed
Week 7 (kinematics) is removed for now, so it can be planned in detail later. Its drafts are kept, but not on the website.

### Corrections found in the review
- **Parameters:**
  - Every ROS 2 Jazzy node also has the parameters `start_type_description_service` (and turtlesim has `holonomic`), plus the service `get_type_description`. The practice terminal now lists them like the real system.
  - The terminal now has `ros2 param describe`.
- **Wrong-type messages:** a Python node now prints rclpy's real message (`Wrong parameter type, expected 'Type.DOUBLE' got 'Type.INTEGER'`); C++ nodes print rclcpp's.
- **Topic echo:** strings no longer show extra quotes, a node's Twist shows its real values, and a square driver really drives a square.
- **Tests:**
  - The Week 5 test now has 16 questions and also covers timers, publishers and subscribers.
  - The Week 6 test covers only Week 6 ideas.
  - 188 question templates in total.

## Changed files (since v6)
```
COURSE-OUTLINE.md
README.md
UPDATE-V8.md
content/course-content.json
functions/questions/index.js
functions/questions/nodes.js
functions/questions/progfund.js
functions/test/run-tests.js
public/css/app.css
public/index.html
public/js/anims/kit7.js
public/js/anims/layers.js
public/js/anims/pctrl.js
public/js/anims/quat.js
public/js/anims/registry.js
public/js/lesson-render.js
public/js/py-worker.js
public/js/pyrun.js
public/js/ros-graph.js
public/js/terminal-sim.js
public/playground.html
public/resources.html
tools/check-content.mjs
ros2-code/                     (the real ROS 2 packages, refreshed)
```
You can delete UPDATE-V7.md from your folder: this guide replaces it.

## Steps

1. **Copy the files.** Unzip `ros2lab-v8-changed-files.zip`, then copy its `ros2lab-course` folder over your `C:\ros2lab-course` folder. Say **Yes** to replacing files.
2. **Check the questions** (from the functions folder):
   ```
   cd C:\ros2lab-course\functions
   npm test
   ```
   It must end with **All checks passed**.
3. **Check the lessons** (optional; needs Python 3):
   ```
   cd C:\ros2lab-course
   node tools\check-content.mjs
   ```
   It should say **All good** (85 practice terminals, 61 Python exercises).
4. **Publish the server code and the website:**
   ```
   firebase deploy --only functions
   firebase deploy --only hosting
   ```
5. **Upload the course.** Open the site → **Instructor → Course content** → choose `content\course-content.json` → **Upload**.
   - It should report **6 modules, 95 lessons and 6 tests**.
   - Week 7 and the old lessons are removed automatically.
   - If you had a Week 7 test, it is unpublished automatically; its results stay.
6. **Check the tests.** In **Instructor → Tests**, open the **Week 5 test** and the **Week 6 test**. Check their dates and that **Published** is ticked.
7. **Check it as a student.** Press **Ctrl + F5**, then:
   - open **F1**, create the package and run your first node;
   - open **F11** and watch the artist turtle draw a triangle.

## Good to know
- **Week 5 progress:**
  - Week 5 has new lessons (F1 to F20). Progress on the old Week 5 lessons (PF1 to PF8) no longer counts.
  - If **Require all lessons** is ticked for the Week 5 test, students must finish F1 to F20 first.
- **Week 6 progress:**
  - Progress on Week 6 lessons that moved to Week 5 (N1, N3, N6, N11 to N16) is also gone.
  - The other Week 6 lessons keep their progress.
- **Optional clean-up:** you may delete `public\js\anims\ik2.js`, `diffdrive.js` and `mmplan.js` from your folder. They are no longer used.
