"""Pure functions: no ROS inside, so they are easy to test with pytest."""
import math


def wrap_angle(a):
    """Bring any angle into the range -pi..pi."""
    return math.atan2(math.sin(a), math.cos(a))


def p_control(x, y, theta, goal_x, goal_y, kv=1.0, kw=4.0, max_v=2.0):
    """Return (linear, angular) speeds that drive a robot at (x, y, theta) toward the goal."""
    dx, dy = goal_x - x, goal_y - y
    distance = math.hypot(dx, dy)
    if distance < 0.1:
        return 0.0, 0.0
    error = wrap_angle(math.atan2(dy, dx) - theta)
    return min(kv * distance, max_v), kw * error
