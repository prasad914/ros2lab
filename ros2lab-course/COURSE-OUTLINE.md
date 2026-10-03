# ROS 2 from zero, in seven weeks: course outline

A free online course on www.ros2lab.com for engineering students, designed for beginners and slow learners. 113 lessons of up to 30 minutes over 35 study days. Every lesson: a short story about Chiku the delivery robot, an "In plain words" summary, goals, slow step-by-step worked examples, interactive animations, practice in the browser (a simulated Ubuntu terminal with tabs, a live ROS 2 graph, TurtleSim, arm and mobile-base windows, or a Python playground with a practice rclpy), puzzles, common mistakes, quick checks, a recap and flashcards.

Weeks 6 and 7 show every node in **Python and C++**. All of their code was built and run on a real ROS 2 Jazzy system (colcon build, colcon test with 30 unit tests, and runtime checks with turtlesim) before it was put into the lessons.

## Week 1: Talk to the robot's computer

The Ubuntu terminal and Python from zero: move around, manage files, install software, and write your first programs.


### Day 1: Meet the terminal

- **Start here: how this course works** (30 min). Your 35-day route, the robot you will program, and how to use the animations, puzzles and practice tools. *Practice: animation, think-first, step-through code, matching puzzle, flashcards, checklist, Python playground, sorting puzzle, ordering puzzle, quick checks.*
- **Meet the terminal** (30 min). What the terminal is, how to read the prompt, and your first commands. *Practice: practice terminal, quick checks, flashcards.*
- **Folders and paths: moving around (part 1)** (30 min). Move between folders with `cd`, and learn absolute and relative paths. *Practice: animation, practice terminal, game, quick checks, matching puzzle.*
- **Folders and paths: moving around (part 2)** (30 min). Part 2: Walking a path, one step at a time. *Practice: practice terminal, sorting puzzle, quick checks, flashcards.*

### Day 2: Files, permissions and installing

- **Making, copying and deleting (part 1)** (30 min). Create folders and files, then copy, move, rename and delete them safely. *Practice: practice terminal, matching puzzle, quick checks.*
- **Making, copying and deleting (part 2)** (30 min). Part 2: Copy, move or rename? Decide slowly. *Practice: practice terminal, quick checks, ordering puzzle, flashcards.*
- **Reading and editing files** (30 min). Look inside files with `cat`, `head` and `tail`, and edit them with `nano`. *Practice: practice terminal, think-first, quick checks, flashcards.*
- **Permissions and sudo (part 1)** (30 min). Read rwx permissions, make a program runnable with `chmod +x`, and use `sudo` safely. *Practice: animation, practice terminal, quick checks.*
- **Permissions and sudo (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, quick checks, flashcards.*
- **Installing software with apt** (30 min). Refresh the software list, search for packages, and install ROS 2 tools. *Practice: practice terminal, ordering puzzle, matching puzzle, quick checks, flashcards.*

### Day 3: Python from zero

- **Python 1: the robot's notebook (part 1)** (30 min). Print messages, store values in variables, tell numbers from text, and ask questions with `input()`. *Practice: Python playground, quick checks.*
- **Python 1: the robot's notebook (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: step-through code, Python playground, quick checks, flashcards.*

### Day 4: Decisions and loops

- **Python 2: should the robot stop? (part 1)** (30 min). Make decisions with `if`, `elif` and `else`, and repeat actions with `for`, `while` and `break`. *Practice: Python playground, quick checks.*
- **Python 2: should the robot stop? (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: step-through code, Python playground, quick checks, ordering puzzle, spot-the-bug, flashcards.*

### Day 5: Lists, dictionaries and functions

- **Python 3: memory and skills** (30 min). Keep many values in lists and dictionaries, and write your own functions. *Practice: Python playground, step-through code, matching puzzle, quick checks, flashcards.*

**Week 1 test: terminal and Python basics:** 15 questions, 35 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 209 question templates.

## Week 2: Build the robot's brain

Python objects, C++ from the basics, your first ROS 2 nodes, then installing ROS 2 Jazzy and setting up the robotics lab.


### Day 6: Python classes and objects

- **Classes and objects** (30 min). A class is a blueprint; an object is a robot built from it. *Practice: Python playground, animation, quick checks, flashcards.*
- **Attributes and __init__** (30 min). Give every new object its starting values automatically, with `__init__` and `self`. *Practice: Python playground, step-through code, quick checks, flashcards.*
- **Methods: what an object can do** (30 min). Write methods that use and change an object's attributes. *Practice: Python playground, step-through code, quick checks, spot-the-bug, flashcards.*
- **Objects inside objects** (30 min). Build bigger objects from smaller ones, the way a ROS 2 node owns publishers and timers. *Practice: Python playground, ordering puzzle, quick checks, think-first, flashcards.*

### Day 7: Inheritance, callbacks and your first node

- **Inheritance and super()** (30 min). Build a new class on top of an existing one, which is exactly how every ROS 2 node is written. *Practice: Python playground, matching puzzle, quick checks, ordering puzzle, flashcards.*
- **Callbacks and timers** (30 min). Hand a function over to be called later: the heartbeat of every ROS 2 program. *Practice: Python playground, animation, think-first, quick checks, flashcards.*
- **Reading a real ROS 2 node** (30 min). Read a real ROS 2 publisher line by line, then add a listener. *Practice: Python playground, game, spot-the-bug, animation, quick checks, ordering puzzle, flashcards.*

### Day 8: C++ basics

- **Hello, C++: compile and run** (30 min). Write, compile and run your first C++ program, and fix the most common error. *Practice: practice terminal, Python and C++ side by side, spot-the-bug, quick checks, flashcards.*
- **C++ decisions, loops, functions and vectors** (30 min). The Python skills you know, in C++: `if`, `for`, functions with types, and `std::vector`. *Practice: Python and C++ side by side, practice terminal, step-through code, quick checks, ordering puzzle, flashcards.*

### Day 9: C++ classes and ROS 2 C++ nodes

- **C++ classes: same blueprint, stricter rules** (30 min). Write a C++ class with a constructor, member functions, `public` and `private`, and inheritance. *Practice: Python and C++ side by side, matching puzzle, quick checks, flashcards, spot-the-bug, ordering puzzle, think-first.*
- **Reading a real ROS 2 C++ node** (30 min). Find the class, constructor, publisher, timer and callback inside the official C++ publisher. *Practice: Python and C++ side by side, quick checks, matching puzzle, game, flashcards.*

### Day 10: Install ROS 2 and set up the lab

- **Get Ubuntu 24.04 ready** (30 min). Choose WSL2, dual boot, a virtual machine or the college lab, and check your computer. *Practice: checklist, practice terminal, think-first, quick checks, flashcards, matching puzzle, ordering puzzle.*
- **Install ROS 2 Jazzy (part 1)** (30 min). Rehearse the official installation in the practice terminal, then install on your own Ubuntu. *Practice: practice terminal, quick checks.*
- **Install ROS 2 Jazzy (part 2)** (30 min). Part 2: Now on your real computer; Test with two terminals; If something goes wrong. *Practice: think-first, quick checks, ordering puzzle, game, flashcards.*
- **Environment variables, source and ~/.bashrc** (30 min). Why a new terminal forgets ROS 2, and how `source` and `~/.bashrc` fix it. *Practice: practice terminal, game, think-first, quick checks, flashcards.*
- **Set up the ROS 2 robotics lab** (30 min). Install Gazebo, ros2_control, Nav2, SLAM, TurtleBot3 and MoveIt, prepare rosdep and a workspace, and check everything. *Practice: practice terminal, checklist, quick checks, flashcards.*

**Week 2 test: objects, C++ and ROS 2 setup:** 15 questions, 35 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 209 question templates.

## Week 3: Introduction to ROS

Why robots need a software platform, the goals, parts and ecosystem of ROS, its history and versions, ROS 1 vs ROS 2, middleware, DDS and Quality of Service.


### Day 11: Why robots need ROS

- **Why robots need a software platform** (30 min). The problems every robot team faces, and how a software platform like ROS solves them. *Practice: animation, practice terminal, matching puzzle, think-first, sorting puzzle, quick checks, flashcards.*
- **What ROS was built to do** (30 min). The five original objectives of ROS, and the new goals that led to ROS 2. *Practice: practice terminal, sorting puzzle, matching puzzle, think-first, quick checks, flashcards.*

### Day 12: Inside ROS and its ecosystem

- **The parts of ROS** (30 min). Communication (nodes, topics, services, actions, parameters), tools and ready-made capabilities. *Practice: animation, sorting puzzle, practice terminal, think-first, matching puzzle, quick checks, flashcards.*
- **The ROS ecosystem** (30 min). Packages, distributions, ROS Index, rosdep, REPs, the community and the big projects around ROS. *Practice: practice terminal, quick checks, flashcards.*

### Day 13: History and versions

- **The ROS story: 2007 to 2026** (30 min). From a Stanford project and Willow Garage to ROS 2, OSRA, the end of ROS 1 and Lyrical. *Practice: animation, matching puzzle, ordering puzzle, think-first, quick checks, flashcards, sorting puzzle.*
- **ROS versions: which one and why** (30 min). Distribution names, the LTS rule, matching Ubuntu versions, and why this course uses Jazzy. *Practice: animation, practice terminal, sorting puzzle, quick checks, flashcards, matching puzzle, think-first.*

### Day 14: ROS 1 vs ROS 2 and middleware

- **ROS 1 vs ROS 2** (30 min). No master, DDS, colcon, Python 3, QoS, security, real-time and more: what changed and why. *Practice: animation, matching puzzle, think-first, spot-the-bug, sorting puzzle, quick checks, flashcards, practice terminal.*
- **Middleware: the robot's postal service** (30 min). What middleware is, publish/subscribe vs request/response, and the rclpy → rcl → rmw → DDS layers. *Practice: animation, ordering puzzle, practice terminal, quick checks, think-first, flashcards, matching puzzle.*
- **Why use ROS 2** (30 min). Support until 2029, security, real-time, embedded chips, a huge ecosystem and industry backing. *Practice: practice terminal, flashcards, sorting puzzle, quick checks, think-first.*

### Day 15: DDS and Quality of Service

- **DDS: how nodes find each other** (30 min). The DDS standard, automatic discovery (SPDP and SEDP), domains and ROS_DOMAIN_ID. *Practice: animation, think-first, practice terminal, quick checks, flashcards, matching puzzle.*
- **Quality of Service (QoS)** (30 min). Reliability, durability, history and depth; ROS 2 QoS profiles; and the compatibility rule. *Practice: animation, sorting puzzle, Python playground, practice terminal, quick checks, flashcards.*

**Week 3 test: Introduction to ROS:** 15 questions, 35 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 209 question templates.

## Week 4: Speak ROS 2

The core ideas of ROS 2, hands-on in a practice terminal: nodes, topics, messages, services, parameters, actions, launch files, packages, TF2 and debugging tools. Ends with a mini-project.


### Day 16: The ROS 2 graph

- **What ROS 2 really is** (30 min). The big picture: why robots are built from many small programs, and where ROS 2 sits. *Practice: animation, think-first, practice terminal, sorting puzzle, quick checks, flashcards, matching puzzle.*
- **Nodes: the robot's team members** (30 min). Start nodes with `ros2 run`, list them, inspect them with `ros2 node info`, and rename one. *Practice: practice terminal, matching puzzle, quick checks, flashcards.*

### Day 17: Topics and messages

- **Topics: publish and subscribe** (30 min). How nodes stream data on topics, and how to spy on them with `ros2 topic`. *Practice: animation, practice terminal, spot-the-bug, think-first, quick checks, game, flashcards.*
- **Messages: what travels on a topic** (30 min). Read message types with `ros2 interface show`, then drive the turtle with `ros2 topic pub`. *Practice: animation, practice terminal, matching puzzle, quick checks, flashcards.*
- **Write a publisher and a subscriber** (30 min). Write Python nodes that publish speed commands and react to incoming messages. *Practice: step-through code, Python playground, spot-the-bug, ordering puzzle, quick checks, flashcards, think-first.*

### Day 18: Services and parameters

- **Services: ask a question, get an answer** (30 min). Call services from the terminal, then write a service server and client in Python. *Practice: animation, practice terminal, Python playground, sorting puzzle, quick checks, flashcards.*
- **Parameters: settings you can change (part 1)** (30 min). Read and change node settings with `ros2 param`, and declare parameters in Python. *Practice: animation, practice terminal, quick checks, matching puzzle.*
- **Parameters: settings you can change (part 2)** (30 min). Part 2: Parameters in your own node. *Practice: Python playground, practice terminal, quick checks, flashcards.*

### Day 19: Actions and launch files

- **Actions: long jobs with feedback** (30 min). Send goals, watch feedback and get results with `ros2 action`, and choose between topics, services and actions. *Practice: animation, practice terminal, sorting puzzle, quick checks, game, flashcards.*
- **Launch files: start everything at once** (30 min). Start many nodes, with their settings, from one command with `ros2 launch`. *Practice: animation, practice terminal, matching puzzle, think-first, ordering puzzle, quick checks, flashcards, spot-the-bug.*

### Day 20: Packages, frames and tools

- **Packages and workspaces: build, source, run** (30 min). Create your own package with `ros2 pkg create`, build it with `colcon`, source it and run it. *Practice: animation, practice terminal, ordering puzzle, quick checks, flashcards, think-first.*
- **Coordinate frames and TF2** (30 min). Why every robot part has its own coordinate frame, and how TF2 converts between them. *Practice: animation, think-first, quick checks, matching puzzle, flashcards, Python playground, sorting puzzle.*
- **Your debugging toolbox** (30 min). Record and replay data with `ros2 bag`, see the graph with rqt_graph, and pick the right tool for each problem. *Practice: practice terminal, matching puzzle, checklist, quick checks, flashcards, think-first.*
- **Mini-project: design Chiku's ROS 2 graph** (30 min). Put the whole week together: design the graph of a delivery robot, then build one node that uses a parameter, two publishers and a service. *Practice: sorting puzzle, think-first, Python playground, spot-the-bug, flashcards, practice terminal, quick checks.*

**Week 4 test: ROS 2 core concepts:** 15 questions, 35 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 209 question templates.

## Week 5: ROS Programming Fundamentals

Write real ROS 2 programs in Python and C++: packages and nodes, topics, custom interfaces, services, actions, parameters with YAML files and callbacks, and launch files.


### Day 21: Packages, nodes and topics in code

- **Packages and nodes, the right way** (30 min). Create Python and C++ packages, write a node as a class, register it, build and run it. *Practice: animation, practice terminal, Python and C++ side by side, spot-the-bug, ordering puzzle, quick checks, flashcards.*
- **Publishers and subscribers in Python and C++** (30 min). Write a topic publisher and subscriber in both languages, choose the queue/QoS, and test them from the terminal. *Practice: Python and C++ side by side, Python playground, spot-the-bug, practice terminal, quick checks, flashcards.*

### Day 22: Custom interfaces and services

- **Custom interfaces: your own messages** (30 min). Create an interfaces package with a .msg file, generate code with rosidl, and use the message from Python and C++. *Practice: animation, practice terminal, spot-the-bug, Python and C++ side by side, Python playground, quick checks, flashcards.*
- **Services: write a server and a client** (30 min). Write service servers and clients in Python and C++, use call_async safely, and create a custom service. *Practice: animation, Python and C++ side by side, Python playground, practice terminal, quick checks, flashcards.*

### Day 23: Actions

- **Actions: write an action server and client** (30 min). Define a custom action, write a server that sends feedback, write a client, and see the 3 services + 2 topics underneath. *Practice: animation, Python playground, practice terminal, ordering puzzle, quick checks, flashcards.*

### Day 24: Parameters

- **Parameters: declare, YAML files and callbacks** (30 min). Declare and read parameters in Python and C++, store them in YAML files, and validate changes with callbacks. *Practice: animation, Python and C++ side by side, Python playground, practice terminal, quick checks, flashcards.*

### Day 25: Launch files and mini-project

- **Launch files: XML and Python** (30 min). Write XML and Python launch files, install them, and configure nodes: names, namespaces, remaps, parameters and arguments. *Practice: animation, Python and C++ side by side, practice terminal, sorting puzzle, quick checks, flashcards.*
- **Mini-project: Chiku's battery monitor** (30 min). Combine a custom message, a publisher, a subscriber and a parameter into a small working system. *Practice: Python playground, think-first, checklist, flashcards, ordering puzzle.*

**Week 5 test: ROS programming fundamentals:** 15 questions, 40 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 209 question templates.

## Week 6: Writing your own ROS 2 nodes

Write real nodes that control a robot, each one in Python AND in C++: timers, logging, open- and closed-loop driving, messages, QoS, custom interfaces, services, actions, parameters, launch, tf2, executors, lifecycle, components and tests. Every lesson has a live Ubuntu terminal.


### Day 26: Your own nodes, step by step

- **Anatomy of a node: the 5 steps in Python and C++ (part 1)** (30 min). Every ROS 2 program follows the same five steps. Write the smallest real node in Python and in C++, register it, build it and run both versions side by side. *Practice: animation, Python and C++ side by side, step-through code, Python playground.*
- **Anatomy of a node: the 5 steps in Python and C++ (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, spot-the-bug, ordering puzzle, matching puzzle, think-first, quick checks, flashcards.*
- **Timers and time: give your robot a heartbeat** (30 min). Make a node do something regularly with a timer, measure time with the node's clock, choose good rates, and stop a timer after N ticks. *Practice: Python and C++ side by side, step-through code, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Package files in depth: package.xml, setup.py and CMakeLists.txt** (30 min). Understand every important line of the three package files, add a dependency correctly, and fix the three most common build errors in a live terminal. *Practice: Python and C++ side by side, sorting puzzle, practice terminal, quick checks, flashcards.*
- **Logging like a pro: levels, throttle and once** (30 min). Use the five log levels, show only what matters with --log-level, avoid flooding the screen with throttle and once, and log the same way in Python and C++. *Practice: Python and C++ side by side, Python playground, practice terminal, sorting puzzle, matching puzzle, quick checks, flashcards.*
- **Your first robot controller: open-loop driving (part 1)** (30 min). Write a node that drives turtlesim by publishing Twist messages from a timer: a circle, then a square with a small state machine. See why open loop is never exact. *Practice: animation, Python and C++ side by side, step-through code, Python playground.*
- **Your first robot controller: open-loop driving (part 2)** (30 min). Part 2: Why the square is never perfect. *Practice: practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*

### Day 27: Closing the loop: sense, decide, act

- **Listening to the robot: a pose subscriber** (30 min). Subscribe to the robot's pose, keep the latest message in the node, compute the distance travelled, and report it from a timer. Python and C++. *Practice: Python and C++ side by side, step-through code, Python playground, practice terminal, spot-the-bug, ordering puzzle, quick checks, flashcards.*
- **Closed-loop control: go to a goal by yourself (part 1)** (30 min). Combine a pose subscriber, a timer and a Twist publisher into a P-controller that drives the robot to any goal, with gains as parameters. Python and C++. *Practice: animation, Python and C++ side by side, step-through code, Python playground.*
- **Closed-loop control: go to a goal by yourself (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, sorting puzzle, spot-the-bug, quick checks, flashcards.*
- **A safety filter node: chaining nodes with remapping** (30 min). Write a node that sits between a driver and the robot, limits speed and blocks driving into walls, and connect it with topic remapping instead of changing code. *Practice: Python and C++ side by side, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Building messages in code: nested fields, arrays and stamps** (30 min). Fill nested message fields, lists (arrays) and header time stamps in Python and C++, using sensor_msgs/JointState and geometry_msgs/PoseStamped as examples. *Practice: Python and C++ side by side, sorting puzzle, Python playground, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **QoS in code: reliable, best effort and latched topics** (30 min). Choose QoS profiles in Python and C++: sensor data (best effort), commands (reliable) and latched status (transient local), and see a late subscriber still get the message. *Practice: animation, Python and C++ side by side, Python playground, practice terminal, sorting puzzle, quick checks, flashcards.*

### Day 28: Your own interfaces, services and actions

- **A custom message for robot status: RobotStatus.msg (part 1)** (30 min). Design a .msg for the robot's status, build it in an interfaces package, and publish it from Python and C++ nodes that also read the turtle's pose. *Practice: animation, code tabs, Python and C++ side by side, sorting puzzle, Python playground.*
- **A custom message for robot status: RobotStatus.msg (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **A service that controls the robot: enable and disable driving (part 1)** (30 min). Write a service server that switches the robot's driving on and off (std_srvs/SetBool), in Python and C++, and call it from the terminal. *Practice: animation, Python and C++ side by side, step-through code, Python playground.*
- **A service that controls the robot: enable and disable driving (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **Service clients: let your node use turtlesim's services** (30 min). Write a client node that spawns a turtle, changes its pen and teleports it to draw a triangle: async calls in Python and C++, and why you must never block inside a callback. *Practice: animation, Python and C++ side by side, Python playground, practice terminal, spot-the-bug, ordering puzzle, quick checks, flashcards.*
- **Your own service type: GoTo.srv drives the robot** (30 min). Design GoTo.srv, write a server that checks the request, answers at once and then drives to the point with a timer, and call it with valid and invalid goals. *Practice: code tabs, Python and C++ side by side, Python playground, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **An action server: drive a distance with feedback (part 1)** (30 min). Write DriveDistance.action and an action server that accepts or rejects goals, sends feedback while driving, handles cancel and returns a result. Python and C++. *Practice: animation, code tabs, Python and C++ side by side, step-through code, Python playground.*
- **An action server: drive a distance with feedback (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, spot-the-bug, ordering puzzle, quick checks, flashcards.*

### Day 29: Action clients, parameters, launch and frames

- **An action client: send a goal, follow progress, cancel** (30 min). Write a client node that sends a DriveDistance goal, prints feedback, reads the result and can cancel after a delay, using callbacks in Python and SendGoalOptions in C++. *Practice: Python and C++ side by side, step-through code, Python playground, practice terminal, matching puzzle, ordering puzzle, quick checks, flashcards.*
- **Parameters in depth: descriptors, ranges, read-only and callbacks (part 1)** (30 min). Describe parameters with ParameterDescriptor (description, read-only, ranges), validate changes in an on-set callback, react to them live, and store them in YAML. Python and C++. *Practice: animation, Python and C++ side by side, step-through code, Python playground.*
- **Parameters in depth: descriptors, ranges, read-only and callbacks (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, spot-the-bug, sorting puzzle, quick checks, flashcards.*
- **Launch in depth: arguments, YAML, namespaces and two robots** (30 min). Write the same launch file in Python, XML and YAML, pass arguments, load a parameter file, start two robots in two namespaces, use a condition, and run it all in the terminal. *Practice: animation, Python and C++ side by side, code tabs, practice terminal, matching puzzle, quick checks, flashcards.*
- **Publishing frames: a tf2 broadcaster** (30 min). Turn the robot's pose into a moving coordinate frame (world -> turtle1) with tf2's TransformBroadcaster, including the yaw-to-quaternion step, in Python and C++. *Practice: animation, Python and C++ side by side, step-through code, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Using frames: a tf2 listener that follows another robot** (30 min). Ask tf2 where one robot is seen from another (lookup_transform), handle the case where a frame is not there yet, and turn the answer into a chase controller. Launch it all together. *Practice: Python and C++ side by side, step-through code, code tabs, Python playground, practice terminal, spot-the-bug, quick checks, flashcards.*

### Day 30: Structure, testing and your first complete robot program

- **Executors and callback groups: waiting without freezing** (30 min). Understand what the executor does, why a blocking call inside a callback deadlocks, and how callback groups plus a MultiThreadedExecutor make it safe. Python and C++. *Practice: animation, Python and C++ side by side, step-through code, Python playground, practice terminal, sorting puzzle, quick checks, flashcards.*
- **Lifecycle nodes and components: starting robots safely and efficiently (part 1)** (30 min). Write a managed (lifecycle) node that only drives after configure and activate, control it from the terminal, then build a C++ component and load it into a container. *Practice: Python and C++ side by side, practice terminal, code tabs.*
- **Lifecycle nodes and components: starting robots safely and efficiently (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, Python playground, matching puzzle, quick checks, flashcards.*
- **Testing your nodes: pytest and gtest** (30 min). Move the controller maths into pure functions, test them with pytest (Python) and gtest (C++), run colcon test and read the results. *Practice: code tabs, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Mini-project: Chiku's patrol robot (part 1)** (30 min). Put the week together: a patrol node with waypoint parameters, a pause service, a custom status topic, tested maths, a YAML config and a launch file, in Python and C++. *Practice: checklist, Python and C++ side by side, code tabs, step-through code, Python playground.*
- **Mini-project: Chiku's patrol robot (part 2)** (30 min). Part 2: Make it yours: extension ideas. *Practice: practice terminal, ordering puzzle, quick checks, flashcards.*

**Week 6 test: writing your own ROS 2 nodes:** 16 questions, 40 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 209 question templates.

## Week 7: Kinematics nodes for arms and mobile robots

Advanced: frames and quaternions, forward and inverse kinematics of a 2-link arm, user-to-robot interfaces, smooth joint trajectories, differential-drive kinematics, wheel odometry with TF, and a mobile manipulator that drives and then reaches. Python and C++, with live robot terminals.


### Day 31: Describe the robot: links, joints and frames

- **Describe your robot: URDF links, joints and robot_state_publisher** (30 min). Write a URDF for a 2-link arm (links, joints, origins, axes, limits), let robot_state_publisher turn joint angles into TF frames, and check the tool frame with tf2_echo. *Practice: code tabs, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Frames and transforms: rotate, move, chain** (30 min). Rotate a point, move it from the robot frame to the world frame and back, chain two transforms, and use quaternions for orientation, by hand in Python and with tf2's math classes in C++. *Practice: animation, Python and C++ side by side, Python playground, practice terminal, spot-the-bug, ordering puzzle, quick checks, flashcards.*
- **Forward kinematics: where is the arm's tip?** (30 min). Compute the tip position of a 2-link arm from its joint angles (forward kinematics), write an FK node that turns /joint_states into /end_effector, and test it live. *Practice: code tabs, Python and C++ side by side, step-through code, Python playground, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*

### Day 32: Arm kinematics: from angles to positions and back

- **Inverse kinematics: which angles reach this point?** (30 min). Solve the 2-link arm's inverse kinematics with the law of cosines, find both elbow-up and elbow-down solutions, detect unreachable points, and verify every answer with FK. *Practice: animation, code tabs, step-through code, Python playground, practice terminal, sorting puzzle, quick checks, flashcards.*
- **An IK node: publish joint angles for any target** (30 min). Wrap the IK maths in a node: subscribe to /target_point, publish /joint_states continuously, use link lengths and elbow_up as parameters, and handle unreachable targets. Python and C++. *Practice: Python and C++ side by side, step-through code, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Talking to the robot: a MoveArm service and a command-line client** (30 min). Give people a simple way to command the arm: a MoveArm service that answers with the joint angles or a clear refusal, and a small client program that reads targets typed by the user. Python and C++. *Practice: code tabs, Python and C++ side by side, Python playground, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*

### Day 33: Smooth motion and wheeled robots

- **Smooth joint trajectories: no more jumping arms** (30 min). Move the joints smoothly from the current pose to the IK solution: timing from a speed limit, smoothstep interpolation, streaming joint states at 50 Hz, and the standard JointTrajectory message. *Practice: Python and C++ side by side, step-through code, code tabs, Python playground, practice terminal, spot-the-bug, quick checks, flashcards.*
- **Differential drive: two wheels, one robot (part 1)** (30 min). Learn the kinematics of a two-wheeled robot: from wheel speeds to body speed (forward) and from a Twist to wheel speeds (inverse), with wheel-speed limits that keep the path's shape. Python and C++. *Practice: animation, code tabs, Python and C++ side by side, step-through code, Python playground.*
- **Differential drive: two wheels, one robot (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, matching puzzle, quick checks, flashcards.*

### Day 34: Odometry: where has the robot gone?

- **Wheel odometry: publish where the robot is (Odometry + TF) (part 1)** (30 min). Turn wheel angle changes into small steps, add them up into a pose, and publish nav_msgs/Odometry and the odom -> base_link transform. Run the full base chain from a launch file. *Practice: code tabs, Python and C++ side by side, step-through code, Python playground.*
- **Wheel odometry: publish where the robot is (Odometry + TF) (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **Why odometry drifts: errors, covariance and sensor fusion** (30 min). See how a 5 % wheel-size error or a slipping wheel makes odometry drift, compare the estimate with the real path, and learn how covariance and sensor fusion (IMU, lidar, robot_localization) fix it. *Practice: Python playground, practice terminal, sorting puzzle, quick checks, flashcards.*

### Day 35: Mobile manipulation: drive, then reach

- **Mobile manipulator kinematics: frames from the floor to the gripper** (30 min). Combine a mobile base and an arm: the frame chain odom -> base_link -> arm_base -> tool, turning a goal from the odom frame into the arm's frame, checking reach, and choosing where to park the base. *Practice: animation, code tabs, Python playground, practice terminal, spot-the-bug, ordering puzzle, quick checks, flashcards.*
- **The mobile manipulator node: drive, then reach (part 1)** (30 min). Write mm_planner, a state machine (IDLE, TURN, DRIVE, REACH) that reads /odom and /goal_point, drives the base with /cmd_vel and sends the converted goal to the IK node. Launch the whole robot and run it live. Python and C++. *Practice: Python and C++ side by side, step-through code, code tabs, Python playground.*
- **The mobile manipulator node: drive, then reach (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **Capstone: your robot, end to end, and where to go next** (30 min). Run, inspect and test the whole system you built (arm IK, trajectories, base odometry, planner), choose a capstone extension, and see how ros2_control, MoveIt 2, Nav2 and Gazebo take these ideas to real robots. *Practice: practice terminal, checklist, Python playground, sorting puzzle, quick checks, flashcards.*

**Week 7 test: kinematics nodes for arms and mobile robots:** 16 questions, 40 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 209 question templates.
