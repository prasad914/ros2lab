# P10 beginner persona — tb3_waffle

**Outcome: BLOCKED / PENDING.** Browser-only task; no real ROS was run. No application or fixture files were edited.

## Run status and evidence

- The web-tester attempted to run the browser-only workflow, but permission to check the development server was denied and it had no permitted route to open the course site or run the required Playwright session. No browser reproductions, copied browser text, or browser evidence files were produced for the beginner persona.
- The course levels were not read through the website. No claim is made about whether course text would have prevented the mistakes.
- No real ROS behavior was requested or attempted. No matching error fixture files exist under `/home/prasad/ros2lab-course/parity/fixtures/tb3_waffle/**/errors/`; real behavior is PENDING, not copied from `reported_real` hints.
- A separate careless browser session did capture simulator state, but it is not used as beginner reproduction evidence.

## Applicable P10 mistakes

IDs are selected by beginner persona and levels at or before P10 in `/home/prasad/ros2lab-course/parity/mistakes.yaml`. Burger-only sensor mistakes do not apply to tb3_waffle.

| ID / level | Real behavior (copied fixture text) | Browser behavior (copied text) | Verdict | Faithful error first, helpful hint second? | Would course text have prevented it? / clarity |
|---|---|---|---|---|---|
| `no_tb3_model` / 1 | PENDING — no real run; no matching error fixture. | PENDING — browser reproduction blocked; no copied text. | PENDING | PENDING | PENDING — website course level not read. |
| `wrong_fixed_frame` / 1 | PENDING — no real run; no matching error fixture. | PENDING — browser reproduction blocked; no copied text. | PENDING | PENDING | PENDING — website course level not read. |
| `pose_estimate_during_slam` / 4 | PENDING — no real run; no matching error fixture. | PENDING — browser reproduction blocked; no copied text. | PENDING | PENDING | PENDING — website course level not read. |
| `goal_before_initial_pose` / 5 | PENDING — no real run; no matching error fixture. | PENDING — browser reproduction blocked; no copied text. | PENDING | PENDING | PENDING — website course level not read. |
| `goal_in_obstacle` / 7 | PENDING — no real run; no matching error fixture. | PENDING — browser reproduction blocked; no copied text. | PENDING | PENDING | PENDING — website course level not read. |

## Course issues

PENDING — no course steps were observed through the website, so no confusing, wrong, or impossible course step can be reported as an observation.
