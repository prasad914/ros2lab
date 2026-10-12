import math

import pytest

from chiku_control.control_math import p_control, wrap_angle


def test_wrap_angle_keeps_small_angles():
    assert wrap_angle(0.5) == pytest.approx(0.5)


def test_wrap_angle_wraps_big_angles():
    assert wrap_angle(3 * math.pi / 2) == pytest.approx(-math.pi / 2)


def test_stops_at_goal():
    assert p_control(5.0, 5.0, 0.0, 5.05, 5.0) == (0.0, 0.0)


def test_goal_straight_ahead_means_no_turning():
    v, w = p_control(0.0, 0.0, 0.0, 1.0, 0.0)
    assert v == pytest.approx(1.0)
    assert w == pytest.approx(0.0)


def test_goal_on_the_left_turns_left():
    v, w = p_control(0.0, 0.0, 0.0, 0.0, 1.0)
    assert w > 0.0


def test_speed_is_limited():
    v, _ = p_control(0.0, 0.0, 0.0, 100.0, 0.0)
    assert v == pytest.approx(2.0)
