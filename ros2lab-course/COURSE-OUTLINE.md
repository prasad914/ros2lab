# ROS 2 from zero, in three weeks: course outline

A free online course on www.ros2lab.com for engineering students (Robotics, AI and related branches), designed for beginners who are new to Ubuntu, Python, C++ and ROS 2.

**Format:** 15 study days, about 60 to 90 minutes each. Every lesson follows the same pattern: a short story about Chiku the delivery robot, the goal, one idea with a real-world comparison, an animation or step-through code tracer that shows the idea moving, practice in the browser (simulated Ubuntu terminal with a live ROS 2 graph, real Python with a practice rclpy, puzzles or games), quick checks with instant feedback, and a recap with flashcards.

**Enrolment:** open to students of any college. Students register with email and password, add their college details, and upload a photo of their current college ID card; the instructor approves each registration.

## Week 1: Talk to the robot's computer

The Ubuntu terminal and Python from zero: move around, manage files, install software, and write your first programs.

### Day 1: Meet the terminal

- **Start here: how this course works** (10 min). Your 15-day route, the robot you will program, and how to use the animations, puzzles and practice tools. *Practice: animation, think-first, code tracer, match puzzle, flashcards, checklist.*
  Students can: Know the three weeks of the course and why they come in this order; Try each kind of interactive part once; Set up a study routine that works.
- **Meet the terminal** (15 min). What the terminal is, how to read the prompt, and your first commands. *Practice: practice terminal, quick checks.*
- **Folders and paths: moving around** (20 min). Move between folders with cd, and learn absolute and relative paths. *Practice: animation, practice terminal, game, sort puzzle, quick checks.*

### Day 2: Files, permissions and installing

- **Making, copying and deleting** (20 min). Create folders and files, then copy, move, rename and delete them safely. *Practice: practice terminal, match puzzle, quick checks.*
- **Reading and editing files** (20 min). Look inside files with cat, head and tail, and edit them with nano. *Practice: practice terminal, think-first, quick checks.*
- **Permissions and sudo** (20 min). Read rwx permissions, make a program runnable with chmod +x, and use sudo safely. *Practice: animation, practice terminal, quick checks.*
- **Installing software with apt** (20 min). Refresh the software list, search for packages, and install ROS 2 tools. *Practice: practice terminal, quick checks, match puzzle.*

### Day 3: Python from zero

- **Python 1: the robot's notebook** (25 min). Print messages, store values in variables, tell numbers from text, and ask questions with input(). *Practice: Python playground, code tracer, quick checks.*
  Students can: Print messages with print(); Store values in variables; Tell numbers and text apart; Ask the user a question with input().

### Day 4: Decisions and loops

- **Python 2: should the robot stop?** (30 min). Make decisions with if, elif and else, and repeat actions with for, while and break. *Practice: Python playground, code tracer, quick checks, spot-the-bug.*
  Students can: Compare values with <, > and ==; Make decisions with if, elif and else; Repeat with for and while; Stop a loop early with break.

### Day 5: Lists, dictionaries and functions

- **Python 3: memory and skills** (30 min). Keep many values in lists and dictionaries, and write your own functions. *Practice: Python playground, code tracer, match puzzle, quick checks.*
  Students can: Store many values in a list; Look up values by name in a dictionary; Write and use your own functions.

**Week 1 test: terminal and Python basics:** 15 questions, 35 minutes, 2 attempts (best score counts). Each student gets a different paper, built on the server from 98 question templates, one question at a time with a timer.

## Week 2: Build the robot's brain

Python objects, C++ from the basics, your first ROS 2 nodes, then installing ROS 2 Jazzy and setting up the robotics lab.

### Day 6: Python classes and objects

- **Classes and objects** (20 min). A class is a blueprint; an object is a robot built from it. *Practice: Python playground, animation, quick checks.*
- **Attributes and __init__** (20 min). Give every new object its starting values automatically, with __init__ and self. *Practice: Python playground, code tracer, quick checks.*
- **Methods: what an object can do** (20 min). Write methods that use and change an object's attributes. *Practice: Python playground, quick checks, spot-the-bug.*
- **Objects inside objects** (20 min). Build bigger objects from smaller ones, the way a ROS 2 node owns publishers and timers. *Practice: Python playground, quick checks, think-first.*

### Day 7: Inheritance, callbacks and your first node

- **Inheritance and super()** (25 min). Build a new class on top of an existing one, which is exactly how every ROS 2 node is written. *Practice: Python playground, match puzzle, quick checks.*
- **Callbacks and timers** (25 min). Hand a function over to be called later: the heartbeat of every ROS 2 program. *Practice: Python playground, animation, quick checks.*
- **Reading a real ROS 2 node** (30 min). Read a real ROS 2 publisher line by line, then add a listener. *Practice: Python playground, game, spot-the-bug, animation, quick checks.*

### Day 8: C++ basics

- **Hello, C++: compile and run** (30 min). Write, compile and run your first C++ program, and fix the most common error. *Practice: practice terminal, Python and C++ side by side, spot-the-bug, quick checks.*
  Students can: Write, compile and run a C++ program; Print with std::cout; Create variables with a type; Fix the most common error: a missing semicolon.
- **C++ decisions, loops, functions and vectors** (30 min). The Python skills you know, in C++: if, for, functions with types, and std::vector. *Practice: Python and C++ side by side, practice terminal, code tracer, quick checks.*
  Students can: Write if/else and for loops in C++; Write a C++ function with types; Keep many values in a std::vector.

### Day 9: C++ classes and ROS 2 C++ nodes

- **C++ classes: same blueprint, stricter rules** (30 min). Write a C++ class with a constructor, member functions, public and private, and inheritance. *Practice: Python and C++ side by side, match puzzle, quick checks.*
  Students can: Read and write a C++ class with a constructor and member functions; Use public and private; Recognise inheritance in C++.
- **Reading a real ROS 2 C++ node** (30 min). Find the class, constructor, publisher, timer and callback inside the official C++ publisher. *Practice: Python and C++ side by side, quick checks, match puzzle, game.*
  Students can: Find the class, constructor, publisher, timer and callback in an rclcpp node; Read std::make_shared and lambdas without fear; Match each C++ line with its Python twin.

### Day 10: Install ROS 2 and set up the lab

- **Get Ubuntu 24.04 ready** (20 min). Choose WSL2, dual boot, a virtual machine or the college lab, and check your computer. *Practice: checklist, quick checks, flashcards.*
  Students can: Choose how to get Ubuntu 24.04; Check that your computer is ready; Update Ubuntu before installing ROS 2.
- **Install ROS 2 Jazzy** (45 min). Rehearse the official installation in the practice terminal, then install on your own Ubuntu. *Practice: practice terminal, think-first, quick checks, game.*
  Students can: Follow the official ROS 2 Jazzy installation steps; Understand what each step does; Test the installation with a talker and a listener.
- **Environment variables, source and ~/.bashrc** (25 min). Why a new terminal forgets ROS 2, and how source and ~/.bashrc fix it. *Practice: practice terminal, game, think-first, quick checks.*
- **Set up the ROS 2 robotics lab** (45 min). Install Gazebo, ros2_control, Nav2, SLAM, TurtleBot3 and MoveIt, prepare rosdep and a workspace, and check everything. *Practice: practice terminal, checklist, quick checks, flashcards.*
  Students can: Install the lab packages for mobile robots and robot arms; Prepare rosdep and a colcon workspace; Check everything with the lab checklist.

**Week 2 test: objects, C++ and ROS 2 setup:** 15 questions, 35 minutes, 2 attempts (best score counts). Each student gets a different paper, built on the server from 98 question templates, one question at a time with a timer.

## Week 3: Speak ROS 2

The core ideas of ROS 2, hands-on in a practice terminal: nodes, topics, messages, services, parameters, actions, launch files, packages, TF2 and debugging tools. Ends with a mini-project.

### Day 11: The ROS 2 graph

- **What ROS 2 really is** (20 min). The big picture: why robots are built from many small programs, and where ROS 2 sits. *Practice: animation, think-first, sort puzzle, quick checks, flashcards.*
  Students can: Explain what ROS 2 is (and what it is not); Name the parts of the ROS 2 graph: nodes, topics, services, actions, parameters; Say why robots are built from many small programs.
- **Nodes: the robot's team members** (25 min). Start nodes with ros2 run, list them, inspect them with ros2 node info, and rename one. *Practice: practice terminal, match puzzle, quick checks.*
  Students can: Start a node with ros2 run <package> <executable>; See running nodes with ros2 node list; Read ros2 node info and rename a node with --ros-args --remap.

### Day 12: Topics and messages

- **Topics: publish and subscribe** (30 min). How nodes stream data on topics, and how to spy on them with ros2 topic. *Practice: animation, practice terminal, spot-the-bug, think-first, quick checks, game.*
  Students can: Explain publish and subscribe; Use ros2 topic list, info, echo and hz; Spot the most common topic bug: a wrong name.
- **Messages: what travels on a topic** (25 min). Read message types with ros2 interface show, then drive the turtle with ros2 topic pub. *Practice: animation, practice terminal, match puzzle, quick checks.*
  Students can: Read a message definition with ros2 interface show; Understand geometry_msgs/msg/Twist (linear and angular speed); Publish a message from the terminal with ros2 topic pub.
- **Write a publisher and a subscriber** (35 min). Write Python nodes that publish speed commands and react to incoming messages. *Practice: code tracer, Python playground, spot-the-bug, quick checks.*
  Students can: Create a publisher and publish from a timer callback; Create a subscriber whose callback runs for every message; Find the classic publisher and subscriber mistakes.

### Day 13: Services and parameters

- **Services: ask a question, get an answer** (30 min). Call services from the terminal, then write a service server and client in Python. *Practice: animation, practice terminal, Python playground, sort puzzle, quick checks.*
  Students can: Explain request and response, and when to use a service instead of a topic; Use ros2 service list, type and call; Write a service server callback in Python.
- **Parameters: settings you can change** (25 min). Read and change node settings with ros2 param, and declare parameters in Python. *Practice: animation, practice terminal, Python playground, quick checks.*
  Students can: Explain what a parameter is; Use ros2 param list, get, set and dump; Declare and read a parameter in Python.

### Day 14: Actions and launch files

- **Actions: long jobs with feedback** (25 min). Send goals, watch feedback and get results with ros2 action, and choose between topics, services and actions. *Practice: animation, practice terminal, sort puzzle, quick checks, game.*
  Students can: Explain goal, feedback, result and cancel; Use ros2 action list, info and send_goal; Choose correctly between topics, services and actions.
- **Launch files: start everything at once** (25 min). Start many nodes, with their settings, from one command with ros2 launch. *Practice: animation, practice terminal, quick checks.*
  Students can: Explain what a launch file does; Read a Python launch file; Start one with ros2 launch <package> <file>.

### Day 15: Packages, frames and tools

- **Packages and workspaces: build, source, run** (35 min). Create your own package with ros2 pkg create, build it with colcon, source it and run it. *Practice: animation, practice terminal, quick checks.*
  Students can: Explain workspace, package, build, install and overlay; Create a Python package with ros2 pkg create; Build with colcon build, source install/setup.bash, and run your node.
- **Coordinate frames and TF2** (20 min). Why every robot part has its own coordinate frame, and how TF2 converts between them. *Practice: animation, think-first, quick checks, match puzzle.*
  Students can: Explain what a coordinate frame is; Name the usual frames: map, odom, base_link, laser; Say what TF2 does for you.
- **Your debugging toolbox** (25 min). Record and replay data with ros2 bag, see the graph with rqt_graph, and pick the right tool for each problem. *Practice: practice terminal, match puzzle, checklist, quick checks.*
  Students can: Record, inspect and replay topics with ros2 bag; Know when to use rqt_graph, echo, hz, node info and ros2 doctor; Follow a simple debugging checklist.
- **Mini-project: design Chiku's ROS 2 graph** (35 min). Put the whole week together: design the graph of a delivery robot, then build one node that uses a parameter, two publishers and a service. *Practice: sort puzzle, think-first, Python playground, spot-the-bug, flashcards.*
  Students can: Choose topics, services, actions and parameters for real features; Read a graph and predict what breaks; Write a node that combines a parameter, publishers and a service.

**Week 3 test: ROS 2 core concepts:** 15 questions, 35 minutes, 2 attempts (best score counts). Each student gets a different paper, built on the server from 98 question templates, one question at a time with a timer.

## Software used

Ubuntu 24.04, ROS 2 Jazzy Jalisco (long-term support until 2029), turtlesim, Gazebo Harmonic (ros_gz), ros2_control, Nav2, slam_toolbox, Cartographer, TurtleBot3, MoveIt 2, colcon and rosdep. Days 1 to 9 and all of Week 3 work in a browser; Day 10 needs Ubuntu 24.04 (WSL2, dual boot, virtual machine or the college lab), where students can then repeat every Week 3 exercise for real.
