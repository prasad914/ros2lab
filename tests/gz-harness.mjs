// A minimal stand-in for the practice ROS graph (ros-graph.js) holding only what the Gazebo methods need, so the
// gz-real-* scenarios can drive gzSim / gzCreate / bridges / gzStep exactly as the coordinator's process adapter will,
// in Node and in Chromium. mods: { gzMethods, rcMethods } (ros-gz.js, ros-control-graph.js).
export function makeGraph(mods, { resolve = null, env = {}, pkgs = ["gz_ros2_control", "controller_manager", "ros_gz_sim", "ros_gz_bridge"] } = {}) {
  const G = {
    nodes: [], notices: [],
    sh: { rosPkgs: new Set(pkgs), wsPkgs: new Map(), node: () => null, abs: (x) => x, viz: null },
    add(kind, name, ns = "", params = {}) { const n = { kind, name, ns: ns ? "/" + String(ns).replace(/^\/+|\/+$/g, "") : "", params: { ...params }, remaps: [] }; n.full = `${n.ns}/${name}`; this.nodes.push(n); return n; },
    node(full) { return this.nodes.find((n) => n.full === full) || null; },
    out: (t) => t, err: (t) => t, hint: (t) => t,
    cmTime() { return this.gz ? this.gz.time : 0; },
    mockModelList() { return []; },
    gzResolve: resolve, gzEnv: env,
  };
  Object.assign(G, mods.gzMethods, mods.rcMethods);
  // a ros_gz_bridge process: parameter_bridge cmd (runtime onProcess info.cmd) -> a bridge node with entries
  G.startBridge = function (cmd, name = "parameter_bridge") {
    const words = cmd.slice(1), ri = words.indexOf("--ros-args");
    const args = ri >= 0 ? words.slice(0, ri) : words, params = {};
    for (let i = ri; ri >= 0 && i < words.length; i++) if (words[i] === "-p") { const [k, v] = String(words[++i]).split(":="); params[k] = v; }
    const n = this.add("gz_bridge", name, "", params);
    const r = this.bridgeEntries(args, params);
    n.bridge = r.entries || []; n.bridgeBad = r.bad || []; n.bridgeLog = r.L || [];
    return { node: n, lines: r.err ? [r.err] : this.bridgeLines(n) };
  };
  G.startRsp = function (urdf) { const n = this.add("rsp", "robot_state_publisher", "", { robot_description: urdf }); return n; };
  return G;
}
// robot_description from a robot_state_publisher process of a captured launch (its --params-file text)
export function rspUrdf(proc) {
  for (const t of Object.values(proc.files || {})) {
    const m = t.match(/robot_description:\s*("(?:[^"\\]|\\[\s\S])*"|'(?:[^']|'')*'|[|>][\s\S]*)/);
    if (!m) continue;
    let v = m[1];
    const fold = (x) => x.replace(/\n[ \t]*\n[ \t]*/g, "\u0000").replace(/\n[ \t]*/g, " ").replace(/\u0000/g, "\n");   // YAML flow-scalar line folding
    if (v.startsWith('"')) {   // YAML double-quoted: escaped line breaks, folding, then the escapes
      const body = fold(v.slice(1, -1).replace(/\\\n[ \t]*/g, ""));
      const E = { n: "\n", t: "\t", r: "\r", "0": "\0", " ": " ", '"': '"', "\\": "\\", "/": "/", e: "\x1b", N: "\x85", _: "\xa0" };
      return body.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (_, c) => (c.length > 1 ? String.fromCodePoint(parseInt(c.slice(1), 16)) : E[c] ?? c));
    }
    if (v.startsWith("'")) return fold(v.slice(1, -1)).replace(/''/g, "'");
  }
  return null;
}
