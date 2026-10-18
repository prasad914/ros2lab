# /scan data in this folder is NOT valid lidar data

Written 2026-10-18 (overnight run B3). The captured files are not edited; this note only marks them.

This capture ran the TurtleBot 4 simulation headless with Gazebo rendering through EGL. Under EGL on this machine the
TurtleBot 4 gpu_lidar returns every range equal to `range_min` (0.164 m), so /scan carries no obstacle information.

Evidence:
- `parity/fixtures/tb4/p2c_nav/run1/session.txt` lines 16-20: `frame_check` reports "0 valid ranges" for every scan;
  line 22 "scan ranges=0"; line 51 "lidar ranges all 0.164 = range_min under EGL".
- `parity/reports/OVERNIGHT_ROBOTS.md` (P2c tb4 navigation section, "Cause found"): an rclpy probe during run 1 counted 640/640 ranges
  equal to range_min under EGL. That probe output was not saved as a file (UNVERIFIED from files beyond the lines above).
- Contrast: `parity/fixtures/tb4/p2c_scan_xvfb/scan_probe.txt` – the same lidar with the GUI launch under xvfb-run
  gives 440 of 640 finite ranges, min 1.337 m, max 11.988 m (at real_time_factor about 0.0049).

Use of this folder: topic names, types, QoS, frames, TF, parameters, `scan_meta.yaml` fields (angles, range limits)
are not affected by the rendering bug and stay usable. Do NOT use any /scan range values, SLAM or navigation results
derived from them as ground truth.
