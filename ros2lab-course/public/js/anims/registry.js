// Concept animations: short, interactive explainers that narrate each step.
// Lesson block: { "t": "anim", "id": "pubsub", "intro": "optional sentence" }. They never block lesson completion.
export const ANIMS = [
  { id: "pathtree", title: "Where am I? Folders and cd", concept: "absolute and relative paths", week: 1, load: () => import("./pathtree.js") },
  { id: "perms", title: "Permission switches", concept: "rwx, chmod 755 / 644 / 600", week: 1, load: () => import("./perms.js") },
  { id: "blueprint", title: "One blueprint, many robots", concept: "classes, objects and self", week: 2, load: () => import("./blueprint.js") },
  { id: "spin", title: "What does spin() do?", concept: "callbacks, timers and the queue", week: 2, load: () => import("./spin.js") },
  { id: "layers", title: "Where ROS 2 fits", concept: "the robot software stack", week: 3, load: () => import("./layers.js") },
  { id: "pubsub", title: "Topics: one message, many listeners", concept: "publish and subscribe", week: 3, load: () => import("./pubsub.js") },
  { id: "twist", title: "Build a Twist message", concept: "message types and fields", week: 3, load: () => import("./twist.js") },
  { id: "service", title: "Services: ask and wait", concept: "request and response", week: 3, load: () => import("./service.js") },
  { id: "params", title: "Parameters: change settings live", concept: "ros2 param get / set", week: 3, load: () => import("./params.js") },
  { id: "action", title: "Actions: goal, feedback, result", concept: "long jobs you can cancel", week: 3, load: () => import("./action.js") },
  { id: "launch", title: "Launch: the whole robot in one command", concept: "launch files", week: 3, load: () => import("./launch.js") },
  { id: "workspace", title: "Build, source, run", concept: "colcon workspaces and overlays", week: 3, load: () => import("./workspace.js") },
  { id: "tf", title: "Same point, different frames", concept: "TF2 coordinate frames", week: 3, load: () => import("./tf.js") },
];

export const animById = (id) => ANIMS.find((a) => a.id === id);

export async function mountAnim(container, id) {
  const a = animById(id);
  if (!a) { container.textContent = `Unknown animation: ${id}`; return; }
  const mod = await a.load();
  mod.mount(container, a);
}
