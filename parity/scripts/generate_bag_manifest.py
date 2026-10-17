#!/usr/bin/env python3
"""
generate_bag_manifest.py - Rebuild parity/fixtures/bag_manifest.md from the rosbags on disk.

Lists every bag directory under parity/fixtures/**/bags/: size on disk, and from its metadata.yaml the storage id,
duration, message count and topic count. A bag directory without metadata.yaml is listed as not finalized.
Run status comes only from a result file next to the run, never assumed:
  bags/matrix/<pair>/  ->  ../../matrix/<pair>/result.json  ("status")
Every other bag has no linked result here ("-"); see the report that cites it.
Usage: generate_bag_manifest.py
"""
import json
import os
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
FIX = ROOT / "parity" / "fixtures"


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


def linked_status(bag):
    parts = bag.relative_to(FIX).parts
    if "bags" in parts:
        i = parts.index("bags")
        if parts[i + 1:i + 2] == ("matrix",) and len(parts) == i + 3:
            r = FIX.joinpath(*parts[:i], "matrix", parts[i + 2], "result.json")
            if r.exists():
                return json.load(open(r)).get("status", "?"), str(r.relative_to(ROOT))
    return "-", ""


def main():
    rows, total, msgs = [], 0, 0
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
        st, src = linked_status(b)
        rows.append([f"`{b.relative_to(ROOT)}`", f"{size / 2**20:.2f}"] + cols + [st, f"`{src}`" if src else ""])

    out = FIX / "bag_manifest.md"
    with open(out, "w") as f:
        f.write("# Bag manifest\n\n")
        f.write("Rebuilt from the files on disk by `parity/scripts/generate_bag_manifest.py` "
                "(bags are gitignored; this list is tracked). Duration, messages and topics come from each bag's "
                "`metadata.yaml`. Status is copied from the linked result file only; `-` means no result file is "
                "linked to that bag here.\n\n")
        f.write(f"Bags: **{len(rows)}**, total size **{total / 2**20:.2f} MiB** ({total} bytes), "
                f"messages **{msgs}**.\n\n")
        f.write("| Bag | Size (MiB) | Storage | Duration (s) | Messages | Topics | Status | Result file |\n")
        f.write("|---|---|---|---|---|---|---|---|\n")
        for r in rows:
            f.write("| " + " | ".join(r) + " |\n")
    print(f"Wrote {out}: {len(rows)} bags, {total} bytes")


if __name__ == "__main__":
    main()
