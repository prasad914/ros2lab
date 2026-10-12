// rviz.html is the Robotic Models Simulator. Without ?robot= it shows the robot catalog; with ?robot=<id> (or
// ?robot=own for the student's own files) it is that robot's workbench window with its own workspace.
const robot = new URLSearchParams(location.search).get("robot");
document.body.classList.add(robot ? "sim-bench" : "sim-catalog");
document.getElementById(robot ? "bench" : "catalog").hidden = false;
if (robot) import("./rviz-page.js");
else import("./sim-catalog.js").then((m) => m.mountCatalog());
