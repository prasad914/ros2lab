#!/usr/bin/env python3
"""
generate_bag_manifest.py - Rebuild parity/fixtures/bag_manifest.md from the rosbags on disk.

Lists every bag directory under parity/fixtures/**/bags/: size on disk, and from its metadata.yaml the storage id,
duration, message count and topic count. A bag directory without metadata.yaml is listed as not finalized.

Each bag's status comes only from the result file written by the same run, never assumed:
  <scenario>/bags/matrix/<pair>/       ->  <scenario>/matrix/<pair>/result.json   ("status", "error_code")
  <scenario>/bags/<run>/               ->  <scenario>/runs/<run>.json             (per goal "status")
  <scenario>/<attempt>/bags/<run>/     ->  <scenario>/<attempt>/runs/<run>.json or <scenario>/<attempt>/<run>.json
A bag with no such file shows "no result file".

Bags are split into CURRENT (the evidence the step reports cite) and ARCHIVED / SUPERSEDED attempts:
  - a bag below an attempt folder (<scenario>/<attempt>/bags/...) is ARCHIVED, labelled with the folder name;
  - <scenario>/bags/<pair>/ next to a <scenario>/bags/matrix/<pair>/ is SUPERSEDED by the matrix bag (step E).
"Bag end - result" is the last write of the bag files minus the result file's time ("timestamp" or "end_wall");
a large negative value means the recorder stopped long before the run wrote its result.
Usage: generate_bag_manifest.py
"""
import json
import os
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
FIX = ROOT / "parity" / "fixtures"
GOAL_STATUS = {"4": "SUCCEEDED", "5": "CANCELED", "6": "ABORTED"}  # action_msgs/msg/GoalStatus.msg


def size_of(path):
    return sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(path) for f in fs
               if not os.path.islink(os.path.join(d, f)))


def bag_dirs():
    """Leaf bag directories: a directory under a bags/ directory that holds metadata.yaml or *.mcap / *.db3."""
    out = []
    for d, _, files in os.walk(FIX):
        rel = Path(d).relative_to(FIX)
        if "bags" not in rel.parts or rel.parts[-1] == "bags":
            continue
        if "metadata.yaml" in files or any(f.endswith((".mcap", ".db3")) for f in files):
            out.append(Path(d))
    return sorted(out)


def result_file(bag):
    """(path, kind) of the result file written by the run that recorded this bag, or (None, None)."""
    parts = bag.relative_to(FIX).parts
    i = parts.index("bags")
    base = FIX.joinpath(*parts[:i])
    rest = parts[i + 1:]
    if len(rest) == 2 and rest[0] == "matrix":
        cands = [base / "matrix" / rest[1] / "result.json"]
    elif len(rest) == 1:
        cands = [base / "runs" / f"{rest[0]}.json", base / f"{rest[0]}.json"]
    else:
        cands = []
    for c in cands:
        if c.exists():
            return c, ("matrix" if rest[0] == "matrix" else "runs")
    return None, None


def summarize(res, kind):
    """Status text and result time (epoch s) from a result file."""
    d = json.load(open(res))
    if kind == "matrix":
        st = d.get("status", "?")
        if d.get("error_code") not in (None, 0):
            st += f" {d['error_code']}"
        t = d.get("end_wall")
        return st, datetime.strptime(t, "%Y-%m-%dT%H:%M:%S%z").timestamp() if t else None
    goals = d.get("results", {})
    names = []
    for g, v in goals.items():
        s = str(v.get("status", "?")) if isinstance(v, dict) else str(v)
        names.append(f"{g} {GOAL_STATUS.get(s, s)}" + (f" (status {s})" if s in GOAL_STATUS else ""))
    ok = sum(1 for n in names if " SUCCEEDED" in n)
    if names and ok == len(names):
        st = f"{ok}/{len(names)} goals SUCCEEDED"
    else:
        st = f"{ok}/{len(names)} goals SUCCEEDED: " + ", ".join(names)
    return st, d.get("timestamp")


def category(bag):
    """'current' or a label for an archived / superseded bag."""
    parts = bag.relative_to(FIX).parts
    i = parts.index("bags")
    if i >= 3:  # robot/scenario/<attempt>/bags/...
        return f"ARCHIVED attempt `{parts[i - 1]}`"
    rest = parts[i + 1:]
    if len(rest) == 1 and (FIX.joinpath(*parts[:i + 1]) / "matrix" / rest[0]).is_dir():
        return f"SUPERSEDED by `bags/matrix/{rest[0]}` (earlier P2 matrix run)"
    return "current"


def main():
    current, old, total, msgs = [], [], 0, 0
    for b in bag_dirs():
        size = size_of(b)
        total += size
        meta = b / "metadata.yaml"
        if meta.exists():
            info = yaml.safe_load(open(meta)).get("rosbag2_bagfile_information", {})
            dur = info.get("duration", {}).get("nanoseconds", 0) / 1e9
            n = info.get("message_count", 0)
            msgs += n
            cols = [info.get("storage_identifier", "?"), f"{dur:.2f}", str(n),
                    str(len(info.get("topics_with_message_count", [])))]
        else:
            cols = ["no metadata.yaml (not finalized)", "-", "-", "-"]
        res, kind = result_file(b)
        if res:
            st, t_res = summarize(res, kind)
            t_bag = max(os.path.getmtime(p) for p in b.iterdir() if p.is_file())
            delta = f"{t_bag - t_res:+.0f}" if t_res else "-"
            link = f"`{res.relative_to(ROOT)}`"
        else:
            st, delta, link = "no result file", "-", ""
        row = [f"`{b.relative_to(ROOT)}`", f"{size / 2**20:.2f}"] + cols + [st, link, delta]
        cat = category(b)
        (current if cat == "current" else old).append(row if cat == "current" else row + [cat])

    head = "| Bag | Size (MiB) | Storage | Duration (s) | Messages | Topics | Status | Result file | Bag end - result (s) |"
    out = FIX / "bag_manifest.md"
    with open(out, "w") as f:
        f.write("# Bag manifest\n\n")
        f.write("Rebuilt from the files on disk by `parity/scripts/generate_bag_manifest.py` "
                "(bags are gitignored; this list is tracked). Duration, messages and topics come from each bag's "
                "`metadata.yaml`. Status is copied from the result file written by the same run as the bag "
                "(matrix: `matrix/<pair>/result.json`; nav runs: `runs/<run>.json`), never from a summary or an "
                "older file. \"Bag end - result\" is the last write of the bag files minus the result file's "
                "time; a large negative value means the recorder stopped long before the run wrote its result.\n\n")
        f.write(f"Bags: **{len(current) + len(old)}** ({len(current)} current, {len(old)} archived/superseded), "
                f"total size **{total / 2**20:.2f} MiB** ({total} bytes), messages **{msgs}**.\n\n")
        f.write("## Current evidence\n\nThe bags cited by `parity/reports/matrix.md` (step E), "
                "`parity/reports/nav_robotis_step_d.md` (step D) and the mapping reports.\n\n")
        f.write(head + "\n|---|---|---|---|---|---|---|---|---|\n")
        for r in current:
            f.write("| " + " | ".join(r) + " |\n")
        f.write("\n## Archived and superseded attempts\n\nKept as evidence of earlier attempts; not cited as "
                "current results. Their status is that attempt's own result file, not the current run's.\n\n")
        f.write(head + " Why not current |\n|---|---|---|---|---|---|---|---|---|---|\n")
        for r in old:
            f.write("| " + " | ".join(r) + " |\n")
    print(f"Wrote {out}: {len(current)} current + {len(old)} archived bags, {total} bytes")


if __name__ == "__main__":
    main()
