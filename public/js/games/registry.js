// The list of mini-games. Each module exports mount(container, meta, { onWin }). Lessons embed them by id
// ({ "t": "game", "id": "radio" }), so ids never change. badgeIcon is the text icon other pages show;
// the Playground draws its own pictures (games/art.js).
export const GAMES = [
  { id: "paths", track: "basics", title: "Path Finder", concept: "cd and file paths", badge: "Pathfinder", badgeIcon: "~", week: 1, lesson: "Day 1", level: 1, minutes: 3,
    blurb: "Guide Chiku through the folder tree by typing the right cd command.", load: () => import("./paths.js") },
  { id: "radio", track: "basics", title: "Tune the Radio", concept: "Topics: publish and subscribe", badge: "Topic Tuner", badgeIcon: "📻", week: 2, lesson: "Day 7", level: 1, minutes: 3,
    blurb: "Tune each robot part to the right topic so the messages arrive.", load: () => import("./radio.js") },
  { id: "pizza", track: "basics", title: "Pizza Tracker", concept: "Services and actions", badge: "Action Hero", badgeIcon: "🍕", week: 2, lesson: "Day 9", level: 1, minutes: 3,
    blurb: "Order at the counter, then order on the app, and feel the difference.", load: () => import("./pizza.js") },
  { id: "tsa", track: "basics", title: "Topic, Service or Action?", concept: "Choosing how nodes talk", badge: "Graph Architect", badgeIcon: "⇄", week: 2, lesson: "Day 9", level: 1, minutes: 4,
    blurb: "Robot situations, one at a time. Pick the right way for the nodes to talk.", load: () => import("./tsa.js") },
  { id: "source", track: "basics", title: "Source It!", concept: "source, overlays and ~/.bashrc", badge: "Toolbelt", badgeIcon: "🧰", week: 2, lesson: "Day 10", level: 1, minutes: 4,
    blurb: "Fix 'command not found' by loading the right toolboxes into each terminal.", load: () => import("./source.js") },
  { id: "turtle", track: "basics", title: "Turtle Commander", concept: "turtlesim with real ros2 commands", badge: "Turtle Pilot", badgeIcon: "🐢", week: 2, lesson: "Day 10", level: 1, minutes: 6,
    blurb: "Drive the turtle with the same ros2 commands you will use on Ubuntu.", load: () => import("./turtle.js") },
];

// level: 1 beginner, 2 intermediate, 3 advanced; minutes: a first play-through
export const LEVELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };

// One collection for now. Robot missions (real robots doing real jobs) will be designed later; a game may then
// carry track: "robots" with a new entry here, and the Playground list can then be grouped by track.
export const TRACKS = [
  { id: "basics", title: "ROS 2 basics", blurb: "One idea each, from the terminal to topics, services and actions." },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);

export async function mountGame(container, id, opts = {}) {
  const g = gameById(id);
  if (!g) { container.textContent = `Unknown game: ${id}`; return; }
  const mod = await g.load();
  mod.mount(container, g, opts);
}
