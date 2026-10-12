#ifndef CHIKU_CONTROL_CPP__CONTROL_MATH_HPP_
#define CHIKU_CONTROL_CPP__CONTROL_MATH_HPP_

#include <algorithm>
#include <cmath>
#include <utility>

namespace chiku_control_cpp
{

// Pure functions: no ROS inside, so they are easy to test with gtest.
inline double wrap_angle(double a)
{
  return std::atan2(std::sin(a), std::cos(a));
}

// Returns {linear, angular} speeds that drive a robot at (x, y, theta) toward the goal.
inline std::pair<double, double> p_control(
  double x, double y, double theta, double goal_x, double goal_y,
  double kv = 1.0, double kw = 4.0, double max_v = 2.0)
{
  double dx = goal_x - x, dy = goal_y - y;
  double distance = std::hypot(dx, dy);
  if (distance < 0.1) {
    return {0.0, 0.0};
  }
  double error = wrap_angle(std::atan2(dy, dx) - theta);
  return {std::min(kv * distance, max_v), kw * error};
}

}  // namespace chiku_control_cpp

#endif  // CHIKU_CONTROL_CPP__CONTROL_MATH_HPP_
