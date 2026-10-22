# ROS2Lab redesign handoff (v3)

Approved prototype: plain white university theme (navy menu band, orange actions), compact layout, dark-background logo, a live "practice computer" (Ubuntu 24.04 + Terminator + turtlesim, ROS 2 Jazzy CLI), a separate Courses page, and a Robot simulator catalogue with all 33 robots from `public/robots/index.json`.

Copy this whole folder into the repo as `docs/redesign/` (read-only reference). Do not serve it.

| Path | What it is |
|---|---|
| `prototype/ros2lab-campus.html` | Final prototype, images embedded. Views: home, courses, simulator, robot, course, modelling, dashboard, lesson (switch with the orange bar under the menu). |
| `prototype/ros2lab-campus.src.html` | Same with `{{IMG_*}}` placeholders for the 5 large images. All CSS is in its `<style>` block. |
| `prototype/home.html`, `home.css`, `fixes.css` | Home sections, their CSS, and the CSS from the expert review fixes. |
| `sim/views2.html`, `sim.css`, `sim.js`, `robots.json` | Courses page, Robot simulator catalogue and robot info page. `robots.json` is extracted from `public/robots/index.json` + `public/robots/ws/index.json` (no new data, except the Waffle Pi sensors noted below). |
| `lab/lab.html`, `lab.css`, `lab.js` | The practice computer and its ROS 2 CLI emulator (updated after the ROS expert review). |
| `reviews/*.md` | Four expert reviews: web design, curriculum, ROS realism, learner experience. |
| `assets/*.webp` | TurtleBot3 Burger / Waffle / Waffle Pi, UR5e, Chiku images. |

## Navigation (changed in v2)
No dropdown. Header: Home · Courses · Simulator · Student portal · Help · search · Log in.
- **Courses** opens a Courses page with two module cards: *ROS 2 from zero* (with certificate, Weeks 1–6) and *Robot modelling & RViz* (without certificate, Weeks 7–9), then a comparison table.
- **Simulator** opens the robot catalogue: TurtleBot3 featured at the top ("Course robot"), then tabs All / Mobile / Manipulators / Legged & humanoids / Drones / Hybrid, a filter box, and "Your own robot". Every other robot carries an **Under test** badge. A card opens a robot info page; its "Open in the simulator" button goes to `rviz.html?robot=<id>` (the existing workbench).

## v3 (21 Oct 2026): calm style + Playground
`prototype/calm.css` is the final layer: white header, quiet links, navy buttons, 12px rounded cards, light borders, more white space, light footer. The Playground (`playground/`) lists the 6 games, the 15 locked missions (collapsed) and the 27 concept animations by week, with the same links as public/playground.html.

## Design tokens
navy `#13315C`, navy-dark `#0B2545`, orange `#C2570C` (white text), orange-light `#FDF0E6`, tint `#F4F6F9`, text `#1F2933`, text-2 `#52606D`, rule `#DCE2E9`, ok `#1E7B45`, link `#1D5FA8`, under-test `#FFF6DB`/`#7A5A00`. Focus ring navy `#13315C` on white, `#F2A65A` in the header. Fonts: Source Sans 3, Source Code Pro, Ubuntu + Ubuntu Mono (practice computer only).

## Terminator defaults used
Focused title bar `#C80003`/white, inactive `#C0BEBF`/black, background `#000000`, foreground `#AAAAAA`, prompt bold `#8AE234` / `#729FCF`. Shift+Ctrl+O / E split, Alt+arrows, Ctrl+C, Tab, right-click menu. Shift+Ctrl+T/W/Q are reserved by browsers, so they are in the menu.

## Owner decisions (v2, 21 Oct 2026)
- No instructor name. The course is presented as **from the Robotics & ROS 2 Lab YouTube channel**, with the channel logo (the dark rounded axes logo) and the link https://youtu.be/-tL0dp7Kloc (as on the current site). Certificates are signed as "Robotics & ROS 2 Lab · Course team, ROS2Lab" (see `certificate/CHANGES.md`).
- Registration is automatic (`REGISTRATION_MODE = "auto"`): no approval step is mentioned anywhere.
- Plans after the founding batch: not decided, so nothing is said beyond "register by 31 Dec 2026 to study free".
- All other questions are answered from the site's existing rules (functions/config.js, functions/projects.js, index.html FAQ): 60-day access, lifetime access if Weeks 1–6 are finished and every test passed in time, one extension of up to 30 days, up to 2 re-registrations, tests of 15 questions / 35 min / 2 attempts / best score / 60%, personal project with up to 2 submissions, 80% pass and the 5-part marking scheme (40/15/20/10/15), certificate valid 2 years with a Verify page, LinkedIn and QR.
- Certificate: the existing template is kept and refined (see `certificate/CHANGES.md`). New prototype view "certificate" shows the Verify page with the sample.

## Still open (only if you want them)
1. Real student quotes, when you have them.
2. Confirm the Waffle Pi sensors and speeds before adding them to `robots/index.json`; confirm the Go2 source link (currently a ROS 1 repo).
