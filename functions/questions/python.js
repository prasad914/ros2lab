// Module B: Python OOP for ROS 2 question templates.
const { pick, pickN, int, CLASSES, ROBOT_NAMES, METHODS, NODE_NAMES, TOPICS } = require("./util");

const quoteVariants = (s) => [s, `"${s}"`, `'${s}'`];
const T = [];

// ======================= topic: pybasics =======================
T.push({
  id: "B-BASIC-ADD", topic: "py1", type: "predict",
  make(r) {
    const v = pick(r, ["speed", "count", "steps", "distance", "score"]);
    const a = int(r, 2, 20), b = int(r, 1, 9);
    return {
      prompt: "What does this program print?",
      code: `${v} = ${a}\n${v} = ${v} + ${b}\nprint(${v})`,
      correct: String(a + b),
      explain: `The second line takes the old value (${a}), adds ${b}, and stores the result back in ${v}.`,
    };
  },
});

T.push({
  id: "B-BASIC-IF", topic: "py2", type: "predict",
  make(r) {
    const limit = pick(r, [20, 30, 50]);
    const level = pick(r, [5, 10, 15, 25, 35, 45, 60, 75, 90]);
    const low = pick(r, ["Charge me", "Battery low", "Go home"]);
    const ok = pick(r, ["Ready to go", "All good", "Start mission"]);
    const out = level < limit ? low : ok;
    return {
      prompt: "What does this program print?",
      code: `battery = ${level}\nif battery < ${limit}:\n    print("${low}")\nelse:\n    print("${ok}")`,
      correct: out, accept: quoteVariants(out),
      explain: `${level} < ${limit} is ${level < limit ? "True" : "False"}, so Python runs the ${level < limit ? "if" : "else"} part.`,
    };
  },
});

T.push({
  id: "B-BASIC-FUNC", topic: "py3", type: "predict",
  make(r) {
    if (r() < 0.5) {
      const name = pick(r, ROBOT_NAMES), word = pick(r, ["Hello", "Hi", "Welcome"]);
      const out = `${word} ${name}`;
      return {
        prompt: "What does this program print?",
        code: `def greet(name):\n    return "${word} " + name\n\nprint(greet("${name}"))`,
        correct: out, accept: quoteVariants(out),
        explain: `greet joins "${word} " and the name you pass in, then returns it. print shows ${out}.`,
      };
    }
    const n = int(r, 2, 12);
    return {
      prompt: "What does this program print?",
      code: `def double(n):\n    return n * 2\n\nprint(double(${n}))`,
      correct: String(n * 2),
      explain: `double(${n}) returns ${n} * 2 = ${n * 2}.`,
    };
  },
});

T.push({
  id: "B-BASIC-LIST", topic: "py3", type: "predict",
  make(r) {
    const names = pickN(r, ROBOT_NAMES, 4), i = int(r, 0, 3);
    return {
      prompt: "What does this program print? (Remember how Python counts list positions.)",
      code: `robots = [${names.map((n) => `"${n}"`).join(", ")}]\nprint(robots[${i}])`,
      correct: names[i], accept: quoteVariants(names[i]),
      explain: `Python counts list positions from 0. Position ${i} is the ${["first", "second", "third", "fourth"][i]} item: ${names[i]}.`,
    };
  },
});

T.push({
  id: "B-BASIC-INDENT", topic: "py2", type: "mcq",
  make(r) {
    const name = pick(r, ROBOT_NAMES);
    return {
      prompt: "What happens when you run this code?",
      code: `def say_hello():\nprint("Hello from ${name}")`,
      options: ["IndentationError: the line inside the function must be pushed right (indented)", "It prints Hello from " + name, "NameError: print is not defined", "It runs but prints nothing"],
      correct: "IndentationError: the line inside the function must be pushed right (indented)",
      explain: "Lines that belong to a def, if, or class must be indented (4 spaces). Python uses indentation to know what is inside.",
    };
  },
});

// ======================= topic: class (classes and objects) =======================
T.push({
  id: "B-CLASS-WHAT", topic: "oop1", type: "mcq",
  make(r) {
    const C = pick(r, CLASSES), obj = pick(r, ["r1", "my_bot", "unit", "bot_a"]);
    const askClass = r() < 0.5;
    const A = "The class: the blueprint", B = "The object: one robot built from the blueprint";
    return {
      prompt: `In the line \`${obj} = ${C}()\`, what is **${askClass ? C : obj}**?`,
      options: [A, B, "A number stored in memory", "A ROS 2 topic"],
      correct: askClass ? A : B,
      explain: `${C} is the class (the design). Calling ${C}() builds a new object, and ${obj} is the name we give to that object.`,
    };
  },
});

T.push({
  id: "B-CLASS-SEPARATE", topic: "oop1", type: "predict",
  make(r) {
    const C = pick(r, CLASSES), [x, y, z] = pickN(r, [2, 3, 4, 5, 6, 7, 8, 9], 3);
    return {
      prompt: "What does this program print?",
      code: `class ${C}:\n    def __init__(self, speed):\n        self.speed = speed\n\na = ${C}(${x})\nb = ${C}(${y})\na.speed = ${z}\nprint(b.speed)`,
      correct: String(y),
      explain: `a and b are two separate objects. Changing a.speed does not touch b, so b.speed is still ${y}.`,
    };
  },
});

T.push({
  id: "B-CLASS-NAME", topic: "oop1", type: "predict",
  make(r) {
    const C = pick(r, CLASSES), [n1, n2] = pickN(r, ROBOT_NAMES, 2), first = r() < 0.5;
    const out = first ? n1 : n2;
    return {
      prompt: "What does this program print?",
      code: `class ${C}:\n    def __init__(self, name):\n        self.name = name\n\nd1 = ${C}("${n1}")\nd2 = ${C}("${n2}")\nprint(${first ? "d1" : "d2"}.name)`,
      correct: out, accept: quoteVariants(out),
      explain: `Each object stores its own name. ${first ? "d1" : "d2"} was created with "${out}".`,
    };
  },
});

T.push({
  id: "B-CLASS-INITBUG", topic: "oop1", type: "mcq",
  make(r) {
    const C = pick(r, CLASSES), n = pick(r, ROBOT_NAMES);
    return {
      prompt: `This code crashes with a TypeError when it creates \`${C}("${n}")\`. What is wrong?`,
      code: `class ${C}:\n    def __init__(name):\n        self.name = name\n\nbot = ${C}("${n}")`,
      options: ["__init__ is missing self as its first parameter", "Class names must be lowercase", "__init__ must return a value", "Objects cannot have a name attribute"],
      correct: "__init__ is missing self as its first parameter",
      explain: "Every method, including __init__, must have self first: def __init__(self, name). Python passes the object in automatically.",
    };
  },
});

// ======================= topic: method (methods and self) =======================
T.push({
  id: "B-METH-COUNT", topic: "oop1", type: "predict",
  make(r) {
    const C = pick(r, ["Counter", "Odometer", "StepCounter", "Clicker"]), s = int(r, 0, 10), k = int(r, 2, 4);
    return {
      prompt: "What does this program print?",
      code: `class ${C}:\n    def __init__(self, start):\n        self.count = start\n\n    def add(self):\n        self.count = self.count + 1\n\nc = ${C}(${s})\n${Array(k).fill("c.add()").join("\n")}\nprint(c.count)`,
      correct: String(s + k),
      explain: `count starts at ${s}. add() runs ${k} times and adds 1 each time: ${s} + ${k} = ${s + k}.`,
    };
  },
});

T.push({
  id: "B-METH-SELF", topic: "oop1", type: "mcq",
  make(r) {
    const C = pick(r, CLASSES), m = pick(r, METHODS);
    return {
      prompt: `Inside the method \`def ${m}(self):\` of class \`${C}\`, what does **self** mean?`,
      options: [`The particular ${C} object that the method was called on`, `The class ${C} itself`, "The Python program", "The parent class"],
      correct: `The particular ${C} object that the method was called on`,
      explain: `When you write bot.${m}(), Python passes bot in as self. So self.x means "this object's x".`,
    };
  },
});

T.push({
  id: "B-METH-CALL", topic: "oop1", type: "fill",
  make(r) {
    const C = pick(r, CLASSES), m = pick(r, METHODS), obj = pick(r, ["r", "bot", "unit", "my_robot"]);
    return {
      prompt: `\`${obj}\` is an object of class \`${C}\`, which has a method \`def ${m}(self):\`. Type the line that **calls** this method on ${obj}.`,
      correct: `${obj}.${m}()`, accept: [`${obj}.${m}()`],
      explain: `object.method() calls a method. You do not pass self yourself; Python does it.`,
    };
  },
});

T.push({
  id: "B-METH-ATTRERR", topic: "oop1", type: "mcq",
  make(r) {
    const C = pick(r, CLASSES), attr = pick(r, ["count", "speed", "battery", "steps"]);
    return {
      prompt: "Which error does this code produce?",
      code: `class ${C}:\n    def __init__(self):\n        pass\n\n    def tick(self):\n        self.${attr} = self.${attr} + 1\n\nb = ${C}()\nb.tick()`,
      options: [`AttributeError: the object has no attribute '${attr}'`, "IndentationError", "No error; it prints 1", "SyntaxError: pass is not allowed"],
      correct: `AttributeError: the object has no attribute '${attr}'`,
      explain: `tick() reads self.${attr}, but __init__ never created it. Fix: put self.${attr} = 0 inside __init__.`,
    };
  },
});

// ======================= topic: inherit (inheritance and super) =======================
T.push({
  id: "B-INH-PREDICT", topic: "oop2", type: "predict",
  make(r) {
    const P = "Vehicle", C = pick(r, ["Car", "Rover", "Truck", "Tractor"]);
    const ps = pick(r, ["vroom", "beep", "brrr"]), cs = pick(r, ["honk", "zoom", "toot"]);
    const override = r() < 0.5, out = override ? cs : ps;
    const childBody = override ? `    def sound(self):\n        return "${cs}"` : "    pass";
    return {
      prompt: "What does this program print?",
      code: `class ${P}:\n    def sound(self):\n        return "${ps}"\n\nclass ${C}(${P}):\n${childBody}\n\nprint(${C}().sound())`,
      correct: out, accept: quoteVariants(out),
      explain: override
        ? `${C} has its own sound() method, which replaces (overrides) the parent's one.`
        : `${C} has no sound() of its own, so it uses the one inherited from ${P}.`,
    };
  },
});

T.push({
  id: "B-INH-SUPER", topic: "oop2", type: "fill",
  make(r) {
    const C = pick(r, ["WallAvoider", "LineFollower", "BatteryMonitor", "Patrol", "CameraReader", "Greeter"]);
    const name = C.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    return {
      prompt: `Complete the missing line so this ROS 2 node is set up with the node name \`${name}\`.`,
      code: `class ${C}(Node):\n    def __init__(self):\n        ______________________`,
      correct: `super().__init__('${name}')`,
      accept: [`super().__init__('${name}')`, `super().__init__("${name}")`],
      explain: "super().__init__(...) runs the parent class's setup (Node's __init__) and gives the node its name.",
    };
  },
});

T.push({
  id: "B-INH-PARENT", topic: "oop2", type: "mcq",
  make(r) {
    const C = pick(r, ["MinimalPublisher", "WallAvoider", "SpeedControl", "Greeter"]);
    return {
      prompt: `In \`class ${C}(Node):\`, which is the **parent** class?`,
      options: ["Node", C, "self", "rclpy"],
      correct: "Node",
      explain: `The class in brackets is the parent. ${C} inherits everything Node can do, like create_publisher and create_timer.`,
    };
  },
});

T.push({
  id: "B-INH-FORGOT", topic: "oop2", type: "mcq",
  make(r) {
    const C = pick(r, ["WallAvoider", "Greeter", "Patrol", "SpeedControl"]);
    return {
      prompt: `A student wrote a ROS 2 node \`${C}(Node)\` but **forgot** \`super().__init__(...)\` in \`__init__\`. What happens?`,
      options: [
        "The Node part is never set up, so calls like create_publisher() fail",
        "Nothing changes; Python adds it automatically",
        "The node runs twice",
        "The topic name becomes empty but everything else works",
      ],
      correct: "The Node part is never set up, so calls like create_publisher() fail",
      explain: "Without super().__init__, the parent's setup never runs. ROS 2 needs it to give the node a name and prepare its tools.",
    };
  },
});

// ======================= topic: callback =======================
T.push({
  id: "B-CB-TIMER", topic: "oop2", type: "mcq",
  make(r) {
    const cb = pick(r, ["blink", "send_status", "timer_callback", "check_battery", "patrol_step"]);
    const p = pick(r, ["0.5", "1.0", "2.0"]);
    return {
      prompt: `Inside a node's \`__init__\`, which line makes ROS 2 call the method \`self.${cb}\` every **${p} seconds**?`,
      options: [`self.create_timer(${p}, self.${cb})`, `self.create_timer(${p}, self.${cb}())`, `self.create_timer(self.${cb}, ${p})`, `self.${cb}(${p})`],
      correct: `self.create_timer(${p}, self.${cb})`,
      explain: `First the period, then the function itself without (). With (), Python would call it once immediately instead of giving it to the timer.`,
    };
  },
});

T.push({
  id: "B-CB-COUNT", topic: "oop2", type: "predict",
  make(r) {
    const [period, secs] = pick(r, [["1.0", 3], ["0.5", 2], ["2.0", 6], ["1.0", 5], ["0.5", 3], ["2.0", 4]]);
    const times = Math.round(secs / Number(period));
    return {
      prompt: `A timer is created with \`self.create_timer(${period}, self.tick)\`. The node runs for exactly **${secs} seconds**. How many times is \`tick\` called? (Type a number.)`,
      correct: String(times),
      explain: `It is called once every ${period} s. In ${secs} s that is ${secs} ÷ ${period} = ${times} times.`,
    };
  },
});

T.push({
  id: "B-CB-PASS", topic: "oop2", type: "mcq",
  make(r) {
    const f = pick(r, ["beep", "wave", "flash", "honk"]);
    return {
      prompt: `\`button.on_press(...)\` needs to know **which function** to run later, when the button is pressed. Which line is correct?`,
      options: [`button.on_press(${f})`, `button.on_press(${f}())`, `button.on_press("${f}()")`, `button.on_press = ${f}()`],
      correct: `button.on_press(${f})`,
      explain: `Writing ${f} (no brackets) hands over the function itself. ${f}() would run it right now and hand over its result. This is how callbacks work in ROS 2.`,
    };
  },
});

T.push({
  id: "B-CB-WHICH", topic: "oop2", type: "mcq",
  make(r) {
    const t = pick(r, TOPICS), cb = pick(r, ["on_message", "listener_callback", "got_data", "handle_msg"]);
    return {
      prompt: `This line is in a node's \`__init__\`. When a new message arrives on topic \`${t}\`, which method does ROS 2 call automatically?`,
      code: `self.sub = self.create_subscription(String, '${t}', self.${cb}, 10)`,
      options: [cb, "create_subscription", "__init__", "main"],
      correct: cb,
      explain: `The third argument (self.${cb}) is the callback. ROS 2 calls it once for every message that arrives.`,
    };
  },
});

// ======================= topic: rosread (reading real ROS 2 code) =======================
T.push({
  id: "B-ROS-MAIN", topic: "rosread", type: "order",
  make(r) {
    const C = pick(r, ["MinimalPublisher", "WallAvoider", "Greeter", "BatteryMonitor"]);
    return {
      prompt: "Put the lines of a ROS 2 `main()` function in the correct order.",
      items: ["rclpy.init(args=args)", `node = ${C}()`, "rclpy.spin(node)", "node.destroy_node()", "rclpy.shutdown()"],
      explain: "Start ROS 2 (init), build your node object, keep it running (spin), then clean up (destroy_node) and stop ROS 2 (shutdown).",
    };
  },
});

T.push({
  id: "B-ROS-PUB", topic: "rosread", type: "mcq",
  make(r) {
    const t = pick(r, TOPICS);
    const good = `self.create_publisher(String, '${t}', 10)`;
    return {
      prompt: `Inside a node's \`__init__\`, which line creates a publisher that sends **String** messages on the topic \`${t}\`?`,
      options: [good, `self.create_publisher('${t}', String, 10)`, `self.create_subscription(String, '${t}', 10)`, `String.publish('${t}')`],
      correct: good,
      explain: "create_publisher(message type, topic name, queue size). The order matters.",
    };
  },
});

T.push({
  id: "B-ROS-MSG", topic: "rosread", type: "fill",
  make(r) {
    const txt = pick(r, ["Hello robot", "Go forward", "Battery OK", "Obstacle ahead", "Turning left"]);
    return {
      prompt: `You have \`msg = String()\`. Type the line that puts the text **${txt}** into the message.`,
      correct: `msg.data = '${txt}'`,
      accept: [`msg.data = '${txt}'`, `msg.data = "${txt}"`, `msg.data='${txt}'`, `msg.data="${txt}"`],
      explain: "A String message keeps its text in the data field: msg.data = '...'.",
    };
  },
});

T.push({
  id: "B-ROS-HELLO", topic: "rosread", type: "predict",
  make(r) {
    const word = pick(r, ["Hello", "Ping", "Beep", "Tick"]), k = int(r, 2, 5);
    const out = `${word} ${k - 1}`;
    return {
      prompt: `\`self.i\` starts at **0**. The timer calls \`timer_callback\` **${k} times**. What text is in the **last** message published?`,
      code: `def timer_callback(self):\n    msg = String()\n    msg.data = f'${word} {self.i}'\n    self.publisher_.publish(msg)\n    self.i += 1`,
      correct: out, accept: quoteVariants(out),
      explain: `Messages are ${Array.from({ length: k }, (_, i) => `${word} ${i}`).join(", ")}. The number is published first and increased after, so the last one is ${out}.`,
    };
  },
});

T.push({
  id: "B-ROS-NODE", topic: "rosread", type: "mcq",
  make(r) {
    const job = pick(r, ["reads a distance sensor", "drives the wheels", "shows camera images", "checks the battery"]);
    return {
      prompt: "Which sentence best describes a ROS 2 **node**?",
      options: [
        `One program with one job, for example a program that ${job}`,
        "A cable that connects two robots",
        "The folder where ROS 2 is installed",
        "A message that travels on a topic",
      ],
      correct: `One program with one job, for example a program that ${job}`,
      explain: "A robot runs many nodes. Each one does one job, and they talk to each other using topics.",
    };
  },
});

module.exports = T;
