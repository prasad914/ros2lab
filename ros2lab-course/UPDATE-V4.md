# Publishing the v4 update (Weeks 3 and 5)

Your site already runs v3, so this update only replaces files and uploads the new course content. Plan about 20 minutes. Your Firebase settings files are unchanged.

## What's new

| Week | Days | What |
|---|---|---|
| **Week 3: Introduction to ROS** | 11–15 | 11 new lessons: robot software platforms, ROS objectives, parts and ecosystem, history, versions and LTS, ROS 1 vs ROS 2, middleware, why ROS 2, DDS and domains, Quality of Service |
| **Week 4: Speak ROS 2** | 16–20 | Your old Week 3, unchanged, moved to Days 16–20 (same lesson ids, so existing student progress is kept) |
| **Week 5: ROS Programming Fundamentals** | 21–25 | 8 new lessons: packages and nodes (Python and C++), publishers and subscribers, custom interfaces, services, actions, parameters (YAML and callbacks), launch files (XML and Python), mini-project |

- **12 new animations:** framework, timeline, versions, master vs discovery, middleware layers, DDS discovery, QoS matchmaker, call() deadlock, inside an action, rosidl, parameter callbacks, launch names.
- **Practice terminal:**
  - builds your own `.msg`, `.srv` and `.action` files, with real-style errors;
  - runs your own XML and Python launch files (namespaces, remaps, parameters, arguments);
  - supports `--params-file`, `ros2 topic info -v` with QoS, and `ros2 daemon`.
- **Python playground:** QoS profiles, actions, parameter callbacks, YAML files, typed custom messages and service-deadlock detection.
- **Two new tests:** 77 → 156 question templates; the Week 3 and Week 5 tests each give 200 students 200 different papers.

## Steps

1. **Copy the files.** Unzip `ros2lab-v4-changed-files.zip`, then copy its `ros2lab-course` folder over your `C:\ros2lab-course` folder. Say **Yes** to replacing files.
2. **Check the questions.** In Command Prompt:
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
   It should say **All good** (33 practice terminals, 27 Python exercises).
4. **Publish the new server code and website:**
   ```
   firebase deploy --only functions
   firebase deploy --only hosting
   ```
5. **Upload the course.** Open the site, then **Instructor → Course content** → choose `content\course-content.json` → **Upload**. It should report 5 modules, 57 lessons and 5 tests.
6. **Open the new tests.** Go to **Instructor → Tests**:
   - For **Week 3 test: Introduction to ROS** and **Week 5 test: ROS programming fundamentals**: set the dates, 2 attempts, answers shown "After the test closes", tick **Published**, then **Save**.
   - The old Week 3 test is now called **Week 4 test** automatically.
7. **Check it as a student.** Press **Ctrl + F5** on the course page to load the new files, then open one Week 3 and one Week 5 lesson. Press **Run** in a playground and the buttons in an animation.

**If something looks old,** browsers can keep old JavaScript for a while. Ask students to press Ctrl + F5 once.
