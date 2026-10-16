# P10 advanced persona — tb3_burger

**Outcome: BLOCKED / PENDING.** No real ROS was run, as requested. No browser output was captured, so no parity verdict is claimed.

## Scope and evidence

- Matching mistake: `namespace_tf_prefix` (advanced, level 10, scenario `nav2_bringup`). `reported_real` is only a hint, not fixture evidence. No matching `errors/namespace_tf_prefix.txt` fixture was found under `parity/fixtures/tb3_burger`; real behavior is **PENDING** (real ROS explicitly out of scope).
- Local course-content inspection found nine modules (Week 1 through Week 9); no Week 10 module was found. This was source inspection, not a live browser reading.
- A browser-only web-tester run was requested, but could not be launched: the agent system returned `Concurrent subagent limit reached. You can run 4 subagents at once. Do not retry.`
- A follow-up attempt to check the live course website was denied permission to use Bash. No browser session or web-tester evidence was produced.

## Matching mistake

| ID / level | Real behavior | Browser behavior | Verdict | Faithful error first, helpful hint second? | Would course text have prevented it? / clarity |
|---|---|---|---|---|---|
| `namespace_tf_prefix` / 10 | PENDING — no real ROS run and no matching real error fixture. | PENDING — web-tester could not launch; no browser reproduction observed. | PENDING | Not assessed; neither error nor hint sequence was observed. | Not assessed: no level-10 course text/browser steps were available to inspect. A useful explanation should explicitly connect namespace scoping with the frame IDs required by Nav2/TF, but this is a clarity recommendation, not an observation of existing text. |

## Course issues / blockers

- The inspected course JSON contains nine modules (Weeks 1–9), not a Week 10 module. This does not establish what the live website displays; it means no Week 10 course text was available in the inspected source for this observation.
- Browser completion was blocked by web-tester subagent capacity and denied Bash permission for the live-site check. No browser behavior, faithful error, hint, or course-step usability result is claimed.
