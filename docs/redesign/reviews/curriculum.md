# ROS2Lab: curriculum and course-delivery review

**Verdict:** The bones are good: a clear two-programme split, a week-by-week plan, honest certificate rules and a strong lesson pattern (story, outcomes, terminal practice, quick check with feedback, summary).
**What blocks enrolment and trust:** the pacing claim does not add up, the outcomes aren't tied to the weeks or tests, the home page promises SLAM/Nav2 that the syllabus never teaches, and nothing says who the instructor is or how the certificate is verified.
**Fix the eight Must items before launch.** Most need content from the owner, not design work.

## Must

1. **Home and Courses, "About an hour a day" / "~30 min each".** 95 × 30 min is about 48 h, plus the tests and the project, so roughly 55 h over 30 days, or about 1.8 h a day. Week 5 (20 lessons) needs about 2 h a day. **Fix:** state the total ("about 55 hours") and hours per week in the week table ("Week 5 · ~10 h"). Either rebalance the weeks or change the copy to "1–2 hours a day".

2. **Home, "Inside the course you also drive TurtleBot3… SLAM… Nav2".** No lesson in Weeks 1–9 covers this. **Fix:** remove the sentence, or add those lessons to the plan. Every promise needs a week.

3. **Home, "What you will be able to do".** The outcomes aren't mapped to weeks or tests. Some overclaim ("Write Python and C++ programs from scratch"), and some can't be observed ("Work confidently"). **Fix:** add an outcomes matrix on Course plan with columns Outcome / Weeks / Assessed by. Use measurable verbs, e.g. "Write a Python node that publishes and subscribes (Wk 5 · Test 5 · Project)".

4. **Course plan, Requirements: the project.** "Score 80% on your project" has no brief, rubric, grader, deadline or resubmission rule. Home lists four projects plus "Your final project", so it's unclear which one counts. **Fix:** add a Project card covering the task, deliverables (package repo, launch file, demo video), a weighted rubric, who marks it and how long that takes, and the resubmission policy. The owner must supply these.

5. **Certificate credibility (Requirements, footer "Verify a certificate").** The Verify link goes to Home. There is no instructor name, issuing body, hours or outcomes statement, and no integrity rule. **Fix:** build a Verify page (ID → name, course, date, hours, outcomes, expiry) and publish a sample certificate. Name the signing instructor with their credentials. Add an honour code plus one integrity measure (randomised question banks, or a project code review or viva).

6. **Lesson, "Name the five ways ROS programs communicate".** Nodes are the programs, not a way of communicating, so this outcome teaches a misconception. **Fix:** "Name the four ways nodes communicate: topics, services, actions, parameters." Update the summary and the Chiku analogy to match.

7. **Portal, Notices "21 days Access period… keep access for life".** This contradicts "self-paced", gives no date, and doesn't say what happens at zero. **Fix:** "Finish by [date] to keep lifetime access. After that: [rule]." Also show the rule before registration.

8. **Home, "Get approved".** There are no criteria and no expected wait. **Fix:** "We check registrations within N working days." Also state the minimum age and the parental consent rule. The owner must supply these.

## Should

9. **Home, what parents and teachers need to decide.** Missing: an instructor profile, language of instruction, prerequisite maths or English level, price after the founding batch, a support channel with response time, and privacy for minors. **Fix:** add a "Before you enrol" block and a PDF syllabus download (outcomes, weekly plan, hours, assessment rules).

10. **Course plan, sequencing.** Day 7 "first ROS 2 node" and Day 9 "Reading a ROS 2 C++ node" come before Day 10 "Install ROS 2 Jazzy" and Week 3 "Why robots need ROS". Week 3 is 11 conceptual lessons, including the 2007–2026 history. **Fix:** move the install lesson earlier, and make the history and version lessons optional reading.
11. **Requirements and FAQ: test policy.** It doesn't say what happens after two failed attempts, which score counts, whether tests have deadlines, or whether there is feedback per question. **Fix:** add a "Tests" FAQ that answers these four.

12. **Portal overview.** Test scores (82%, 74%) appear only on Course plan, and "8 left · Week 3 test" is ambiguous. **Fix:** "Tests: W1 82% ✓ · W2 74% ✓ · W3 opens after 8 more lessons". Add an expected finish date at the current pace.

13. **Lesson, progress state.** Course plan marks "The parts of ROS" as Done, but the lesson page shows "2 of 4 tasks done". **Fix:** make "Done" require all tasks, and show "Finish tasks to complete" by the Next button.

## Could

14. **Lesson, practice and summary.** The practice covers only Communication, but the outcomes include Tools. The summary repeats the list word for word. **Fix:** add a task such as "ros2 run rqt_graph rqt_graph". Make the summary "key ideas + one common mistake + what's next".

15. **Content accessibility and the modelling module.** Nothing says whether there are captions, transcripts or a screen-reader alternative to the terminal. The module has no outcomes list, and Day 45 packs drones, legged and hybrid robots plus the project into one day. **Fix:** add an accessibility statement (the owner supplies the facts), add outcomes for Weeks 7–9, and split Day 45. Change the Home hero's "a real turtle robot" to "a simulated turtle robot".
