// Datasheet values for the sensors on the gallery robots, so the simulated sensors (Gazebo plugins) and the
// RViz displays behave like the real hardware. Sources: ROBOTIS e-Manual (LDS-01/02, TurtleBot3 IMU),
// Unitree Go2 / L1 specifications, Livox MID-360 user manual, Intel RealSense D400 datasheet, Kinova Gen3 vision module.
// Simulated images are rendered smaller than the real resolution so they stay fast in a browser; the field of view,
// range, rate and noise match the datasheet. Each preset says what it shortened.

export const SENSOR_PRESETS = {
  "lds-01": {
    kind: "gpu_lidar", label: "ROBOTIS LDS-01 360° laser distance sensor (TurtleBot3 Burger/Waffle)",
    topic: "scan", frame: "base_scan", rate: 5,
    lidar: { hSamples: 360, hMin: 0, hMax: 6.28319, hRes: 1, vSamples: 1, rMin: 0.12, rMax: 3.5, rRes: 0.015, noise: 0.01 },
    rviz: { display: "LaserScan", size: 0.02, style: "Flat Squares", color: "Intensity", reliability: "Best Effort", decay: 0 },
  },
  "lds-02": {
    kind: "gpu_lidar", label: "ROBOTIS LDS-02 (TurtleBot3, 2022 and later)",
    topic: "scan", frame: "base_scan", rate: 5,
    lidar: { hSamples: 360, hMin: 0, hMax: 6.28319, hRes: 1, vSamples: 1, rMin: 0.16, rMax: 8.0, rRes: 0.015, noise: 0.01 },
    rviz: { display: "LaserScan", size: 0.02, style: "Flat Squares", color: "Intensity", reliability: "Best Effort", decay: 0 },
  },
  "unitree-l1": {
    kind: "gpu_lidar", label: "Unitree 4D LiDAR L1 (Go2): 360° × 90°, 21,600 points/s, 11 Hz",
    topic: "utlidar/cloud", frame: "utlidar_lidar", rate: 11, cloud: true,
    lidar: { hSamples: 180, hMin: -3.14159, hMax: 3.14159, hRes: 1, vSamples: 11, vMin: 0, vMax: 1.5708, rMin: 0.05, rMax: 30, rRes: 0.01, noise: 0.02 },
    shortened: "about 1,980 points per frame, like the real 21,600 points/s at 11 Hz",
    rviz: { display: "PointCloud2", size: 0.03, style: "Points", color: "AxisColor", axis: "Z", reliability: "Best Effort", decay: 0 },
  },
  "mid-360": {
    kind: "gpu_lidar", label: "Livox MID-360 (Unitree G1/H1 head): 360° × −7°…52°, 200,000 points/s, 10 Hz",
    topic: "livox/lidar", frame: "livox_frame", rate: 10, cloud: true,
    lidar: { hSamples: 360, hMin: -3.14159, hMax: 3.14159, hRes: 1, vSamples: 24, vMin: -0.12217, vMax: 0.90757, rMin: 0.1, rMax: 40, rRes: 0.01, noise: 0.02 },
    shortened: "8,640 points per frame instead of 20,000 (the real sensor's non-repeating scan is drawn as an even grid)",
    rviz: { display: "PointCloud2", size: 0.03, style: "Points", color: "AxisColor", axis: "Z", reliability: "Best Effort", decay: 0 },
  },
  "d435-depth": {
    kind: "depth_camera", label: "Intel RealSense D435 depth: 87° × 58°, min 0.105 m, up to 10 m",
    topic: "camera/depth/image_rect_raw", frame: "camera_depth_optical_frame", optical: true, rate: 30,
    camera: { hfov: 1.5184, width: 424, height: 240, near: 0.105, far: 10, format: "R_FLOAT32", noise: 0.007 },
    shortened: "424 × 240 instead of 1280 × 720 (same field of view)",
    rviz: { display: "PointCloud2", size: 0.01, style: "Points", color: "AxisColor", axis: "Z", reliability: "Best Effort" },
  },
  "d435-color": {
    kind: "camera", label: "Intel RealSense D435 colour: 69° × 42°, 1920 × 1080 at 30 fps",
    topic: "camera/color/image_raw", frame: "camera_color_optical_frame", optical: true, rate: 30,
    camera: { hfov: 1.2043, width: 640, height: 360, near: 0.1, far: 50, format: "R8G8B8", noise: 0.007 },
    shortened: "640 × 360 instead of 1920 × 1080 (same field of view)",
    rviz: { display: "Image", reliability: "Best Effort" },
  },
  "kinova-color": {
    kind: "camera", label: "Kinova Gen3 vision module colour: 1280 × 720, 60° diagonal",
    topic: "camera/color/image_raw", frame: "camera_color_frame", optical: true, rate: 30,
    camera: { hfov: 0.9320, width: 640, height: 360, near: 0.1, far: 30, format: "R8G8B8", noise: 0.007 },
    shortened: "640 × 360 instead of 1280 × 720",
    rviz: { display: "Image", reliability: "Best Effort" },
  },
  "kinova-depth": {
    kind: "depth_camera", label: "Kinova Gen3 vision module depth: 480 × 270, 72° diagonal, from 0.18 m",
    topic: "camera/depth/image_raw", frame: "camera_depth_frame", optical: true, rate: 30,
    camera: { hfov: 1.1290, width: 480, height: 270, near: 0.18, far: 6, format: "R_FLOAT32", noise: 0.01 },
    rviz: { display: "PointCloud2", size: 0.01, style: "Points", color: "AxisColor", axis: "Z", reliability: "Best Effort" },
  },
  "tb3-imu": {
    kind: "imu", label: "TurtleBot3 OpenCR IMU (gyro + accelerometer)",
    topic: "imu", frame: "imu_link", rate: 200,
    imu: { gyroNoise: 2e-4, gyroBias: 1e-7, accelNoise: 1.7e-2, accelBias: 1e-1 },
    rviz: { display: "Imu", reliability: "Best Effort" },
  },
  "go2-imu": {
    kind: "imu", label: "Unitree Go2 body IMU",
    topic: "imu", frame: "imu", rate: 500,
    imu: { gyroNoise: 3e-4, gyroBias: 1e-6, accelNoise: 2e-2, accelBias: 5e-2 },
    rviz: { display: "Imu", reliability: "Best Effort" },
  },
};

// Which presets each simulated gallery robot carries, and the drive it uses in Gazebo.
//  drive: "ros2_control"  -> diff_drive_controller (TwistStamped on /diff_drive_controller/cmd_vel)
//         "velocity"      -> gz VelocityControl system (Twist on /cmd_vel) for robots whose walking controller is not part of this course
//         "trajectory"    -> joint_trajectory_controller for arms
export const ROBOT_SENSORS = {
  tb3_burger: { sensors: ["lds-01", "tb3-imu"], drive: "ros2_control", wheels: { left: ["wheel_left_joint"], right: ["wheel_right_joint"], separation: 0.160, radius: 0.033, base: "base_footprint", maxV: 0.22, maxW: 2.84 } },
  tb3_waffle: { sensors: ["lds-01", "tb3-imu", "d435-color"], drive: "ros2_control", wheels: { left: ["wheel_left_joint"], right: ["wheel_right_joint"], separation: 0.287, radius: 0.033, base: "base_footprint", maxV: 0.26, maxW: 1.82 } },
  go2: { sensors: ["unitree-l1", "go2-imu"], drive: "velocity", maxV: 1.0, maxW: 1.5, note: "Go2 walks with Unitree's own controller (or CHAMP in the community packages). Here Gazebo's VelocityControl system moves the body so you can drive it with teleop; the legs stay in their standing pose." },
  g1: { sensors: ["mid-360"], drive: "velocity", maxV: 0.5, maxW: 1.0, note: "G1 balances and walks with Unitree's learned controller. Here VelocityControl slides the standing robot so you can test the lidar while driving." },
  h1: { sensors: ["mid-360"], drive: "velocity", maxV: 0.5, maxW: 1.0, note: "H1 walks with Unitree's controller. Here VelocityControl slides the standing robot." },
  gen3: { sensors: ["kinova-color", "kinova-depth"], drive: "trajectory" },
};

// Twist limits a real driver would apply, shown as a hint when teleop asks for more.
export function clampTwist(robotId, v, w) {
  const r = ROBOT_SENSORS[robotId]; if (!r) return { v, w, clamped: false };
  const mv = (r.wheels && r.wheels.maxV) || r.maxV, mw = (r.wheels && r.wheels.maxW) || r.maxW;
  const cv = mv ? Math.max(-mv, Math.min(mv, v)) : v, cw = mw ? Math.max(-mw, Math.min(mw, w)) : w;
  return { v: cv, w: cw, clamped: cv !== v || cw !== w, maxV: mv, maxW: mw };
}

// The <sensor> block a student would write for a preset (Gazebo Harmonic SDF inside <gazebo reference="link">).
export function sensorSdf(id, name = id.replace(/[^a-z0-9]+/gi, "_")) {
  const p = SENSOR_PRESETS[id]; if (!p) return "";
  const L = [`  <sensor name="${name}" type="${p.kind}">`, `    <topic>${p.topic}</topic>`, `    <gz_frame_id>${p.frame}</gz_frame_id>`, `    <update_rate>${p.rate}</update_rate>`, "    <always_on>true</always_on>", "    <visualize>true</visualize>"];
  if (p.lidar) {
    const l = p.lidar;
    L.push("    <lidar>", "      <scan>", `        <horizontal><samples>${l.hSamples}</samples><resolution>${l.hRes}</resolution><min_angle>${l.hMin}</min_angle><max_angle>${l.hMax}</max_angle></horizontal>`);
    if (l.vSamples > 1) L.push(`        <vertical><samples>${l.vSamples}</samples><resolution>1</resolution><min_angle>${l.vMin}</min_angle><max_angle>${l.vMax}</max_angle></vertical>`);
    L.push("      </scan>", `      <range><min>${l.rMin}</min><max>${l.rMax}</max><resolution>${l.rRes}</resolution></range>`, `      <noise><type>gaussian</type><mean>0.0</mean><stddev>${l.noise}</stddev></noise>`, "    </lidar>");
  }
  if (p.camera) {
    const c = p.camera;
    L.push("    <camera>", `      <horizontal_fov>${c.hfov}</horizontal_fov>`, `      <image><width>${c.width}</width><height>${c.height}</height><format>${c.format}</format></image>`, `      <clip><near>${c.near}</near><far>${c.far}</far></clip>`, `      <noise><type>gaussian</type><mean>0.0</mean><stddev>${c.noise}</stddev></noise>`);
    if (p.optical) L.push(`      <optical_frame_id>${p.frame}</optical_frame_id>`);
    L.push("    </camera>");
  }
  if (p.imu) {
    const n = (sd, b) => `<noise type="gaussian"><mean>0.0</mean><stddev>${sd}</stddev><bias_mean>${b}</bias_mean></noise>`;
    L.push("    <imu>", `      <angular_velocity><x>${n(p.imu.gyroNoise, p.imu.gyroBias)}</x><y>${n(p.imu.gyroNoise, p.imu.gyroBias)}</y><z>${n(p.imu.gyroNoise, p.imu.gyroBias)}</z></angular_velocity>`, `      <linear_acceleration><x>${n(p.imu.accelNoise, p.imu.accelBias)}</x><y>${n(p.imu.accelNoise, p.imu.accelBias)}</y><z>${n(p.imu.accelNoise, p.imu.accelBias)}</z></linear_acceleration>`, "    </imu>");
  }
  L.push("  </sensor>");
  return L.join("\n");
}
