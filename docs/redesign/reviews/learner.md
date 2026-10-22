# ROS2Lab prototype: learner and growth review

**Verdict.** On desktop, a visitor gets what it is, who it's for, that it's free and how to start in under 10 seconds. The hero and the "Is this course for you?" box are strong.
On a 390px phone the hero breaks, three orange buttons compete, and the page weighs 945 KB.
Copy contradictions (install, hours a day, what "free" covers) and no named people behind the course cost trust before the terminal hook can win it.

## Must

1. **Home > hero (390px).** The grid doesn't collapse: the `.hero .wrap{grid-template-columns:1.15fr .85fr}` rule in "home refinements" overrides the 960px media query. The headline gets about 55% width, the fit box wraps one word per line, and "Try the terminal" hides under the sticky bar. **Fix:** scope that rule to `@media (min-width:961px)` and put the fit box below the CTAs.

2. **Home copy contradicts the plan.**
   - "Nothing to install" vs Day 10 "Install ROS 2 Jazzy and set up the lab".
   - "About an hour a day" vs 95 × ~30 min in 30 days, about 1.5 h a day (Week 5 is 20 lessons in 5 days).
   - "A real turtle robot" is turtlesim, a 2D simulation.

   **Fix:** "Nothing to install to start." "About 1–2 hours a day." "A simulated turtle robot."

3. **Free and access are unclear.** The sticky bar's "Free until 31 Dec 2026" reads as "you pay after". The portal's "21 DAYS · Access period · Finish lessons and tests to keep access for life" alarms and explains nothing. **Fix:** state one rule everywhere: "Register by 31 Dec 2026 and the course is free for you. After that: [owner to state]." In the portal, if true: "21 days left to finish Weeks 1–6. Finish them and keep access for life."

4. **Trust signals are missing.** There's no instructor name or photo, no organisation, no contact, no approval time, and no sample lesson for visitors. "Your instructor signs it" makes people ask: who? **Fix:** add a "Who teaches this" block (name, photo, two lines of background). Add "Approval usually takes [X]", a contact email or WhatsApp, and a "Try a free lesson" link to the Lesson view.

5. **Load weight.** Everything ships on first load: 750 KB of base64 WebP (42 images, some repeated), 490 KB of inline JS for all 8 views, and 4 font families. **Fix:** move images to external files with `loading="lazy"`, load terminal and simulator JS only when their view opens, and use 2 fonts. Target under 200 KB for the first screen.

## Should

6. **Home > live terminal.** The demo works well on a phone (it splits the terminal and shows an arrow pad), but it has no goal. The intro sentence, the shortcut line and the Nodes/Topics/Services tabs are jargon up front. **Fix:** "Make a robot move in 3 taps: 1. Tap the first command to start the turtle. 2. Tap the second to take control. 3. Drive with ← ↑ ↓ →." Hide the shortcuts behind "Keyboard shortcuts". Rename the tabs "More commands".

7. **Header > Log in.** It uses the same orange as "Register free", so the first phone screen shows three orange buttons. **Fix:** make Log in an outline or text link.

8. **Courses page.** There's no register CTA, and "Open the course" means nothing when logged out. On mobile the Compare table drops the second column. "Two separate programmes" clashes with "Weeks 7–9, best after Week 6". **Fix:** "One main course, plus an optional extra. Start with ROS 2 from zero (Weeks 1–6, certificate). Then add Robot modelling & RViz (Weeks 7–9, no certificate)." Use "Register free" and "See the course plan" as the buttons. On mobile, show the comparison as two stacked cards.

9. **Simulator page.** 30 of 33 robots are "Under test", but that's explained only in the last line. Cards use "revolute", "prismatic", "xacro arg use_lidar" and "dof:=7". **Fix:** add a top line: "New here? Open TurtleBot3 Burger, the robot from the course." Move the note to the top: "Under test: opens in the simulator, no lessons yet." Default the filter to "Course robots" and write plain one-liners ("A robot arm used in factories").

10. **Portal > Notices.** "8 LEFT · Week 3 test" has no unit. **Fix:** "8 lessons left before your Week 3 test." Also show "36%", and change "You studied on 4 days" to "4 days this week. 1 more to reach your 5-day goal."

11. **Lesson > state and gating.** The plan marks "The parts of ROS" Done, but the lesson shows "2 of 4 tasks done" and a greyed "Next" with no reason. **Fix:** make the states match and label the button "Finish 2 more tasks to unlock Next".

12. **Home > outcomes and projects.** "tf2 frames, QoS settings and lifecycle nodes" is jargon for the "never written code" reader you just invited. **Fix:** lead with results ("Start two robots with one command") and put the terms after them in grey.

## Could

13. **Mobile tap targets.** 17–42 targets per view are under 32px tall (chips, tabs, footer links). **Fix:** make targets at least 44px. Make task commands tappable so returning phone students can practise without typing.

14. **Hero facts strip.** It doesn't say what language the course is taught in or what a lesson looks like. **Fix:** add the teaching language and the lesson format (text, video, or both). Owner to supply these.
