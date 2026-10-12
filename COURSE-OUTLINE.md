# ROS 2 from zero, in six weeks: course outline

A free online course on www.ros2lab.com for engineering students, designed for beginners and slow learners. 95 lessons of up to 30 minutes over 30 study days. Every lesson: a short story about Chiku the delivery robot, an "In plain words" summary, goals, slow step-by-step worked examples, interactive animations, practice in the browser (a simulated Ubuntu terminal with tabs, a live ROS 2 graph and TurtleSim windows, or a Python playground with a practice rclpy), puzzles, common mistakes, quick checks, a recap and flashcards.

Week 5 teaches every idea twice, in a **Python chapter and a separate C++ chapter**. Week 6 then shows every robot-control node in Python and C++. All of their code was built and run on a real ROS 2 Jazzy system (colcon build with zero compiler warnings, colcon test with 12 unit tests, and runtime checks with turtlesim) before it was put into the lessons.

## Week 1: Talk to the robot's computer

The Ubuntu terminal and Python from zero: move around, manage files, install software, and write your first programs.


### Day 1: Meet the terminal

- **Start here: how this course works** (30 min). Your 30-day route, the robot you will program, and how to use the animations, puzzles and practice tools. *Practice: animation, think-first, step-through code, matching puzzle, flashcards, checklist, Python playground, sorting puzzle, ordering puzzle, quick checks.*
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

**Week 1 test: terminal and Python basics:** 15 questions, 35 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 188 question templates.

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

**Week 2 test: objects, C++ and ROS 2 setup:** 15 questions, 35 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 188 question templates.

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

**Week 3 test: Introduction to ROS:** 15 questions, 35 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 188 question templates.

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

**Week 4 test: ROS 2 core concepts:** 15 questions, 35 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 188 question templates.

## Week 5: ROS Programming Fundamentals

Write your own ROS 2 programs, one idea at a time, first in Python and then in C++: packages and nodes, timers and publishers, subscribers, custom messages, services and clients, actions, parameters and launch files, and a mini-project. Every chapter has a live Ubuntu terminal with TurtleSim.


### Day 21: Your first package, node and publisher

- **Python: your first package and node** (30 min). Create a Python package with ros2 pkg create, understand every file in it, write a node class that follows the five steps, register it, build it with colcon and run it. *Practice: step-through code, practice terminal, spot-the-bug, quick checks, flashcards.*
- **C++: your first package and node** (30 min). Create a C++ package, read its CMakeLists.txt, write the same hello node in rclcpp, tell CMake to compile and install it, build it and run it. Learn the C++ words you need on the way. *Practice: step-through code, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **Python: a timer and a publisher drive the turtle** (30 min). Add a timer and a publisher to a Python node, fill a Twist message, and make turtlesim draw a circle with your own code. Check it with ros2 topic tools. *Practice: animation, step-through code, Python playground, practice terminal, spot-the-bug, quick checks, flashcards.*
- **C++: a timer and a publisher drive the turtle** (30 min). Write the circle driver in C++: create_publisher, create_wall_timer with chrono literals, std::bind, member variables and publish. Build it and watch your compiled node drive turtlesim. *Practice: step-through code, Python and C++ side by side, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*

### Day 22: Listening, and your own messages

- **Python: a subscriber that listens to the robot** (30 min). Subscribe to turtlesim's pose, keep the newest message in the node, add up the distance travelled, and report it once per second from a timer. *Practice: step-through code, Python playground, practice terminal, spot-the-bug, ordering puzzle, quick checks, flashcards.*
- **C++: a subscriber that listens to the robot** (30 min). Write the pose monitor in C++: create_subscription with std::bind and a placeholder, a callback that takes a const reference, std::optional for "no message yet", and printf-style logging. *Practice: step-through code, Python and C++ side by side, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **Your own message, used from Python** (30 min). Design RobotStatus.msg, build it in an interfaces package (rosidl), check it with ros2 interface show, and publish it from a Python node that reads live data. *Practice: animation, code tabs, Python playground, practice terminal, sorting puzzle, quick checks, flashcards.*
- **C++: publishing your own message** (30 min). Use RobotStatus from C++: the snake_case header, the namespace, the three build-file lines, float vs double, and a lambda as a short callback. Run it and read it in the terminal. *Practice: Python and C++ side by side, step-through code, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*

### Day 23: Services: ask the robot, get an answer

- **Python: a service server that switches the robot on and off** (30 min). Write a service server with create_service: read the request, fill the response, return it. Use it to switch a driving timer on and off, and call it from the terminal. *Practice: step-through code, Python playground, practice terminal, spot-the-bug, sorting puzzle, quick checks, flashcards.*
- **C++: a service server that switches the robot on and off** (30 min). Write the switchable driver in C++: create_service<T>, a callback that receives shared pointers to the request and the response and fills the response in place, two placeholders, and the ? : operator. *Practice: step-through code, Python and C++ side by side, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **Python: a service client that asks turtlesim for help** (30 min). Write client programs: wait for a service, send a request with call_async, wait for the future in main(), read the answer. Spawn a turtle, then let an artist node draw a triangle with three services. *Practice: step-through code, animation, Python playground, practice terminal, spot-the-bug, ordering puzzle, quick checks, flashcards.*
- **C++: a service client that asks turtlesim for help** (30 min). Write the spawn client in C++: rclcpp::Node::make_shared without a class, create_client<T>, wait_for_service(1s), a request in a shared pointer, async_send_request, spin_until_future_complete and FutureReturnCode. *Practice: step-through code, Python and C++ side by side, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*

### Day 24: Actions and parameters

- **Python: an action that drives a distance, with progress** (30 min). Write DriveDistance as an action: a server that accepts or rejects goals, publishes feedback while it drives and returns a result, and a client that sends a goal, prints progress and can cancel. *Practice: code tabs, step-through code, Python playground, practice terminal, spot-the-bug, ordering puzzle, flashcards.*
- **C++: an action that drives a distance, with progress** (30 min). Write the DriveDistance server in C++ with rclcpp_action: handle_goal, handle_cancel, handle_accepted, an execute() that runs in its own thread, rclcpp::Rate, feedback and result in shared pointers. *Practice: step-through code, code tabs, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*
- **Python: parameters, change the robot without changing the code** (30 min). Declare parameters with default values, read them in the node, change them live with ros2 param set, start a node with -p values or a YAML file, and save the current values with ros2 param dump. *Practice: animation, code tabs, Python playground, practice terminal, spot-the-bug, quick checks, flashcards.*
- **C++: parameters, change the robot without changing the code** (30 min). Declare and read parameters in rclcpp: declare_parameter with a default, get_parameter(...).as_double() and as_string(), live changes, YAML files, and the extra qos_overrides parameters every C++ node has. *Practice: step-through code, Python and C++ side by side, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*

### Day 25: Launch files and your first robot project

- **Python: a launch file starts the whole robot** (30 min). Write a Python launch file that starts turtlesim, speed_driver with parameters and pose_monitor; read the same file in XML; install it with data_files in setup.py; and start everything with one command. *Practice: animation, code tabs, Python playground, practice terminal, spot-the-bug, matching puzzle, flashcards.*
- **C++: launch files for a C++ package** (30 min). Start C++ nodes from an XML launch file, install the launch and config folders with one CMake line, and know that launch files are never compiled: the same launch languages work for every package. *Practice: Python and C++ side by side, practice terminal, spot-the-bug, sorting puzzle, ordering puzzle, think-first, quick checks, flashcards.*
- **Python mini-project: Chiku's battery monitor** (30 min). Put the week together: a node with a subscriber, a publisher of your own message, a service, two parameters and a timer, configured from YAML and started from a launch file. Then operate it like a robot engineer. *Practice: code tabs, Python playground, practice terminal, checklist, think-first, flashcards.*
- **C++ mini-project: Chiku's battery monitor** (30 min). Build the battery monitor in C++: a subscriber, a publisher of your own message, a Trigger service, two parameters and a timer in one rclcpp node, started from a launch file with YAML. Then compare it with the Python version. *Practice: Python and C++ side by side, practice terminal, spot-the-bug, matching puzzle, checklist, flashcards.*

**Week 5 test: ROS programming fundamentals:** 16 questions, 40 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 188 question templates.

## Week 6: Writing your own ROS 2 nodes

Build on Week 5 and write nodes that really control a robot, each one in Python AND in C++: time and logging, open- and closed-loop driving, chaining nodes, messages in code, QoS, safe parameters, launch files for several robots, tf2 frames, executors, lifecycle nodes and components, tests, and a patrol-robot project. Every lesson has a live Ubuntu terminal.


### Day 26: Time, logs and driving patterns

- **Time in your nodes: rates, clocks and stopping timers** (30 min). Choose a good rate for each job, measure time with the node's clock (Time and Duration), stop a timer after N ticks, and see what use_sim_time changes. Python and C++. *Practice: Python and C++ side by side, step-through code, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Logging like a pro: levels, throttle and once** (30 min). Use the five log levels, show only what matters with --log-level, avoid flooding the screen with throttle and once, and log the same way in Python and C++. *Practice: Python and C++ side by side, Python playground, practice terminal, sorting puzzle, matching puzzle, quick checks, flashcards.*
- **Driving patterns: a square with a state machine (open loop)** (30 min). Make a node do a sequence of moves: drive a side, turn a corner, four times. Build it as a small state machine in Python and C++, and see why open-loop driving is never exact. *Practice: Python and C++ side by side, step-through code, Python playground, practice terminal, spot-the-bug, ordering puzzle, quick checks, flashcards.*

### Day 27: Closing the loop

- **Closed-loop control: go to a goal by yourself (part 1)** (30 min). Combine a pose subscriber, a timer and a Twist publisher into a P-controller that drives the robot to any goal, with gains as parameters. Python and C++. *Practice: animation, Python and C++ side by side, step-through code, Python playground.*
- **Closed-loop control: go to a goal by yourself (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, sorting puzzle, spot-the-bug, quick checks, flashcards.*
- **A safety filter node: chaining nodes with remapping** (30 min). Write a node that sits between a driver and the robot, limits speed and blocks driving into walls, and connect it with topic remapping instead of changing code. *Practice: Python and C++ side by side, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Building messages in code: nested fields, arrays and stamps** (30 min). Fill nested message fields, lists (arrays) and header time stamps in Python and C++, using sensor_msgs/JointState and geometry_msgs/PoseStamped as examples. *Practice: Python and C++ side by side, sorting puzzle, Python playground, practice terminal, spot-the-bug, matching puzzle, quick checks, flashcards.*

### Day 28: QoS, safe parameters and launch for two robots

- **QoS in code: reliable, best effort and latched topics** (30 min). Choose QoS profiles in Python and C++: sensor data (best effort), commands (reliable) and latched status (transient local), and see a late subscriber still get the message. *Practice: animation, Python and C++ side by side, Python playground, practice terminal, sorting puzzle, quick checks, flashcards.*
- **Parameters in depth: descriptors, ranges, read-only and callbacks (part 1)** (30 min). Week 5 taught declare, get, set and YAML. Now make parameters safe: describe them with ParameterDescriptor (description, read-only, ranges), validate changes in an on-set callback and react to them at once. Python and C++. *Practice: animation, Python and C++ side by side, step-through code, Python playground.*
- **Parameters in depth: descriptors, ranges, read-only and callbacks (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, spot-the-bug, sorting puzzle, quick checks, flashcards.*
- **Launch in depth: arguments, YAML, namespaces and two robots** (30 min). Write the same launch file in Python, XML and YAML, pass arguments, load a parameter file, start two robots in two namespaces, use a condition, and run it all in the terminal. *Practice: animation, Python and C++ side by side, code tabs, practice terminal, matching puzzle, quick checks, flashcards.*

### Day 29: Frames and executors

- **Publishing frames: a tf2 broadcaster** (30 min). Turn the robot's pose into a moving coordinate frame (world -> turtle1) with tf2's TransformBroadcaster, including the yaw-to-quaternion step, in Python and C++. *Practice: animation, Python and C++ side by side, step-through code, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Using frames: a tf2 listener that follows another robot** (30 min). Ask tf2 where one robot is seen from another (lookup_transform), handle the case where a frame is not there yet, and turn the answer into a chase controller. Launch it all together. *Practice: Python and C++ side by side, step-through code, code tabs, Python playground, practice terminal, spot-the-bug, quick checks, flashcards.*
- **Executors and callback groups: waiting without freezing** (30 min). Understand what the executor does, why a blocking call inside a callback deadlocks, and how callback groups plus a MultiThreadedExecutor make it safe. Python and C++. *Practice: animation, Python and C++ side by side, step-through code, Python playground, practice terminal, sorting puzzle, quick checks, flashcards.*

### Day 30: Robust robots and the patrol project

- **Lifecycle nodes and components: starting robots safely and efficiently (part 1)** (30 min). Write a managed (lifecycle) node that only drives after configure and activate, control it from the terminal, then build a C++ component and load it into a container. *Practice: Python and C++ side by side, practice terminal, code tabs.*
- **Lifecycle nodes and components: starting robots safely and efficiently (part 2)** (30 min). Part 2: more practice, quick checks and the recap. *Practice: practice terminal, Python playground, matching puzzle, quick checks, flashcards.*
- **Testing your nodes: pytest and gtest** (30 min). Move the controller maths into pure functions, test them with pytest (Python) and gtest (C++), run colcon test and read the results. *Practice: code tabs, Python playground, practice terminal, matching puzzle, quick checks, flashcards.*
- **Mini-project: Chiku's patrol robot (part 1)** (30 min). Put the week together: a patrol node with waypoint parameters, a pause service, a custom status topic, tested maths, a YAML config and a launch file, in Python and C++. *Practice: checklist, Python and C++ side by side, code tabs, step-through code, Python playground.*
- **Mini-project: Chiku's patrol robot (part 2)** (30 min). Part 2: Make it yours: extension ideas. *Practice: practice terminal, ordering puzzle, quick checks, flashcards.*

**Week 6 test: writing your own ROS 2 nodes:** 16 questions, 40 minutes, 2 attempts (best score counts). Every student gets a different paper, built on the server from 188 question templates.
