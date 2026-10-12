#include <cmath>

#include "gtest/gtest.h"
#include "chiku_kinematics_cpp/kin_math.hpp"

using namespace chiku_kinematics_cpp;

TEST(KinMath, IkThenFkGivesTheTargetBack)
{
  for (bool up : {false, true}) {
    auto q = ik(1.0, 0.8, 1.2, 0.5, up);
    ASSERT_TRUE(q.has_value());
    auto [x, y] = fk(1.0, 0.8, q->first, q->second);
    EXPECT_NEAR(x, 1.2, 1e-9);
    EXPECT_NEAR(y, 0.5, 1e-9);
  }
}

TEST(KinMath, UnreachablePoints)
{
  EXPECT_FALSE(ik(1.0, 0.8, 3.0, 0.0).has_value());
  EXPECT_FALSE(ik(1.0, 0.8, 0.1, 0.0).has_value());
}

TEST(KinMath, WheelsRoundTrip)
{
  auto [l, r] = wheel_speeds(0.4, 1.0, 0.05, 0.3);
  auto [ds, dth] = body_twist(l, r, 0.05, 0.3);
  EXPECT_NEAR(ds, 0.4, 1e-9);
  EXPECT_NEAR(dth, 1.0, 1e-9);
}

TEST(KinMath, PointInFrontOfATurnedRobot)
{
  auto [x, y] = world_to_base(1.0, 3.0, 1.0, 1.0, M_PI / 2);
  EXPECT_NEAR(x, 2.0, 1e-9);
  EXPECT_NEAR(y, 0.0, 1e-9);
}
