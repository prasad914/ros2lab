// A small YAML reader for .rviz config files (what yaml-cpp writes for RViz: block maps and sequences, plain or
// quoted scalars, keys with spaces such as "Filter (whitelist)"). Keys may come in any order, as in real files.
export function parseRvizYaml(text) {
  const L = String(text || "").split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l)).map((l) => ({ ind: l.match(/^ */)[0].length, t: l.trim() }));
  let i = 0;
  const scalar = (s) => {
    s = s.trim();
    if (s === "~" || s === "null" || s === "") return s === "" ? "" : null;
    if (/^".*"$/.test(s)) return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (/^'.*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
    if (s === "true") return true;
    if (s === "false") return false;
    if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return Number(s);
    return s;
  };
  const isItem = (t) => t === "-" || t.startsWith("- ");
  function block(ind) {
    if (i >= L.length) return null;
    if (isItem(L[i].t)) {
      const arr = [];
      while (i < L.length && L[i].ind === ind && isItem(L[i].t)) {
        const rest = L[i].t.slice(1).trim();
        if (!rest) { i++; arr.push(i < L.length && L[i].ind > ind ? block(L[i].ind) : null); continue; }
        if (/^(?:"[^"]*"|[^"'\s][^:]*):(\s|$)/.test(rest)) { const itemInd = ind + (L[i].t.length - rest.length); L[i] = { ind: itemInd, t: rest }; arr.push(map(itemInd)); }
        else { arr.push(scalar(rest)); i++; }
      }
      return arr;
    }
    return map(ind);
  }
  function map(ind) {
    const o = {};
    while (i < L.length && L[i].ind === ind && !isItem(L[i].t)) {
      const m = L[i].t.match(/^("[^"]*"|[^:]+?):(?:\s+(.*))?$/);
      i++;
      if (!m) continue;
      const k = m[1].replace(/^"|"$/g, "");
      if (m[2] !== undefined && m[2] !== "") o[k] = scalar(m[2]);
      else if (i < L.length && (L[i].ind > ind || (L[i].ind === ind && isItem(L[i].t)))) o[k] = block(L[i].ind);
      else o[k] = null;
    }
    return o;
  }
  try { return L.length ? block(L[0].ind) : {}; } catch { return {}; }
}

// The display list of a .rviz file, flattened (displays inside a Group come after the group): [{ cls, item }]
export function rvizDisplays(cfg) {
  const out = [];
  const walk = (list) => { for (const d of Array.isArray(list) ? list : []) { if (!d || typeof d !== "object") continue; out.push({ cls: String(d.Class || ""), item: d }); if (Array.isArray(d.Displays)) walk(d.Displays); } };
  walk(cfg && cfg["Visualization Manager"] && cfg["Visualization Manager"].Displays);
  return out;
}
