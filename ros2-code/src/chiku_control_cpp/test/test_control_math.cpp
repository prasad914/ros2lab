#include <cmath>

#include "gtest/gtest.h"
#include "chiku_control_cpp/control_math.hpp"

using chiku_control_cpp::p_control;
using chiku_control_cpp::wrap_angle;

TEST(ControlMath, WrapKeepsSmallAngles)
{
  EXPECT_NEAR(wrap_angle(0.5), 0.5, 1e-9);
}

TEST(ControlMath, WrapWrapsBigAngles)
{
  EXPECT_NEAR(wrap_angle(3 * M_PI / 2), -M_PI / 2, 1e-9);
}

TEST(ControlMath, StopsAtGoal)
{
  auto [v, w] = p_control(5.0, 5.0, 0.0, 5.05, 5.0);
  EXPECT_DOUBLE_EQ(v, 0.0);
  EXPECT_DOUBLE_EQ(w, 0.0);
}

TEST(ControlMath, GoalOnTheLeftTurnsLeft)
{
  auto [v, w] = p_control(0.0, 0.0, 0.0, 0.0, 1.0);
  EXPECT_GT(w, 0.0);
}

TEST(ControlMath, SpeedIsLimited)
{
  auto [v, w] = p_control(0.0, 0.0, 0.0, 100.0, 0.0);
  EXPECT_NEAR(v, 2.0, 1e-9);
  EXPECT_NEAR(w, 0.0, 1e-9);
}
