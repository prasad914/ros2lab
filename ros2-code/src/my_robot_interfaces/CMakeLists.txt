cmake_minimum_required(VERSION 3.8)
project(my_robot_interfaces)

find_package(ament_cmake REQUIRED)
find_package(rosidl_default_generators REQUIRED)

rosidl_generate_interfaces(${PROJECT_NAME}
  "msg/BatteryStatus.msg"
  "msg/RobotStatus.msg"
  "srv/SetSpeed.srv"
  "srv/GoTo.srv"
  "action/Countdown.action"
  "action/DriveDistance.action"
)

ament_package()
