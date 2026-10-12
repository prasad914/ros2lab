// What the settings inside a launch file do to node, topic and parameter names.
import { frame, box, label, pulse, el } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 220 });
  const S = f.stage;
  const chk = (t) => { const c = el("input", { type: "checkbox" }); f.extra.append(el("label", { class: "anim-field" }, c, " " + t)); return c; };
  const ns = chk("namespace=\"robot1\""), nm = chk("name=\"chiku_left\""), rm = chk("remap chatter → /announcements"), pf = chk("load params file");
  const key = el("select", { "aria-label": "First line of the YAML file" }, ["chiku_speed:", "/robot1/chiku_speed:", "/**:"].map((k) => el("option", { value: k, text: k })));
  f.extra.append(el("label", { class: "anim-field" }, "YAML file starts with ", key));
  const xml = el("pre", { class: "anim-file" });
  f.extra.append(xml);
  function names() {
    const node = nm.checked ? "chiku_left" : "chiku_speed";
    const full = `${ns.checked ? "/robot1" : ""}/${node}`;
    const topic = rm.checked ? "/announcements" : `${ns.checked ? "/robot1" : ""}/chatter`;
    const k = key.value.replace(/:$/, "");
    const applied = pf.checked && (k === "/**" || "/" + k.replace(/^\//, "") === full);
    return { node, full, topic, applied };
  }
  function draw() {
    const n = names();
    xml.textContent = `<launch>\n  <node pkg="chiku_py" exec="speed_node"${nm.checked ? ' name="chiku_left"' : ""}${ns.checked ? ' namespace="robot1"' : ""}>\n${pf.checked ? '    <param from="$(find-pkg-share chiku_py)/config/chiku_params.yaml"/>\n' : ""}${rm.checked ? '    <remap from="chatter" to="/announcements"/>\n' : ""}  </node>\n</launch>`;
    const B = box(40, 40, 260, 80, n.full, { cls: "pub", sub: `max_speed = ${n.applied ? "1.0 (from YAML)" : "0.5 (default)"}` });
    S.replaceChildren(B, label(470, 70, "publishes on", "an-lbl"), label(470, 95, n.topic, "an-lbl c"),
      label(320, 170, pf.checked && !n.applied ? `YAML key "${key.value}" does not match ${n.full}, so it is IGNORED` : "", "an-lbl"));
    return B;
  }
  function launch() {
    f.restart(); const B = draw(); pulse(B); const n = names(); f.clearLog();
    f.logLine("[INFO] [launch]: All log files can be found below /home/student/.ros/log/…");
    f.logLine("[INFO] [speed_node-1]: process started with pid [4321]");
    f.logLine("$ ros2 node list"); f.logLine(n.full); f.logLine("$ ros2 topic list | grep -v rosout"); f.logLine(n.topic);
    f.say(n.applied || !pf.checked ? "Relative names (like `chatter`) get the **namespace** in front. Names starting with **/** are absolute and never change." :
      "The params file loaded, but its **first line must match the full node name** (or use `/**:` for every node). Otherwise ROS 2 silently ignores it.", n.applied || !pf.checked ? "ok" : "no");
  }
  [ns, nm, rm, pf, key].forEach((c) => c.addEventListener("change", () => { f.restart(); draw(); f.say("Press **ros2 launch** to start it."); }));
  f.button("ros2 launch", launch, "");
  draw(); f.say("Tick the settings a launch file can add, then press **ros2 launch**. Watch the node and topic names change.");
}
