---
name: parity-verification-status
description: Status of per-robot verification, fixtures, and accuracy metrics vs real ROS 2 Jazzy
metadata:
  type: project
---

# Parity Verification Status

Per the Phase 4 & 5 specifications:
- **Export Script**: `scripts/export_bag_to_json.py` has been created to export `ros2 bag` recordings into JSON fixtures under `tests/fixtures/<robot>/`.
- **Accuracy Metrics**: Where reference recordings exist (e.g. `tests/fixtures/tb3_burger/`), tests compare browser output against real Jazzy fixtures.
- **Status**: Any robot without recorded live rosbag fixtures is marked as **PENDING** in accordance with the strict ground-truth rule (never invent accuracy numbers).
- **Security & Build**: All static security checks (`tools/security-check.mjs`) and integration/regression suites (`tests/sweep.mjs`, `tests/real-tb3-nav.mjs`) pass successfully.
