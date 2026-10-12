#ifndef CHIKU_KINEMATICS_CPP__KIN_MATH_HPP_
#define CHIKU_KINEMATICS_CPP__KIN_MATH_HPP_

#include <cmath>
#include <optional>
#include <utility>

namespace chiku_kinematics_cpp
{

// ---------- 2-link planar arm ----------
inline std::pair<double, double> fk(double l1, double l2, double q1, double q2)
{
  return {l1 * std::cos(q1) + l2 * std::cos(q1 + q2), l1 * std::sin(q1) + l2 * std::sin(q1 + q2)};
}

// Returns {q1, q2}, or std::nullopt when the point cannot be reached.
inline std::optional<std::pair<double, double>> ik(
  double l1, double l2, double x, double y, bool elbow_up = false)
{
  double c2 = (x * x + y * y - l1 * l1 - l2 * l2) / (2.0 * l1 * l2);   // law of cosines
  if (c2 < -1.0 || c2 > 1.0) {
    return std::nullopt;
  }
  double q2 = std::acos(c2);
  if (elbow_up) {
    q2 = -q2;
  }
  double q1 = std::atan2(y, x) - std::atan2(l2 * std::sin(q2), l1 + l2 * std::cos(q2));
  return std::make_pair(q1, q2);
}

// ---------- differential-drive base ----------
inline std::pair<double, double> wheel_speeds(double v, double w, double r, double sep)
{
  return {(v - w * sep / 2.0) / r, (v + w * sep / 2.0) / r};
}

inline std::pair<double, double> body_twist(double d_left, double d_right, double r, double sep)
{
  double sl = d_left * r, sr = d_right * r;
  return {(sr + sl) / 2.0, (sr - sl) / sep};
}

inline void integrate(double & x, double & y, double & theta, double ds, double dtheta)
{
  double mid = theta + dtheta / 2.0;
  x += ds * std::cos(mid);
  y += ds * std::sin(mid);
  theta = std::atan2(std::sin(theta + dtheta), std::cos(theta + dtheta));
}

inline std::pair<double, double> world_to_base(double px, double py, double bx, double by, double bth)
{
  double dx = px - bx, dy = py - by, c = std::cos(-bth), s = std::sin(-bth);
  return {c * dx - s * dy, s * dx + c * dy};
}

}  // namespace chiku_kinematics_cpp

#endif  // CHIKU_KINEMATICS_CPP__KIN_MATH_HPP_
