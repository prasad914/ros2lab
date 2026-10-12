import math

import pytest

from chiku_kinematics.kin_math import (body_twist, fk, ik, integrate, quaternion_to_yaw,
                                        wheel_speeds, world_to_base, yaw_to_quaternion)

L1, L2 = 1.0, 0.8


@pytest.mark.parametrize('x,y', [(1.2, 0.5), (0.3, 1.1), (-0.9, 0.9), (1.79, 0.0)])
@pytest.mark.parametrize('up', [False, True])
def test_ik_then_fk_gives_the_target_back(x, y, up):
    q = ik(L1, L2, x, y, up)
    assert q is not None
    assert fk(L1, L2, *q) == pytest.approx((x, y), abs=1e-9)


def test_unreachable_points():
    assert ik(L1, L2, 3.0, 0.0) is None      # too far
    assert ik(L1, L2, 0.1, 0.0) is None      # too close (inside |l1 - l2|)


def test_wheels_round_trip():
    left, right = wheel_speeds(0.4, 1.0, 0.05, 0.3)
    ds, dth = body_twist(left, right, 0.05, 0.3)     # 1 second of turning at those speeds
    assert (ds, dth) == pytest.approx((0.4, 1.0))


def test_straight_line():
    assert integrate(0.0, 0.0, 0.0, 1.0, 0.0) == pytest.approx((1.0, 0.0, 0.0))


def test_quaternion_round_trip():
    _, _, z, w = yaw_to_quaternion(2.0)
    assert quaternion_to_yaw(z, w) == pytest.approx(2.0)


def test_point_in_front_of_a_turned_robot():
    # robot at (1, 1) facing +y: the point (1, 3) is 2 m straight ahead
    assert world_to_base(1.0, 3.0, 1.0, 1.0, math.pi / 2) == pytest.approx((2.0, 0.0))
