// What Gazebo Harmonic does to a URDF before it simulates it (libsdformat 14, src/parser_urdf.cc), so that the practice
// Gazebo treats a robot exactly like `ros2 run ros_gz_sim create -topic robot_description` does on Ubuntu:
//   1. fixed joints are reduced: a link joined by a fixed joint is lumped into its parent (mass and inertia added,
//      visuals and collisions moved), unless <gazebo reference="joint"><preserveFixedJoint>true</...> keeps it;
//   2. every remaining link needs an <inertial> with a mass > 0 ("world" excepted). A link without one is not modeled
//      in SDF, and nor is anything below it: its parent joint, its child joints and child links are dropped, with
//      sdformat's own warnings (Error Code 19, LINK_INERTIA_INVALID);
//   3. a link with no <collision> takes part in no contact: with no collision anywhere the robot falls through the
//      ground plane, as it does in Gazebo.
// The result is the model Gazebo has (the robot_state_publisher / RViz side keeps the whole URDF).

// sdformat prints the warnings it gathered for one link in one sdfwarn (parser_urdf.cc line 2774: the first line has the
// "Warning [file:line]" prefix, the others follow on their own lines), then "is not modeled in sdf" (line 2777)
const LINE = { batch: 2774, notModeled: 2777 };
const warn = (line, msg) => `Warning [parser_urdf.cc:${line}] ${msg}`;
const err19 = (msg) => `Error Code 19: Msg: ${msg}`;
const LUMP_URL = "http://sdformat.org/tutorials?tut=sdformat_urdf_extensions";

// <gazebo reference="joint"><preserveFixedJoint>true</preserveFixedJoint> or <disableFixedJointLumping>
export function preservedJoints(urdfText) {
  const out = new Set();
  for (const m of String(urdfText || "").matchAll(/<gazebo\s+reference\s*=\s*"([^"]+)"\s*>([\s\S]*?)<\/gazebo>/g)) {
    if (/<(preserveFixedJoint|disableFixedJointLumping)>\s*true\s*</.test(m[2])) out.add(m[1]);
  }
  return out;
}

export function urdfToSdf(model, urdfText) {
  const keep = preservedJoints(urdfText);
  const reduced = (j) => j && j.type === "fixed" && !keep.has(j.name) && j.parent !== "world";
  const parentJoint = {}; for (const j of Object.values(model.joints)) parentJoint[j.child] = j;
  // urdfdom keeps joints in a std::map, so a link's children come in joint-name order
  const kids = (l) => Object.values(model.joints).filter((j) => j.parent === l).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  // 1. lumping: the mass of a link = its own + its fixed-joint descendants'
  const ownMass = (l) => (model.links[l] && model.links[l].inertial ? Number(model.links[l].inertial.mass) : null);
  const lumped = {};
  const lump = (l) => {
    let m = ownMass(l);
    for (const j of kids(l)) { const c = lump(j.child); if (reduced(j) && c !== null) m = (m || 0) + c; }
    lumped[l] = m; return m;
  };
  lump(model.root);
  // 2. CreateSDF: walk the original tree from the root (ReduceJointsToParent re-parents joints but leaves the
  //    child lists alone); a massless link whose parent joint is not reduced stops the walk below it
  const warnings = [], dropped = new Set();
  const dropAll = (l) => { dropped.add(l); for (const j of kids(l)) dropAll(j.child); };
  const walk = (l) => {
    const pj = parentJoint[l], m = lumped[l];
    const parentReduced = pj && pj.type === "fixed" && !keep.has(pj.name);   // FixedJointShouldBeReduced (also below "world")
    if (l !== "world" && (m === null || !(m > 0)) && !parentReduced) {
      const batch = [err19(`urdf2sdf: link[${l}] has ${m === null ? "no <inertial> block defined. " : "a mass value of less than or equal to zero. "}Please ensure this link has a valid mass to prevent any missing links or joints in the resulting SDF model.`)];
      if (pj) {
        if (pj.type === "fixed") batch.push(err19(`urdf2sdf: allowing joint lumping by removing any <disableFixedJointLumping> or <preserveFixedJoint> gazebo tag on fixed parent joint[${pj.name}], as well as ensuring that ParserConfig::URDFPreserveFixedJoint is false, could help resolve this warning. See ${LUMP_URL} for more information about this behavior.`));
        batch.push(err19(`urdf2sdf: parent joint[${pj.name}] ignored.`));
      }
      const cj = kids(l);
      if (cj.length) {
        for (const j of cj) if (j.type === "fixed") batch.push(err19(`urdf2sdf: allowing joint lumping by removing any <disableFixedJointLumping> or <preserveFixedJoint> gazebo tag on fixed child joint[${j.name}], as well as ensuring that ParserConfig::URDFPreserveFixedJoint is false, could help resolve this warning. See ${LUMP_URL} for more information about this behavior.`));
        batch.push(err19(`urdf2sdf: [${cj.length}] child joints ignored.`), err19(`urdf2sdf: [${cj.length}] child links ignored.`));
      }
      warnings.push(warn(LINE.batch, batch[0]), ...batch.slice(1));
      warnings.push(warn(LINE.notModeled, err19(`urdf2sdf: link[${l}] is not modeled in sdf.`)));
      dropAll(l);
      return;
    }
    for (const j of kids(l)) walk(j.child);
  };
  walk(model.root);
  // libsdformat then reads the SDF it made: elements that SDF 1.11 does not define are copied with a warning, such as
  // <gz_frame_id> in a <sensor> (gz-sensors still reads it). Sensors follow their links' <gazebo reference> blocks,
  // which fixed-joint lumping moves into the parent link (children first, in joint-name order).
  const own = {};
  for (const m of String(urdfText || "").matchAll(/<gazebo\s+reference\s*=\s*"([^"]+)"\s*>([\s\S]*?)<\/gazebo>/g)) {
    for (const sm of m[2].matchAll(/<sensor\b[^>]*\bname\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/sensor>/g)) if (/<gz_frame_id>/.test(sm[2])) (own[m[1]] = own[m[1]] || []).push(sm[1]);
  }
  const ext = (l) => [...(own[l] || []), ...kids(l).filter((j) => reduced(j)).flatMap((j) => ext(j.child))];
  const order = [];
  const visit = (l) => { if (dropped.has(l)) return; if (!reduced(parentJoint[l]) && l !== "world") order.push(l); for (const j of kids(l)) visit(j.child); };
  visit(model.root);
  for (const l of order) for (const sn of ext(l)) warnings.push(`Warning [Utils.cc:132] [/sdf/model[@name="${model.name}"]/link[@name="${l}"]/sensor[@name="${sn}"]/gz_frame_id:data-string:L0]: XML Element[gz_frame_id], child of element[sensor], not defined in SDF. Copying[gz_frame_id] as children of [sensor].`);
  // "is not modeled in sdf." ends without a newline, so the next warning goes on the same line (as printed on Ubuntu)
  for (let i = warnings.length - 2; i >= 0; i--) if (/is not modeled in sdf\.$/.test(warnings[i])) warnings.splice(i, 2, warnings[i] + warnings[i + 1]);
  // the model Gazebo simulates: without the dropped links and the joints that lead to them
  const links = {}, joints = {};
  for (const [n, l] of Object.entries(model.links)) if (!dropped.has(n)) links[n] = l;
  for (const [n, j] of Object.entries(model.joints)) if (!dropped.has(j.child) && !dropped.has(j.parent)) joints[n] = j;
  const childJoints = {}; for (const j of Object.values(joints)) (childJoints[j.parent] = childJoints[j.parent] || []).push(j.name);
  const parentOf = {}; for (const j of Object.values(joints)) parentOf[j.child] = j;
  const sdfModel = dropped.has(model.root) ? null : { ...model, links, joints, childJoints, parentOf };
  const collisions = Object.values(links).reduce((n, l) => n + ((l.collisions || []).length), 0);
  const mass = Object.values(links).reduce((a, l) => a + (l.inertial ? Number(l.inertial.mass) || 0 : 0), 0);
  // the links that are SDF <link>s (fixed-joint children are lumped into them, "world" is not a link)
  const sdfLinks = Object.keys(links).filter((n) => n !== "world" && !reduced(parentJoint[n]) && !(parentJoint[n] && parentJoint[n].parent === "world" && parentJoint[n].type === "fixed" && !(lumped[n] > 0)));
  return { model: sdfModel, warnings, dropped, collisions, mass, sdfLinks };
}
