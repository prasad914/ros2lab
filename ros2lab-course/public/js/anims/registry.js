// Concept animations: short, interactive explainers that narrate each step.
// Lesson block: { "t": "anim", "id": "pubsub", "intro": "optional sentence" }. They never block lesson completion.
export const ANIMS = [
  { id: "pathtree", title: "Where am I? Folders and cd", concept: "absolute and relative paths", week: 1, load: () => import("./pathtree.js") },
  { id: "perms", title: "Permission switches", concept: "rwx, chmod 755 / 644 / 600", week: 1, load: () => import("./perms.js") },
  { id: "blueprint", title: "One blueprint, many robots", concept: "classes, objects and self", week: 2, load: () => import("./blueprint.js") },
  { id: "spin", title: "What does spin() do?", concept: "callbacks, timers and the queue", week: 2, load: () => import("./spin.js") },
  { id: "layers", title: "Where ROS 2 fits", concept: "the robot software stack", week: 4, load: () => import("./layers.js") },
  { id: "pubsub", title: "Topics: one message, many listeners", concept: "publish and subscribe", week: 4, load: () => import("./pubsub.js") },
  { id: "twist", title: "Build a Twist message", concept: "message types and fields", week: 4, load: () => import("./twist.js") },
  { id: "service", title: "Services: ask and wait", concept: "request and response", week: 4, load: () => import("./service.js") },
  { id: "params", title: "Parameters: change settings live", concept: "ros2 param get / set", week: 4, load: () => import("./params.js") },
  { id: "action", title: "Actions: goal, feedback, result", concept: "long jobs you can cancel", week: 4, load: () => import("./action.js") },
  { id: "launch", title: "Launch: the whole robot in one command", concept: "launch files", week: 4, load: () => import("./launch.js") },
  { id: "workspace", title: "Build, source, run", concept: "colcon workspaces and overlays", week: 4, load: () => import("./workspace.js") },
  { id: "tf", title: "Same point, different frames", concept: "TF2 coordinate frames", week: 4, load: () => import("./tf.js") },
  { id: "platform", title: "Why robots need a framework", concept: "robot software platforms", week: 3, load: () => import("./platform.js") },
  { id: "timeline", title: "The ROS story, 2007 to 2026", concept: "history of ROS", week: 3, load: () => import("./timeline.js") },
  { id: "distros", title: "Which ROS 2 version?", concept: "distributions and LTS", week: 3, load: () => import("./distros.js") },
  { id: "master", title: "ROS 1 master vs ROS 2 discovery", concept: "ROS 1 vs ROS 2", week: 3, load: () => import("./master.js") },
  { id: "rmw", title: "From your code to the network", concept: "middleware layers and rmw", week: 3, load: () => import("./rmw.js") },
  { id: "discovery", title: "How DDS finds other nodes", concept: "discovery and ROS_DOMAIN_ID", week: 3, load: () => import("./discovery.js") },
  { id: "qos", title: "QoS matchmaker", concept: "quality of service", week: 3, load: () => import("./qos.js") },
  { id: "rosidl", title: "From a .msg file to code", concept: "custom interfaces", week: 5, load: () => import("./rosidl.js") },
  { id: "deadlock", title: "call() vs call_async()", concept: "service clients and the executor", week: 5, load: () => import("./deadlock.js") },
  { id: "actionwire", title: "Inside an action", concept: "3 services + 2 topics, goal states", week: 5, load: () => import("./actionwire.js") },
  { id: "paramcb", title: "Parameter callbacks", concept: "validate and react to changes", week: 5, load: () => import("./paramcb.js") },
  { id: "launchcfg", title: "What a launch file does to names", concept: "namespace, remap, params file", week: 5, load: () => import("./launchcfg.js") },
];

export const animById = (id) => ANIMS.find((a) => a.id === id);

export async function mountAnim(container, id) {
  const a = animById(id);
  if (!a) { container.textContent = `Unknown animation: ${id}`; return; }
  const mod = await a.load();
  mod.mount(container, a);
}
