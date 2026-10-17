// The list of mini-games and robot mission games. Each module exports mount(container, meta, { onWin }).
import { isGameUnlocked, getRobotReadiness } from "./readiness.js";

export const GAMES = [
  // 6 Basics Games
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

  // 15 Robot Mission Games (Prompt P12 / parity/playground.md)
  { id: "teleop_trial", track: "robots", title: "Teleop Time Trial", concept: "cmd_vel (TwistStamped), odom", badge: "Speedster", badgeIcon: "🏎️", week: 3, lesson: "Teleop", level: 1, minutes: 5,
    checks: ["TF", "NAV"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Finish the cone course against the clock with TwistStamped velocity commands.", load: () => import("./paths.js") },
  { id: "tf_detective", track: "robots", title: "TF Detective", concept: "TF tree, Fixed Frame", badge: "TF Sleuth", badgeIcon: "🔍", week: 3, lesson: "Transforms", level: 1, minutes: 4,
    checks: ["TF"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Answer transform lookups within ±1 cm across frames.", load: () => import("./paths.js") },
  { id: "mapping_race", track: "robots", title: "Mapping Race", concept: "SLAM Toolbox", badge: "Cartographer", badgeIcon: "🗺️", week: 4, lesson: "SLAM", level: 4, minutes: 8,
    checks: ["TF", "SENS", "SLAM"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Reach map coverage target against ground truth and save the map.", load: () => import("./paths.js") },
  { id: "kidnapped_robot", track: "robots", title: "Kidnapped Robot", concept: "AMCL, 2D Pose Estimate", badge: "Localization Master", badgeIcon: "🎯", week: 5, lesson: "AMCL", level: 5, minutes: 6,
    checks: ["AMCL"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Relocalise the robot after a teleport with 2D Pose Estimate.", load: () => import("./paths.js") },
  { id: "treasure_hunt", track: "robots", title: "Treasure Hunt", concept: "Waypoints / Simple Commander", badge: "Navigator", badgeIcon: "⚓", week: 6, lesson: "Nav2", level: 7, minutes: 8,
    checks: ["NAV"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Visit 5 waypoints efficiently using Nav2 action goals.", load: () => import("./paths.js") },
  { id: "planner_showdown", track: "robots", title: "Planner Showdown", concept: "NavFn vs Smac vs Theta*", badge: "Path Guru", badgeIcon: "📊", week: 6, lesson: "Planners", level: 7, minutes: 5,
    checks: ["NAV"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Predict shortest paths across NavFn, Smac2D, and Theta* planners.", load: () => import("./paths.js") },
  { id: "narrow_doorway", track: "robots", title: "Narrow Doorway", concept: "Inflation radius & costmaps", badge: "Precision Pilot", badgeIcon: "🚪", week: 6, lesson: "Costmaps", level: 6, minutes: 6,
    checks: ["NAV"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Pass through narrow doorways without collision by tuning costmap parameters.", load: () => import("./paths.js") },
  { id: "keepout_delivery", track: "robots", title: "Keepout Delivery", concept: "Keepout & speed filters", badge: "Rule Follower", badgeIcon: "🛑", week: 7, lesson: "Filters", level: 10, minutes: 7,
    checks: ["NAV", "FILT"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Deliver packages while respecting keepout zones and speed limits.", load: () => import("./paths.js") },
  { id: "dynamic_dodge", track: "robots", title: "Dynamic Dodge", concept: "Collision monitor & local costmap", badge: "Reflex Master", badgeIcon: "⚡", week: 7, lesson: "Collision Monitor", level: 8, minutes: 6,
    checks: ["NAV", "CM"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Survive moving obstacles with zero contacts.", load: () => import("./paths.js") },
  { id: "color_finder", track: "robots", title: "Colour Finder", concept: "Image topic & simple CV", badge: "Vision Scout", badgeIcon: "👁️", week: 4, lesson: "Sensors", level: 2, minutes: 5,
    checks: ["CAM"], robotWhitelist: ["tb3_waffle", "tb3_waffle_pi"], // unavailable for tb3_burger
    blurb: "Stop in front of the red box using camera image topics (Waffle / Waffle Pi only).", load: () => import("./paths.js") },
  { id: "line_follower", track: "robots", title: "Line Follower", concept: "Camera pipeline & control", badge: "Lane Tracer", badgeIcon: "〰️", week: 4, lesson: "Camera", level: 3, minutes: 6,
    checks: ["CAM"], robotWhitelist: ["tb3_waffle", "tb3_waffle_pi"],
    blurb: "Complete a lap following the line with camera feedback.", load: () => import("./paths.js") },
  { id: "dock_it", track: "robots", title: "Dock It", concept: "Docking server", badge: "Dock Master", badgeIcon: "⚓", week: 7, lesson: "Docking", level: 10, minutes: 5,
    checks: ["DOCK"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"], // PENDING for TB3 -> locked
    blurb: "Dock the robot within precise pose tolerance.", load: () => import("./paths.js") },
  { id: "bt_builder", track: "robots", title: "BT Builder", concept: "Behavior Trees (BT.CPP)", badge: "Tree Architect", badgeIcon: "🌳", week: 7, lesson: "Behavior Trees", level: 9, minutes: 8,
    checks: ["NAV", "BT"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Build a behavior tree that recovers from blocked paths.", load: () => import("./paths.js") },
  { id: "escape_room", track: "robots", title: "Debugging Escape Room", concept: "QoS, TF, use_sim_time, lifecycle", badge: "Debug Hero", badgeIcon: "🗝️", week: 7, lesson: "Troubleshooting", level: 10, minutes: 10,
    checks: ["TF", "AMCL", "NAV"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"],
    blurb: "Fix 5 real faults from parity/mistakes.yaml with faithful ROS error messages.", load: () => import("./paths.js") },
  { id: "relay", track: "robots", title: "Hospital Escort Relay", concept: "Namespaces & multi-robot", badge: "Fleet Dispatcher", badgeIcon: "🏥", week: 7, lesson: "Multi-robot", level: 10, minutes: 8,
    checks: ["NS", "NAV"], robotWhitelist: ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"], // PENDING for single robot -> locked
    blurb: "Hand off navigation between multiple robots.", load: () => import("./paths.js") },
];

// level: 1 beginner, 2 intermediate, 3 advanced; minutes: a first play-through
export const LEVELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };

export const TRACKS = [
  { id: "basics", title: "ROS 2 basics", blurb: "One idea each, from the terminal to topics, services and actions." },
  { id: "robots", title: "Robot Missions & Parity Games", blurb: "Robot challenges and playground games. Not yet validated against real ROS 2." },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);

export function getGamesForRobot(robotId = "tb3_burger") {
  return GAMES.map((g) => {
    if (g.track === "basics") return { ...g, unlocked: true, lockReason: null };
    const inWhitelist = !g.robotWhitelist || g.robotWhitelist.includes(robotId);
    if (!inWhitelist) return { ...g, unlocked: false, lockReason: "Robot not supported" };
    const { unlocked, missingCheck } = isGameUnlocked(g.id, robotId, g.checks || []);
    return {
      ...g,
      unlocked,
      lockReason: missingCheck ? `Locked: missing check ${missingCheck}` : null,
    };
  });
}

export async function mountGame(container, id, opts = {}) {
  const g = gameById(id);
  if (!g) { container.textContent = `Unknown game: ${id}`; return; }
  // Check robot context if available
  const robotId = opts.robotId || "tb3_burger";
  if (g.track === "robots") {
    const { unlocked, missingCheck } = isGameUnlocked(g.id, robotId, g.checks || []);
    if (!unlocked) {
      container.replaceChildren(
        Object.assign(document.createElement("div"), {
          className: "game-locked",
          innerHTML: `<h3>🔒 Game Locked</h3><p>This mission requires check <b>${missingCheck}</b>, which is currently PENDING or FAIL for <b>${robotId}</b>. Per ROS2Lab parity rules, unverified checks keep the game locked.</p>`
        })
      );
      return;
    }
  }
  const mod = await g.load();
  mod.mount(container, g, opts);
}
