# ROS2Lab: "ROS 2 from zero, in five weeks" (www.ros2lab.com)

A free online course for engineering students. Anyone with a valid college ID card can register; the instructor approves each registration.
**Start with SETUP-GUIDE.md.** Updating from v2? Read **UPDATE-GUIDE.md**.

## What is in this folder

| Path | What it is |
|---|---|
| `public/` | The website: landing page, registration, sign-in, course, lessons, tests, instructor dashboard, Playground and concept lab. Contains no lessons and no answers. |
| `public/js/anims/` | 13 interactive concept animations (topics, services, actions, parameters, launch, workspaces, TF2, spin, paths, permissions, classes...). |
| `public/js/puzzles.js` | Lesson puzzle blocks: step-through code tracer, match, sort, spot-the-bug, think-first and flashcards. |
| `public/js/ros-graph.js` | The pretend running ROS 2 system behind the practice terminal (`ros2 node/topic/service/param/action/interface/bag/pkg`). |
| `content/course-content.json` | The 3-week course: 38 lessons (Days 1 to 15) and 3 weekly tests. Uploaded from the Instructor page. |
| `functions/` | Server code: sign-up checks, ID card review, per-student test papers and grading, automatic clean-up. `functions/questions/` holds 98 question templates. |
| `firestore.rules`, `storage.rules` | Security rules for the database and for ID card photos. |
| `firebase.json` | Hosting settings and security headers. |
| `tools/preview.html` | Preview lessons on your laptop before uploading. |
| `tools/check-content.mjs` | Checks every practice terminal and Python exercise in the course file: `node tools/check-content.mjs` |

## The course

- **Week 1, Talk to the robot's computer:** Day 1 start here, terminal basics, Day 2 files, permissions and apt, Days 3 to 5 Python from zero, Week 1 test.
- **Week 2, Build the robot's brain:** Days 6 and 7 Python objects and first ROS 2 nodes, Days 8 and 9 C++ basics, classes and an rclcpp node, Day 10 Ubuntu, ROS 2 Jazzy installation and the robotics lab, Week 2 test.
- **Week 3, Introduction to ROS:** Days 11–15: why robots need a software platform, ROS objectives, parts and ecosystem, history and versions, ROS 1 vs ROS 2, middleware, DDS, domains and QoS.
- **Week 4, Speak ROS 2:** Days 16–20: nodes, topics, messages, services, parameters, actions, launch files, workspaces, TF2 and debugging, hands-on in the practice terminal.
- **Week 5, ROS Programming Fundamentals:** Days 21–25: packages and nodes in Python and C++, publishers and subscribers, custom interfaces, services, actions, parameters with YAML and callbacks, launch files, mini-project.

Keep this folder private: it contains the question templates.
