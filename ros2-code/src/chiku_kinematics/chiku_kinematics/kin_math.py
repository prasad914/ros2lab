"""Kinematics maths for Chiku. Pure Python: no ROS here, so it is easy to test."""
import math


# ---------- 2-link planar arm ----------
def fk(l1, l2, q1, q2):
    """Forward kinematics: joint angles (rad) -> tip position (x, y) in metres."""
    x = l1 * math.cos(q1) + l2 * math.cos(q1 + q2)
    y = l1 * math.sin(q1) + l2 * math.sin(q1 + q2)
    return x, y


def ik(l1, l2, x, y, elbow_up=False):
    """Inverse kinematics: tip position -> (q1, q2), or None if the point cannot be reached."""
    c2 = (x * x + y * y - l1 * l1 - l2 * l2) / (2.0 * l1 * l2)    # law of cosines
    if c2 < -1.0 or c2 > 1.0:
        return None                                            # too far, or too close
    q2 = math.acos(c2)
    if elbow_up:
        q2 = -q2                                               # the mirror solution
    q1 = math.atan2(y, x) - math.atan2(l2 * math.sin(q2), l1 + l2 * math.cos(q2))
    return q1, q2


# ---------- differential-drive base ----------
def wheel_speeds(v, w, wheel_radius, wheel_separation):
    """Inverse kinematics of the base: body speed (v m/s, w rad/s) -> wheel speeds (rad/s)."""
    left = (v - w * wheel_separation / 2.0) / wheel_radius
    right = (v + w * wheel_separation / 2.0) / wheel_radius
    return left, right


def body_twist(d_left, d_right, wheel_radius, wheel_separation):
    """Forward kinematics of the base: wheel turns (rad) -> distance (m) and turn (rad)."""
    s_left, s_right = d_left * wheel_radius, d_right * wheel_radius
    return (s_right + s_left) / 2.0, (s_right - s_left) / wheel_separation


def integrate(x, y, theta, ds, dtheta):
    """Add one small step to the pose (midpoint rule: use the heading halfway through the turn)."""
    mid = theta + dtheta / 2.0
    x += ds * math.cos(mid)
    y += ds * math.sin(mid)
    theta = math.atan2(math.sin(theta + dtheta), math.cos(theta + dtheta))
    return x, y, theta


def yaw_to_quaternion(yaw):
    return 0.0, 0.0, math.sin(yaw / 2.0), math.cos(yaw / 2.0)


def quaternion_to_yaw(z, w):
    return 2.0 * math.atan2(z, w)


# ---------- frames ----------
def world_to_base(px, py, bx, by, btheta):
    """A point in the odom/world frame -> the same point seen from the robot (base_link)."""
    dx, dy = px - bx, py - by
    c, s = math.cos(-btheta), math.sin(-btheta)
    return c * dx - s * dy, s * dx + c * dy
