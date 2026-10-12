import math

import pytest

from goal_pose_gui.geometry import (FollowerGains, follower_command, quaternion_from_rpy, rpy_from_quaternion,
                                    wrap_angle)


@pytest.mark.parametrize('rpy', [(0, 0, 0), (0.3, -0.2, 1.0), (-1.2, 0.5, -2.9), (math.pi / 2 - 0.01, 0.1, 0.2)])
def test_rpy_round_trip(rpy):
    q = quaternion_from_rpy(*rpy)
    assert math.isclose(sum(c * c for c in q), 1.0, rel_tol=1e-12)
    back = rpy_from_quaternion(*q)
    for a, b in zip(rpy, back):
        assert abs(wrap_angle(a - b)) < 1e-9


def test_yaw_quaternion():
    x, y, z, w = quaternion_from_rpy(0, 0, math.pi / 2)
    assert (round(x, 9), round(y, 9)) == (0, 0)
    assert math.isclose(z, math.sqrt(0.5)) and math.isclose(w, math.sqrt(0.5))


def simulate(gains, goal, steps=4000, dt=0.05):
    x = y = z = yaw = 0.0
    aligning = False
    for _ in range(steps):
        vx, vy, vz, wz, aligning, done = follower_command((x, y, z, yaw), goal, gains, aligning)
        if done:
            return (x, y, z, yaw)
        yaw += wz * dt
        x += (vx * math.cos(yaw) - vy * math.sin(yaw)) * dt
        y += (vx * math.sin(yaw) + vy * math.cos(yaw)) * dt
        z += vz * dt
    raise AssertionError('goal not reached')


@pytest.mark.parametrize('goal', [(1.0, 0.5, 0.0, 0.0), (-0.8, 1.2, 0.0, 1.5), (0.2, -0.3, 0.0, -3.0)])
def test_differential_robot_reaches_goal(goal):
    x, y, _, yaw = simulate(FollowerGains(), goal)
    assert math.hypot(goal[0] - x, goal[1] - y) <= 0.08
    assert abs(wrap_angle(goal[3] - yaw)) <= 0.05


def test_holonomic_and_flying():
    g = FollowerGains(max_linear=0.5, holonomic=True, fly=True)
    x, y, z, _ = simulate(g, (1.0, -1.0, 1.2, 0.7))
    assert math.hypot(1.0 - x, -1.0 - y) <= 0.08 and abs(z - 1.2) <= 0.05


def test_speed_limits():
    g = FollowerGains(max_linear=0.22, max_angular=1.5)
    vx, vy, vz, wz, _, _ = follower_command((0, 0, 0, 0), (10, 0, 0, 0), g)
    assert vx <= 0.22 + 1e-9 and abs(wz) <= 1.5 and vy == 0 and vz == 0


def test_car_rolls_while_it_steers_and_ignores_goal_yaw():
    g = FollowerGains(max_linear=0.6, max_angular=0.8, car=True, min_radius=0.6)
    pose = [0.0, 0.0, 0.0, 0.0]
    for _ in range(4000):   # a goal to the side: a car has to drive an arc to get there
        vx, vy, vz, wz, _, done = follower_command(tuple(pose), (0.0, 1.5, 0.0, 0.0), g)
        if done:
            break
        assert vx != 0.0                       # never turns on the spot
        assert abs(wz) <= abs(vx) / 0.6 + 1e-9  # never tighter than its turning radius
        pose[2] = 0.0
        pose[3] += wz * 0.02
        pose[0] += vx * math.cos(pose[3]) * 0.02
        pose[1] += vx * math.sin(pose[3]) * 0.02
    assert done
