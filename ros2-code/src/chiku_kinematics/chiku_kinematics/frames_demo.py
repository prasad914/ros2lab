"""Frames maths without a robot: rotate, move to the world frame and back, yaw <-> quaternion."""
import math


def rotate(x, y, theta):
    """Rotate the point (x, y) by theta radians around the origin."""
    c, s = math.cos(theta), math.sin(theta)
    return c * x - s * y, s * x + c * y


def robot_to_world(px, py, rx, ry, rtheta):
    """A point seen by the robot -> the same point in the world: rotate, then move."""
    wx, wy = rotate(px, py, rtheta)
    return rx + wx, ry + wy


def world_to_robot(wx, wy, rx, ry, rtheta):
    """The inverse: move back, then rotate by -theta."""
    return rotate(wx - rx, wy - ry, -rtheta)


def main():
    robot = (2.0, 1.0, math.pi / 2)             # x=2, y=1, facing +y (90 degrees)
    parcel_robot = (1.0, 0.0)                   # 1 m straight ahead of the robot
    px, py = robot_to_world(*parcel_robot, *robot)
    print(f'parcel in world: ({px:.2f}, {py:.2f})')
    bx, by = world_to_robot(px, py, *robot)
    print(f'back in robot frame: ({bx:.2f}, {by:.2f})')
    yaw = robot[2]
    qz, qw = math.sin(yaw / 2), math.cos(yaw / 2)
    print(f'q = (0.000, 0.000, {qz:.3f}, {qw:.3f}), yaw = {2 * math.atan2(qz, qw):.3f} rad')


if __name__ == '__main__':
    main()
