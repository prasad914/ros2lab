# ROS 2 from zero, in five weeks: course outline

A free online course on www.ros2lab.com for engineering students, designed for beginners. Lessons take about 30 minutes each (a few hands-on lessons take 35 to 45). Every lesson: a short story about Chiku the delivery robot, a plain-words summary, goals, slow step-by-step worked examples, common mistakes, interactive animations, practice in the browser (simulated Ubuntu terminal with a live ROS 2 graph, or a Python playground with a practice rclpy), quick checks and a recap.

## Week 1: Talk to the robot's computer

The Ubuntu terminal and Python from zero: move around, manage files, install software, and write your first programs.

### Day 1: Meet the terminal

- **Start here: how this course works** (30 min). Your 25-day route, the robot you will program, and how to use the animations, puzzles and practice tools. *Practice: animation, think-first, step-through code, matching puzzle, flashcards, checklist, Python playground, sorting puzzle, quick checks.*
- **Meet the terminal** (30 min). What the terminal is, how to read the prompt, and your first commands. *Practice: practice terminal, quick checks, flashcards.*
- **Folders and paths: moving around** (30 min). Move between folders with cd, and learn absolute and relative paths. *Practice: animation, practice terminal, game, sorting puzzle, quick checks, flashcards.*

### Day 2: Files, permissions and installing

- **Making, copying and deleting** (30 min). Create folders and files, then copy, move, rename and delete them safely. *Practice: practice terminal, matching puzzle, quick checks, flashcards.*
- **Reading and editing files** (30 min). Look inside files with cat, head and tail, and edit them with nano. *Practice: practice terminal, think-first, quick checks, flashcards.*
- **Permissions and sudo** (30 min). Read rwx permissions, make a program runnable with chmod +x, and use sudo safely. *Practice: animation, practice terminal, quick checks, flashcards.*
- **Installing software with apt** (30 min). Refresh the software list, search for packages, and install ROS 2 tools. *Practice: practice terminal, quick checks, matching puzzle, flashcards.*

### Day 3: Python from zero

- **Python 1: the robot's notebook** (30 min). Print messages, store values in variables, tell numbers from text, and ask questions with input(). *Practice: Python playground, step-through code, quick checks, flashcards.*

### Day 4: Decisions and loops

- **Python 2: should the robot stop?** (30 min). Make decisions with if, elif and else, and repeat actions with for, while and break. *Practice: Python playground, step-through code, quick checks, spot-the-bug, flashcards.*

### Day 5: Lists, dictionaries and functions

- **Python 3: memory and skills** (30 min). Keep many values in lists and dictionaries, and write your own functions. *Practice: Python playground, step-through code, matching puzzle, quick checks, flashcards.*

**Week 1 test: terminal and Python basics:** 15 questions, 35 minutes, 2 attempts. Every student gets a different paper.

## Week 2: Build the robot's brain

Python objects, C++ from the basics, your first ROS 2 nodes, then installing ROS 2 Jazzy and setting up the robotics lab.

### Day 6: Python classes and objects

- **Classes and objects** (30 min). A class is a blueprint; an object is a robot built from it. *Practice: Python playground, animation, quick checks, flashcards.*
- **Attributes and __init__** (30 min). Give every new object its starting values automatically, with __init__ and self. *Practice: Python playground, step-through code, quick checks, flashcards.*
- **Methods: what an object can do** (30 min). Write methods that use and change an object's attributes. *Practice: Python playground, step-through code, quick checks, spot-the-bug, flashcards.*
- **Objects inside objects** (30 min). Build bigger objects from smaller ones, the way a ROS 2 node owns publishers and timers. *Practice: Python playground, quick checks, think-first, flashcards.*

### Day 7: Inheritance, callbacks and your first node

- **Inheritance and super()** (30 min). Build a new class on top of an existing one, which is exactly how every ROS 2 node is written. *Practice: Python playground, matching puzzle, quick checks, flashcards.*
- **Callbacks and timers** (30 min). Hand a function over to be called later: the heartbeat of every ROS 2 program. *Practice: Python playground, animation, think-first, quick checks, flashcards.*
- **Reading a real ROS 2 node** (30 min). Read a real ROS 2 publisher line by line, then add a listener. *Practice: Python playground, game, spot-the-bug, animation, quick checks, flashcards.*

### Day 8: C++ basics

- **Hello, C++: compile and run** (30 min). Write, compile and run your first C++ program, and fix the most common error. *Practice: practice terminal, Python and C++ side by side, spot-the-bug, quick checks, flashcards.*
- **C++ decisions, loops, functions and vectors** (30 min). The Python skills you know, in C++: if, for, functions with types, and std::vector. *Practice: Python and C++ side by side, practice terminal, step-through code, quick checks, flashcards.*

### Day 9: C++ classes and ROS 2 C++ nodes

- **C++ classes: same blueprint, stricter rules** (30 min). Write a C++ class with a constructor, member functions, public and private, and inheritance. *Practice: Python and C++ side by side, matching puzzle, quick checks, flashcards.*
- **Reading a real ROS 2 C++ node** (30 min). Find the class, constructor, publisher, timer and callback inside the official C++ publisher. *Practice: Python and C++ side by side, quick checks, matching puzzle, game, flashcards.*

### Day 10: Install ROS 2 and set up the lab

- **Get Ubuntu 24.04 ready** (30 min). Choose WSL2, dual boot, a virtual machine or the college lab, and check your computer. *Practice: checklist, practice terminal, think-first, quick checks, flashcards.*
- **Install ROS 2 Jazzy** (45 min). Rehearse the official installation in the practice terminal, then install on your own Ubuntu. *Practice: practice terminal, think-first, quick checks, game, flashcards.*
- **Environment variables, source and ~/.bashrc** (30 min). Why a new terminal forgets ROS 2, and how source and ~/.bashrc fix it. *Practice: practice terminal, game, think-first, quick checks, flashcards.*
- **Set up the ROS 2 robotics lab** (45 min). Install Gazebo, ros2_control, Nav2, SLAM, TurtleBot3 and MoveIt, prepare rosdep and a workspace, and check everything. *Practice: practice terminal, checklist, quick checks, flashcards.*

**Week 2 test: objects, C++ and ROS 2 setup:** 15 questions, 35 minutes, 2 attempts. Every student gets a different paper.

## Week 3: Introduction to ROS

Why robots need a software platform, the goals, parts and ecosystem of ROS, its history and versions, ROS 1 vs ROS 2, middleware, DDS and Quality of Service.

### Day 11: Why robots need ROS

- **Why robots need a software platform** (30 min). The problems every robot team faces, and how a software platform like ROS solves them. *Practice: animation, practice terminal, matching puzzle, think-first, sorting puzzle, quick checks, flashcards.*
- **What ROS was built to do** (30 min). The five original objectives of ROS, and the new goals that led to ROS 2. *Practice: practice terminal, sorting puzzle, matching puzzle, think-first, quick checks, flashcards.*

### Day 12: Inside ROS and its ecosystem

- **The parts of ROS** (30 min). Communication (nodes, topics, services, actions, parameters), tools and ready-made capabilities. *Practice: animation, sorting puzzle, practice terminal, matching puzzle, quick checks, flashcards.*
- **The ROS ecosystem** (30 min). Packages, distributions, ROS Index, rosdep, REPs, the community and the big projects around ROS. *Practice: practice terminal, quick checks, flashcards.*

### Day 13: History and versions

- **The ROS story: 2007 to 2026** (30 min). From a Stanford project and Willow Garage to ROS 2, OSRA, the end of ROS 1 and Lyrical. *Practice: animation, matching puzzle, quick checks, think-first, flashcards.*
- **ROS versions: which one and why** (30 min). Distribution names, the LTS rule, matching Ubuntu versions, and why this course uses Jazzy. *Practice: animation, practice terminal, sorting puzzle, quick checks, flashcards.*

### Day 14: ROS 1 vs ROS 2 and middleware

- **ROS 1 vs ROS 2** (30 min). No master, DDS, colcon, Python 3, QoS, security, real-time and more: what changed and why. *Practice: animation, matching puzzle, think-first, spot-the-bug, sorting puzzle, quick checks, flashcards.*
- **Middleware: the robot's postal service** (30 min). What middleware is, publish/subscribe vs request/response, and the rclpy → rcl → rmw → DDS layers. *Practice: animation, quick checks, practice terminal, think-first, flashcards.*
- **Why use ROS 2** (30 min). Support until 2029, security, real-time, embedded chips, a huge ecosystem and industry backing. *Practice: practice terminal, flashcards, sorting puzzle, quick checks.*

### Day 15: DDS and Quality of Service

- **DDS: how nodes find each other** (30 min). The DDS standard, automatic discovery (SPDP and SEDP), domains and ROS_DOMAIN_ID. *Practice: animation, think-first, practice terminal, quick checks, flashcards.*
- **Quality of Service (QoS)** (35 min). Reliability, durability, history and depth; ROS 2 QoS profiles; and the compatibility rule. *Practice: animation, sorting puzzle, Python playground, practice terminal, quick checks, flashcards.*

**Week 3 test: Introduction to ROS:** 15 questions, 35 minutes, 2 attempts. Every student gets a different paper.

## Week 4: Speak ROS 2

The core ideas of ROS 2, hands-on in a practice terminal: nodes, topics, messages, services, parameters, actions, launch files, packages, TF2 and debugging tools. Ends with a mini-project.

### Day 16: The ROS 2 graph

- **What ROS 2 really is** (30 min). The big picture: why robots are built from many small programs, and where ROS 2 sits. *Practice: animation, think-first, practice terminal, sorting puzzle, quick checks, flashcards.*
- **Nodes: the robot's team members** (30 min). Start nodes with ros2 run, list them, inspect them with ros2 node info, and rename one. *Practice: practice terminal, matching puzzle, quick checks, flashcards.*

### Day 17: Topics and messages

- **Topics: publish and subscribe** (30 min). How nodes stream data on topics, and how to spy on them with ros2 topic. *Practice: animation, practice terminal, spot-the-bug, think-first, quick checks, game, flashcards.*
- **Messages: what travels on a topic** (30 min). Read message types with ros2 interface show, then drive the turtle with ros2 topic pub. *Practice: animation, practice terminal, matching puzzle, quick checks, flashcards.*
- **Write a publisher and a subscriber** (35 min). Write Python nodes that publish speed commands and react to incoming messages. *Practice: step-through code, Python playground, spot-the-bug, quick checks.*

### Day 18: Services and parameters

- **Services: ask a question, get an answer** (30 min). Call services from the terminal, then write a service server and client in Python. *Practice: animation, practice terminal, Python playground, sorting puzzle, quick checks, flashcards.*
- **Parameters: settings you can change** (30 min). Read and change node settings with ros2 param, and declare parameters in Python. *Practice: animation, practice terminal, Python playground, quick checks, flashcards.*

### Day 19: Actions and launch files

- **Actions: long jobs with feedback** (30 min). Send goals, watch feedback and get results with ros2 action, and choose between topics, services and actions. *Practice: animation, practice terminal, sorting puzzle, quick checks, game, flashcards.*
- **Launch files: start everything at once** (30 min). Start many nodes, with their settings, from one command with ros2 launch. *Practice: animation, practice terminal, matching puzzle, think-first, quick checks, flashcards.*

### Day 20: Packages, frames and tools

- **Packages and workspaces: build, source, run** (35 min). Create your own package with ros2 pkg create, build it with colcon, source it and run it. *Practice: animation, practice terminal, quick checks, flashcards.*
- **Coordinate frames and TF2** (30 min). Why every robot part has its own coordinate frame, and how TF2 converts between them. *Practice: animation, think-first, quick checks, matching puzzle, flashcards.*
- **Your debugging toolbox** (30 min). Record and replay data with ros2 bag, see the graph with rqt_graph, and pick the right tool for each problem. *Practice: practice terminal, matching puzzle, checklist, quick checks.*
- **Mini-project: design Chiku's ROS 2 graph** (35 min). Put the whole week together: design the graph of a delivery robot, then build one node that uses a parameter, two publishers and a service. *Practice: sorting puzzle, think-first, Python playground, spot-the-bug, flashcards.*

**Week 4 test: ROS 2 core concepts:** 15 questions, 35 minutes, 2 attempts. Every student gets a different paper.

## Week 5: ROS Programming Fundamentals

Write real ROS 2 programs in Python and C++: packages and nodes, topics, custom interfaces, services, actions, parameters with YAML files and callbacks, and launch files.

### Day 21: Packages, nodes and topics in code

- **Packages and nodes, the right way** (35 min). Create Python and C++ packages, write a node as a class, register it, build and run it. *Practice: animation, practice terminal, Python and C++ side by side, spot-the-bug, quick checks, flashcards.*
- **Publishers and subscribers in Python and C++** (35 min). Write a topic publisher and subscriber in both languages, choose the queue/QoS, and test them from the terminal. *Practice: Python and C++ side by side, Python playground, spot-the-bug, practice terminal, quick checks, flashcards.*

### Day 22: Custom interfaces and services

- **Custom interfaces: your own messages** (35 min). Create an interfaces package with a .msg file, generate code with rosidl, and use the message from Python and C++. *Practice: animation, practice terminal, spot-the-bug, Python and C++ side by side, Python playground, quick checks, flashcards.*
- **Services: write a server and a client** (35 min). Write service servers and clients in Python and C++, use call_async safely, and create a custom service. *Practice: animation, Python and C++ side by side, Python playground, practice terminal, quick checks, flashcards.*

### Day 23: Actions

- **Actions: write an action server and client** (40 min). Define a custom action, write a server that sends feedback, write a client, and see the 3 services + 2 topics underneath. *Practice: animation, Python playground, practice terminal, quick checks, flashcards.*

### Day 24: Parameters

- **Parameters: declare, YAML files and callbacks** (40 min). Declare and read parameters in Python and C++, store them in YAML files, and validate changes with callbacks. *Practice: animation, Python and C++ side by side, Python playground, practice terminal, quick checks, flashcards.*

### Day 25: Launch files and mini-project

- **Launch files: XML and Python** (40 min). Write XML and Python launch files, install them, and configure nodes: names, namespaces, remaps, parameters and arguments. *Practice: animation, Python and C++ side by side, practice terminal, sorting puzzle, quick checks, flashcards.*
- **Mini-project: Chiku's battery monitor** (45 min). Combine a custom message, a publisher, a subscriber and a parameter into a small working system. *Practice: Python playground, think-first, checklist, flashcards.*

**Week 5 test: ROS programming fundamentals:** 15 questions, 40 minutes, 2 attempts. Every student gets a different paper.
