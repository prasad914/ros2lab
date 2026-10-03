# Publishing the v6 update (terminal tabs, TurtleSim window, more content, lessons up to 30 minutes)

Your site runs v5. This update replaces a few website files and the course content. Student accounts, progress and test results are kept. Plan about 15 minutes.

## What's new

### The practice terminal now behaves like real Ubuntu
- **Terminal tabs:** press **+ New terminal** to open up to 4 terminals. Each tab has its own folder, history and loaded settings (so you `source` ROS 2 in each new tab, exactly like on Ubuntu). All tabs share the same files and the same running ROS 2 system.
- **Nodes run in the foreground:** `ros2 run turtlesim turtlesim_node`, `turtle_teleop_key`, `demo_nodes_* talker/listener` and `ros2 launch turtlesim multisim.launch.py` keep their tab busy, show their output, and stop with **Ctrl+C** (key or button), just like the real thing.
- **Live output:** a talker prints `Publishing: 'Hello World: N'` every second in its tab, and a listener in another tab prints `I heard: [...]` at the same time.
- **A TurtleSim window** opens above the terminal as soon as turtlesim runs. It shows the background colour, every turtle and its pen trail, and updates when you publish to `cmd_vel`, call `/spawn`, `/set_pen`, `/teleport_absolute`, `/clear` or `/reset`, change `background_r/g/b`, or send a rotate action. `ros2 launch turtlesim multisim.launch.py` opens two windows.
- **Drive with the keyboard:** while `turtle_teleop_key` runs in a tab, the arrow keys (or the on-screen arrow buttons) drive the turtle. Hitting the edge prints turtlesim's real warning, `Oh no! I hit the wall!`, in turtlesim's own tab.
- Every lesson terminal now has this live ROS 2 system, so starting turtlesim anywhere shows the window.
- Lesson tasks that come after starting a node now say: **"Open a new terminal tab (press + New terminal)..."**

### More content, every lesson 30 minutes or less
- The longest lessons were split into two parts of under 30 minutes each: **A2, A3, A5, P1, P2, R2 and D7** (new lessons A2b, A3b, A5b, P1b, P2b, R2b, D7b). Each part 1 ends with its own quick checks.
- Lessons that were short got more hands-on work: find all five ROS parts on a live turtle (IN3), two delivery robots with their own pens and topics (D13), talker and listener in separate tabs (PF2), a C++ package with `--packages-select` (D10), be TF2 for a moment (D11), count messages (D5), spot ROS 1 habits (IN7), and more matching, sorting, ordering and spot-the-bug puzzles, "Explain it back" questions and "Try it yourself" challenges.
- In total: **64 lessons**, 57 practice terminals and 46 Python exercises, all checked automatically.

## Steps

1. **Copy the files.** Unzip `ros2lab-v6-changed-files.zip`, then copy its `ros2lab-course` folder over your `C:\ros2lab-course` folder. Say **Yes** to replacing files.
2. **Check the lessons** (optional; needs Python 3):
   ```
   cd C:\ros2lab-course
   node tools\check-content.mjs
   ```
   It should say **All good** (57 practice terminals, 46 Python exercises).
3. **Publish the website:**
   ```
   firebase deploy --only hosting
   ```
   (If you did not publish v5's database rules yet, use `firebase deploy --only hosting,firestore:rules` instead.)
4. **Upload the course.** Open the site → **Instructor → Course content** → choose `content\course-content.json` → **Upload**. It should report 5 modules, **64 lessons** and 5 tests.
5. **Check it as a student.** Press **Ctrl + F5**, open lesson **D2**, start turtlesim, press **+ New terminal**, start `turtle_teleop_key` and drive with the arrow keys.

## Good to know
- Students who already finished A2, A3, A5, P1, P2, R2 or D7 keep that progress (part 1 keeps the old lesson id). The new part 2 lessons appear as not started. If a week's test requires all lessons to be finished, those students will need to complete the part 2 lessons (they are short) before starting that test, or you can untick **Require all lessons** for that test in **Instructor → Tests**.
