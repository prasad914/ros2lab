"""Pure math used by the goal window and the pose follower (no ROS imports, so it is easy to test)."""
import math


def quaternion_from_rpy(roll, pitch, yaw):
    """Roll, pitch, yaw (rad, fixed axes X, Y, Z) -> quaternion (x, y, z, w), like tf_transformations."""
    cr, sr = math.cos(roll / 2), math.sin(roll / 2)
    cp, sp = math.cos(pitch / 2), math.sin(pitch / 2)
    cy, sy = math.cos(yaw / 2), math.sin(yaw / 2)
    return (sr * cp * cy - cr * sp * sy,
            cr * sp * cy + sr * cp * sy,
            cr * cp * sy - sr * sp * cy,
            cr * cp * cy + sr * sp * sy)


def rpy_from_quaternion(x, y, z, w):
    """Quaternion -> (roll, pitch, yaw) in rad."""
    roll = math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))
    s = 2 * (w * y - z * x)
    pitch = math.copysign(math.pi / 2, s) if abs(s) >= 1 else math.asin(s)
    yaw = math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
    return roll, pitch, yaw


def wrap_angle(a):
    """Angle -> (-pi, pi]."""
    return math.atan2(math.sin(a), math.cos(a))


def clamp(v, limit):
    return max(-limit, min(limit, v))


class FollowerGains:
    """The pose follower's parameters (same names as config/pose_follower.yaml)."""

    def __init__(self, max_linear=0.22, max_angular=1.5, xy_tolerance=0.05, yaw_tolerance=0.05,
                 k_linear=0.8, k_angular=2.0, holonomic=False, fly=False, car=False, min_radius=0.6):
        self.max_linear = max_linear
        self.max_angular = max_angular
        self.xy_tolerance = xy_tolerance
        self.yaw_tolerance = yaw_tolerance
        self.k_linear = k_linear
        self.k_angular = k_angular
        self.holonomic = holonomic
        self.fly = fly
        self.car = car                  # car-like (Ackermann): cannot turn on the spot
        self.min_radius = min_radius    # m: the car's smallest turning radius


def follower_command(pose, goal, gains, aligning=False):
    """One step of the pose follower.

    pose, goal: (x, y, z, yaw) in the same frame (odom).
    Returns (vx, vy, vz, wz, aligning, done): a body-frame velocity, whether the robot is now only turning
    to the goal yaw, and whether the goal is reached.
    Differential robots turn towards the goal first, then drive while correcting the heading; holonomic robots
    (mecanum, legged, flying) move straight to it and turn on the way. A car always rolls while it steers (forwards
    or, for a goal behind it, backwards), its turn rate limited by its smallest turning radius; it reaches the goal
    position, and the goal yaw is not enforced (a car cannot turn on the spot).
    """
    x, y, z, yaw = pose
    gx, gy, gz, gyaw = goal
    dx, dy = gx - x, gy - y
    dist = math.hypot(dx, dy)
    dz = (gz - z) if gains.fly else 0.0
    vx = vy = vz = wz = 0.0
    if gains.car:
        if dist > gains.xy_tolerance:
            heading = wrap_angle(math.atan2(dy, dx) - yaw)
            direction = -1.0 if abs(heading) > math.pi / 2 else 1.0
            err = wrap_angle(heading + math.pi) if direction < 0 else heading
            speed = max(0.3 * gains.max_linear, min(gains.max_linear, gains.k_linear * dist))
            vx = direction * speed
            wz = clamp(gains.k_angular * err, min(gains.max_angular, speed / gains.min_radius))
        done = dist <= gains.xy_tolerance * 1.5
        return (0.0, 0.0, 0.0, 0.0, False, True) if done else (vx, 0.0, 0.0, wz, False, False)
    if dist > gains.xy_tolerance and not aligning:
        if gains.holonomic:
            c, s = math.cos(-yaw), math.sin(-yaw)
            bx, by = c * dx - s * dy, s * dx + c * dy
            k = min(1.0, gains.k_linear * dist / gains.max_linear)
            vx = bx / dist * gains.max_linear * k
            vy = by / dist * gains.max_linear * k
            wz = clamp(gains.k_angular * wrap_angle(gyaw - yaw), gains.max_angular)
        else:
            heading = wrap_angle(math.atan2(dy, dx) - yaw)
            backwards = abs(heading) > 2.4 and dist < 0.4
            err = wrap_angle(heading + math.pi) if backwards else heading
            wz = clamp(gains.k_angular * err, gains.max_angular)
            if abs(err) <= 0.5:
                vx = clamp(gains.k_linear * dist, gains.max_linear) * math.cos(err) * (-1.0 if backwards else 1.0)
    else:
        aligning = True
        eyaw = wrap_angle(gyaw - yaw)
        if abs(eyaw) > gains.yaw_tolerance:
            wz = clamp(gains.k_angular * eyaw, gains.max_angular)
        if dist > gains.xy_tolerance * 3:
            aligning = False
    if gains.fly and abs(dz) > 0.03:
        vz = clamp(gains.k_linear * dz, gains.max_linear)
    done = (dist <= gains.xy_tolerance * 1.5 and abs(wrap_angle(gyaw - yaw)) <= gains.yaw_tolerance
            and (not gains.fly or abs(dz) <= 0.04))
    if done:
        vx = vy = vz = wz = 0.0
    return vx, vy, vz, wz, aligning, done
