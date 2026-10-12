cmake_minimum_required(VERSION 3.8)
project(chiku_kinematics_cpp)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# 1. find every package the code #includes
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(my_robot_interfaces REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(tf2 REQUIRED)
find_package(tf2_ros REQUIRED)

include_directories(include)

# 2. one executable per node: build it, link it, install it
add_executable(fk_node src/fk_node.cpp)
target_link_libraries(fk_node rclcpp::rclcpp ${geometry_msgs_TARGETS} ${sensor_msgs_TARGETS})
install(TARGETS fk_node DESTINATION lib/${PROJECT_NAME})

add_executable(ik_node src/ik_node.cpp)
target_link_libraries(ik_node rclcpp::rclcpp ${geometry_msgs_TARGETS} ${sensor_msgs_TARGETS})
install(TARGETS ik_node DESTINATION lib/${PROJECT_NAME})

add_executable(move_arm_server src/move_arm_server.cpp)
target_link_libraries(move_arm_server rclcpp::rclcpp ${sensor_msgs_TARGETS} ${my_robot_interfaces_TARGETS})
install(TARGETS move_arm_server DESTINATION lib/${PROJECT_NAME})

add_executable(arm_cli src/arm_cli.cpp)
target_link_libraries(arm_cli rclcpp::rclcpp ${my_robot_interfaces_TARGETS})
install(TARGETS arm_cli DESTINATION lib/${PROJECT_NAME})

add_executable(trajectory_node src/trajectory_node.cpp)
target_link_libraries(trajectory_node rclcpp::rclcpp ${geometry_msgs_TARGETS} ${sensor_msgs_TARGETS})
install(TARGETS trajectory_node DESTINATION lib/${PROJECT_NAME})

add_executable(diff_drive_controller src/diff_drive_controller.cpp)
target_link_libraries(diff_drive_controller rclcpp::rclcpp ${geometry_msgs_TARGETS} ${sensor_msgs_TARGETS})
install(TARGETS diff_drive_controller DESTINATION lib/${PROJECT_NAME})

add_executable(wheel_odometry src/wheel_odometry.cpp)
target_link_libraries(wheel_odometry rclcpp::rclcpp ${geometry_msgs_TARGETS} ${sensor_msgs_TARGETS} ${nav_msgs_TARGETS} tf2::tf2 tf2_ros::tf2_ros)
install(TARGETS wheel_odometry DESTINATION lib/${PROJECT_NAME})

add_executable(mm_planner src/mm_planner.cpp)
target_link_libraries(mm_planner rclcpp::rclcpp ${geometry_msgs_TARGETS} ${nav_msgs_TARGETS})
install(TARGETS mm_planner DESTINATION lib/${PROJECT_NAME})

# a plain program (no node) that uses tf2's math classes
add_executable(frames_demo src/frames_demo.cpp)
target_link_libraries(frames_demo tf2::tf2)
install(TARGETS frames_demo DESTINATION lib/${PROJECT_NAME})

if(BUILD_TESTING)
  find_package(ament_cmake_gtest REQUIRED)
  ament_add_gtest(test_kin_math test/test_kin_math.cpp)
endif()

ament_package()
