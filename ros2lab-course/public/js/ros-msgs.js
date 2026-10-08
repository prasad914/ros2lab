// Real ROS 2 messages (as rosbridge sends them: JSON, uint8[] arrays as base64) -> the data RViz displays use.
// PointCloud2 is decoded with its fields (x, y, z, rgb / intensity), Image with its encoding (rgb8, bgr8, rgba8,
// bgra8, mono8, mono16, 16UC1, 32FC1), so a robot on Ubuntu shows the same in this RViz as in rviz2.
const b64 = (s) => { if (Array.isArray(s)) return Uint8Array.from(s); const bin = atob(s || ""); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const frameOf = (m) => String((m.header && m.header.frame_id) || "").replace(/^\//, "");
const yawOf = (q) => Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));

export const LIVE_TYPES = ["sensor_msgs/msg/LaserScan", "sensor_msgs/msg/PointCloud2", "sensor_msgs/msg/Image", "sensor_msgs/msg/CameraInfo", "sensor_msgs/msg/Imu", "nav_msgs/msg/Odometry", "nav_msgs/msg/Path", "nav_msgs/msg/OccupancyGrid"];
export const THROTTLE = { "sensor_msgs/msg/Image": 150, "sensor_msgs/msg/PointCloud2": 200, "nav_msgs/msg/OccupancyGrid": 2000, "sensor_msgs/msg/LaserScan": 100 };

export function convert(type, m) {
  switch (type) {
    case "sensor_msgs/msg/LaserScan": return { frame: frameOf(m), angle_min: m.angle_min, angle_increment: m.angle_increment, range_min: m.range_min, range_max: m.range_max, ranges: (m.ranges || []).map((r) => (r === null ? Infinity : r)), intensities: m.intensities && m.intensities.length ? m.intensities : null };
    case "sensor_msgs/msg/PointCloud2": return cloud(m);
    case "sensor_msgs/msg/Image": return image(m);
    case "sensor_msgs/msg/CameraInfo": return { frame: frameOf(m), width: m.width, height: m.height, K: m.k || m.K };
    case "sensor_msgs/msg/Imu": { const o = m.orientation, a = m.angular_velocity, l = m.linear_acceleration; return { frame: frameOf(m), orientation: [o.x, o.y, o.z, o.w], angular_velocity: [a.x, a.y, a.z], linear_acceleration: [l.x, l.y, l.z] }; }
    case "nav_msgs/msg/Odometry": { const p = m.pose.pose.position, q = m.pose.pose.orientation; return { frame: frameOf(m), pose: [p.x, p.y, yawOf(q)] }; }
    case "nav_msgs/msg/Path": return { frame: frameOf(m), points: (m.poses || []).map((ps) => [ps.pose.position.x, ps.pose.position.y, ps.pose.position.z]) };
    case "nav_msgs/msg/OccupancyGrid": return { frame: frameOf(m), width: m.info.width, height: m.info.height, resolution: m.info.resolution, origin: [m.info.origin.position.x, m.info.origin.position.y], data: m.data };
    default: return null;
  }
}
function cloud(m) {
  const u = b64(m.data), dv = new DataView(u.buffer), le = !m.is_bigendian, F = {};
  for (const f of m.fields || []) F[f.name] = f;
  const rd = (f, off) => { switch (f.datatype) { case 1: return dv.getInt8(off); case 2: return dv.getUint8(off); case 3: return dv.getInt16(off, le); case 4: return dv.getUint16(off, le); case 5: return dv.getInt32(off, le); case 6: return dv.getUint32(off, le); case 7: return dv.getFloat32(off, le); case 8: return dv.getFloat64(off, le); default: return 0; } };
  const n = (m.width || 0) * (m.height || 1), step = m.point_step, every = Math.max(1, Math.ceil(n / 60000));   // at most 60k points in the browser
  const points = [], colors = F.rgb || F.rgba ? [] : null, intens = F.intensity ? [] : null;
  if (!F.x || !F.y || !F.z) return { frame: frameOf(m), points };
  for (let i = 0; i < n; i += every) {
    const o = i * step; if (o + step > u.length) break;
    const x = rd(F.x, o + F.x.offset), y = rd(F.y, o + F.y.offset), z = rd(F.z, o + F.z.offset);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    points.push([x, y, z]);
    if (colors) { const c = F.rgb || F.rgba, b = o + c.offset; colors.push([u[b + 2] / 255, u[b + 1] / 255, u[b] / 255]); }   // packed as 0x00RRGGBB (little-endian B, G, R)
    if (intens) intens.push(rd(F.intensity, o + F.intensity.offset));
  }
  return { frame: frameOf(m), points, colors, intensities: intens };
}
function image(m) {
  const u = b64(m.data), W = m.width, H = m.height, enc = String(m.encoding || "").toLowerCase(), le = !m.is_bigendian;
  const frame = frameOf(m);
  if (enc === "32fc1" || enc === "16uc1" || enc === "mono16") {   // depth: values to normalise in the display
    const dv = new DataView(u.buffer), depth = new Array(W * H), f32 = enc === "32fc1";
    for (let i = 0; i < W * H; i++) { const off = Math.floor(i / W) * m.step + (i % W) * (f32 ? 4 : 2); if (off + (f32 ? 4 : 2) > u.length) { depth[i] = Infinity; continue; } depth[i] = f32 ? dv.getFloat32(off, le) : dv.getUint16(off, le) / (enc === "16uc1" ? 1000 : 1); }
    return { frame, depth, depthW: W, depthH: H };
  }
  if (typeof document === "undefined") return { frame };
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d"), img = ctx.createImageData(W, H), d = img.data;
  const ch = { rgb8: 3, bgr8: 3, rgba8: 4, bgra8: 4, mono8: 1, "8uc1": 1, "8uc3": 3 }[enc] || 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = y * m.step + x * ch, k = (y * W + x) * 4;
    if (ch === 1) { d[k] = d[k + 1] = d[k + 2] = u[s]; }
    else if (enc.startsWith("bgr")) { d[k] = u[s + 2]; d[k + 1] = u[s + 1]; d[k + 2] = u[s]; }
    else { d[k] = u[s]; d[k + 1] = u[s + 1]; d[k + 2] = u[s + 2]; }
    d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { frame, canvas: c };
}
