#include <cmath>
#include <cstdio>

#include "tf2/LinearMath/Matrix3x3.h"
#include "tf2/LinearMath/Quaternion.h"
#include "tf2/LinearMath/Transform.h"

// Frames maths without a robot, using tf2's math classes.
int main()
{
  tf2::Quaternion q;
  q.setRPY(0.0, 0.0, M_PI / 2);                                // facing +y (90 degrees)
  tf2::Transform world_T_robot(q, tf2::Vector3(2.0, 1.0, 0.0));  // robot at x=2, y=1

  tf2::Vector3 parcel_robot(1.0, 0.0, 0.0);                    // 1 m straight ahead of the robot
  tf2::Vector3 parcel_world = world_T_robot * parcel_robot;    // rotate, then move
  std::printf("parcel in world: (%.2f, %.2f)\n", parcel_world.x(), parcel_world.y());

  tf2::Vector3 back = world_T_robot.inverse() * parcel_world;  // and back again
  std::printf("back in robot frame: (%.2f, %.2f)\n", back.x(), back.y());

  double roll, pitch, yaw;
  tf2::Matrix3x3(q).getRPY(roll, pitch, yaw);
  std::printf("q = (%.3f, %.3f, %.3f, %.3f), yaw = %.3f rad\n", q.x(), q.y(), q.z(), q.w(), yaw);
  return 0;
}
