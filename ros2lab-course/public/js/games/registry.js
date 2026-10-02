// The list of mini-games. Each module exports mount(container, { onWin }).
export const GAMES = [
  { id: "paths", title: "Path Finder", concept: "cd and file paths", badge: "Pathfinder", badgeIcon: "~", week: 1, lesson: "Day 1",
    blurb: "Guide Chiku through the folder tree by typing the right cd command.", load: () => import("./paths.js") },
  { id: "radio", title: "Tune the Radio", concept: "Topics: publish and subscribe", badge: "Topic Tuner", badgeIcon: "📻", week: 2, lesson: "Day 7",
    blurb: "Tune each robot part to the right topic so the messages arrive.", load: () => import("./radio.js") },
  { id: "pizza", title: "Pizza Tracker", concept: "Services and actions", badge: "Action Hero", badgeIcon: "🍕", week: 2, lesson: "Day 9",
    blurb: "Order at the counter, then order on the app, and feel the difference.", load: () => import("./pizza.js") },
  { id: "tsa", title: "Topic, Service or Action?", concept: "Choosing how nodes talk", badge: "Graph Architect", badgeIcon: "⇄", week: 2, lesson: "Day 9",
    blurb: "Ten robot situations. Pick the right way for the nodes to talk.", load: () => import("./tsa.js") },
  { id: "source", title: "Source It!", concept: "source, overlays and ~/.bashrc", badge: "Toolbelt", badgeIcon: "🧰", week: 2, lesson: "Day 10",
    blurb: "Fix 'command not found' by loading the right toolboxes into each terminal.", load: () => import("./source.js") },
  { id: "turtle", title: "Turtle Commander", concept: "turtlesim with real ros2 commands", badge: "Turtle Pilot", badgeIcon: "🐢", week: 2, lesson: "Day 10",
    blurb: "Drive the turtle with the same ros2 commands you will use on Ubuntu.", load: () => import("./turtle.js") },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);

export async function mountGame(container, id, opts = {}) {
  const g = gameById(id);
  if (!g) { container.textContent = `Unknown game: ${id}`; return; }
  const mod = await g.load();
  mod.mount(container, g, opts);
}
