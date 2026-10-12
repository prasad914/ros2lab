#!/usr/bin/env python3
"""Builds public/robots/ros-ifaces.json: the real ROS 2 Jazzy interface definitions (.msg/.srv/.action)
from the official repositories, so `ros2 interface show/proto/list` and Tab completion use the real text.
Usage: python3 tools/build-ifaces.py <folder with cloned repos> <out.json>"""
import json, os, re, sys
root, out = sys.argv[1], sys.argv[2]
SKIP = re.compile(r"(^test_|_test$|^rosbag2_test|^test$|^rmw_dds_common$|^rosbag2_storage_mcap_testdata$|^statistics_msgs$|^actionlib_msgs$|^rosbag2_performance_benchmarking_msgs$)")
db = {}
for d, _, files in os.walk(root):
    for f in files:
        m = re.match(r"(.+)\.(msg|srv|action)$", f)
        if not m or os.path.basename(d) != m.group(2): continue
        pkgdir = os.path.dirname(d)
        if not os.path.exists(os.path.join(pkgdir, "package.xml")): continue
        pkg = re.search(r"<name>([^<]+)</name>", open(os.path.join(pkgdir, "package.xml")).read()).group(1).strip()
        if SKIP.search(pkg) or "/test" in d: continue
        db[f"{pkg}/{m.group(2)}/{m.group(1)}"] = open(os.path.join(d, f), encoding="utf-8").read().rstrip("\n")
json.dump(dict(sorted(db.items())), open(out, "w"), separators=(",", ":"))
pk = sorted({k.split("/")[0] for k in db})
print(len(db), "interfaces in", len(pk), "packages:", " ".join(pk))
print(os.path.getsize(out), "bytes")
