# Finishing ROS2Lab V24 with Claude Code on your Ubuntu PC: a beginner's guide

This guide assumes you have never used Claude Code before. You will:

- open your website project in Claude Code;
- record what **real ROS 2 Jazzy** does for each robot;
- have Claude compare that with the website's simulator and fix the differences;
- test the site and upload it.

Claude Code is Claude running in your terminal. It can read and edit your project files and run commands such as
tests, `ros2` and `colcon`, but only after you allow it. Everything happens in the folder you start it in.

Official docs: https://code.claude.com/docs/en/quickstart. Free course: "Claude Code 101" at https://academy.claude.com

---

## Part 1. One-time setup (about 20 minutes)

### 1.1 Check Claude Code is installed

Open a terminal (Ctrl+Alt+T) and type:

```bash
claude --version
```

If it prints a version number, go on. If it says "command not found", install it:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Then close the terminal, open a new one and run `claude --version` again.

### 1.2 Install what the project's tests need

```bash
sudo apt update
sudo apt install -y nodejs npm unzip zip python3 git ros-dev-tools ros-jazzy-ros-gz
node --version          # must be 18 or newer
sudo rosdep init 2>/dev/null; rosdep update
```

If `node --version` prints a number below 18, install a newer Node.js from https://nodejs.org (LTS) instead.

### 1.3 Put the project in a folder

The project comes in three zip files, because each file I send must be under 30 MB. Put all three in your
Downloads folder, then unzip them into your home folder. All three go into the same `ros2lab-course` folder:

```bash
cd ~
unzip ~/Downloads/ros2lab-v24-part1-site.zip                  # creates ~/ros2lab-course
unzip ~/Downloads/ros2lab-v24-part2-ws-turtlebot3-franka.zip  # adds the TurtleBot3 and Franka workspaces
unzip ~/Downloads/ros2lab-v24-part3-ws-arms.zip               # adds the other robot workspaces
cd ~/ros2lab-course
ls                                     # you should see CLAUDE.md, public/, tests/, tools/ ...
git init -q && git add -A && git commit -qm "V24 start"   # a save point you can always return to
```

If git asks who you are, run `git config --global user.name "Your Name"` and
`git config --global user.email "info@ros2lab.com"`, then repeat the last command.

This is the full project: everything in V23, plus the V24 work done so far. It also has the files Claude Code reads
automatically:

| File | What it does |
|---|---|
| `CLAUDE.md` | The project's "memory". Claude reads it at the start of every session: the architecture, the rules (behave like real ROS 2, honesty, security), and the test commands. |
| `.claude/agents/mobile-robot-auditor.md` | A helper agent (a "subagent") for TurtleBot3, Scout and Crazyflie. |
| `.claude/agents/arm-robot-auditor.md` | A subagent for UR5e, FR3, Gen3, xArm6, Lite 6, WX250s and CR5. |
| `.claude/agents/parity-reviewer.md` | A subagent that checks the work before you upload. It can't edit files. |
| `V24-HANDOFF.md` | What is done and what is left, with prompts ready to paste. |
| `tools/ground-truth/` | The real-ROS-2-versus-website comparison kit. Its `README.md` explains it. |

Folders whose names start with a dot are hidden. To see them, run `ls -a`, or press Ctrl+H in the file manager.

### 1.4 Install the test browser (once)

```bash
cd ~/ros2lab-course
npm install --no-save @playwright/test
npx playwright install --with-deps chromium
```

### 1.5 Start Claude Code for the first time

```bash
cd ~/ros2lab-course
claude
```

- The first time, it opens your web browser so you can log in with your Claude account. Log in, then go back to the
  terminal.
- It asks whether you trust this folder. Answer **Yes**.
- You now see a prompt box. Type in plain English and press Enter.

Try this first message to check that Claude has read the project:

```
Read CLAUDE.md and V24-HANDOFF.md and tell me in 5 lines what this project is and what is left to do.
```

---

## Part 2. How to use Claude Code (5-minute lesson)

| You want to... | Do this |
|---|---|
| Ask for something | Type it and press Enter. Be specific: name the robot, the command and what you saw. |
| Approve an action | Claude asks before it edits a file or runs a command. Choose **Yes**, or "Yes, and don't ask again" for commands you trust, such as `node tests/...`. |
| Stop Claude | Press **Esc**. Press it twice to go back to an earlier message. |
| Change how much it asks | Press **Shift+Tab** to cycle the permission modes. Use the normal mode until you're comfortable. |
| See the commands | Type `/help` |
| Start a fresh conversation | `/clear` (the project files stay as they are) |
| Continue yesterday's conversation | Run `claude -c` in the terminal, or `claude -r` to pick an older one |
| See or create subagents | `/agents` |
| Leave | `/exit` or press Ctrl+D twice |
| Point at a file | Type `@` and part of the file name, for example `@tools/ground-truth/README.md` |

**Subagents.** These are helper Claudes with their own instructions; the project ships three. Use one by name:

```
Use the arm-robot-auditor subagent to check the UR5e mock-hardware scenario.
```

To run several at the same time, ask for it:

```
Use separate subagents in parallel: mobile-robot-auditor for the TurtleBot3 scenarios and
arm-robot-auditor for the arm scenarios.
```

Running in parallel finishes sooner but uses your plan's usage faster. If you see "usage limit reached", wait for the
reset time it shows, then type `continue`.

**Safety habits.**

- Before a big change, ask Claude: `commit everything to git with a message describing the current state`. You can
  always go back to that point.
- Read what Claude says it changed.
- Never paste passwords or Firebase keys into the chat.

---

## Part 3. Record what real ROS 2 Jazzy does (on this PC)

This is the step only your PC can do. Your PC is the "ground truth".

The script clones each robot's official GitHub workspace at the same commits the website uses, builds it with colcon,
launches each scenario in Gazebo and RViz, and records:

- nodes, topics, services, actions, controllers and hardware interfaces;
- the TF tree;
- for every topic: its rate and one message.

You can run it yourself, or ask Claude to run it.

**Option A: you run it** in a normal terminal, not inside Claude:

```bash
cd ~/ros2lab-course
bash tools/ground-truth/capture.sh tb3_burger_world      # try one scenario first (about 10 min with the build)
bash tools/ground-truth/capture.sh                       # then all 16 (first run 1-2 hours: it builds 7 workspaces)
```

Gazebo and RViz windows open and close by themselves. Leave the PC alone while it runs. The results go into
`ground-truth/real/<scenario>/`.

**Option B: Claude runs it.** Inside Claude Code:

```
Run bash tools/ground-truth/capture.sh tb3_burger_world and tell me if it worked.
If a workspace fails to build, read its build.log and tell me why.
```

A command can only run for a limited time inside Claude, so for the full 16 scenarios Option A is better.

If a build fails, copy the last 30 lines of the error and ask Claude:

```
The capture of <scenario> failed with this error: <paste>. Fix capture.sh or tell me what to install.
```

---

## Part 4. Record the website and compare

In the terminal, start a local copy of the website and leave it running:

```bash
cd ~/ros2lab-course/public && python3 -m http.server 8080
```

Open a second terminal, then start Claude:

```bash
cd ~/ros2lab-course && claude
```

Paste this:

```
Run node tests/sim-capture.mjs (the local site is on localhost:8080), then node tools/ground-truth/compare.mjs.
Summarise ground-truth/REPORT.md for me per robot: what differs from real ROS 2 Jazzy.
```

`ground-truth/REPORT.md` lists every difference, for example:

- `/odom` publishes at 30 Hz on Ubuntu but 50 Hz on the site;
- a controller is active on the site but inactive on Ubuntu;
- `/joint_states` is missing on the site.

---

## Part 5. Let the agents fix the differences

Paste:

```
Use the mobile-robot-auditor and arm-robot-auditor subagents in parallel to fix the differences in
ground-truth/REPORT.md for their robots. Follow CLAUDE.md: fix the simulator, never the upstream packages, and keep
the honesty rule. After the fixes, re-run sim-capture for the changed scenarios and compare.mjs again, and run the
tests listed in CLAUDE.md.
```

Then ask for an independent check:

```
Use the parity-reviewer subagent to review all changes and tell me if the site is ready to upload.
```

Repeat Parts 4 and 5 until the report shows only the expected differences. The README in `tools/ground-truth/`
lists those.

**Checking it yourself in the browser.** Open http://localhost:8080/rviz.html?robot=tb3_burger, or any robot from the
gallery. Run the same commands you would run on Ubuntu, and compare with a real terminal on your PC. When something
looks wrong, tell Claude exactly what you did:

```
On localhost:8080/rviz.html?robot=ur5e I ran "ros2 launch ur_simulation_gz ur_sim_moveit.launch.py ur_type:=ur5e",
then planned to "up" in the MotionPlanning panel. On my real Jazzy PC the arm moves; on the site it says <...>.
Find the cause and fix it.
```

---

## Part 6. Upload the website

Once the tests pass and the reviewer says it's ready:

```bash
cd ~/ros2lab-course
npm install -g firebase-tools        # once
firebase login                       # once, in the browser
firebase deploy --only hosting       # uploads the public/ folder (the site)
```

If `functions/`, `firestore.rules` or `storage.rules` changed, run this as well (Claude can tell you whether they did):

```bash
(cd functions && npm install)        # once, before the first functions deploy
firebase deploy --only functions,firestore:rules,storage
```

Then open https://www.ros2lab.com in a private window and try two robots.

You can also ask Claude to write the update notes: `write UPDATE-V24.md describing what changed since V23, in the
same style as UPDATE-V23.md`.

---

## If something goes wrong

| Problem | What to do |
|---|---|
| `claude: command not found` | Open a new terminal. If that doesn't help, run the install command from 1.1 again. |
| Claude edits the wrong thing | Press Esc, then say what's wrong. To undo: "revert the last change to <file>", or `git checkout -- <file>`. |
| Usage limit reached | Wait for the reset time it shows, then run `claude -c` and type `continue`. |
| Tests can't open the page | Check the local server from Part 4 is still running on port 8080. |
| Pyodide/CDN errors in tests | The tests load Pyodide from cdn.jsdelivr.net, so your PC must be online. |
| A robot's workspace won't build | Ask Claude to read `~/r2l_gt/<ws>/build.log`. Missing apt packages are the usual cause; `rosdep install` lists them. |
