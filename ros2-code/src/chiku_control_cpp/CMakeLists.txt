cmake_minimum_required(VERSION 3.8)
project(chiku_control_cpp)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# 1. find every package the code #includes
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(turtlesim REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(my_robot_interfaces REQUIRED)
find_package(std_srvs REQUIRED)
find_package(rclcpp_action REQUIRED)
find_package(rcl_interfaces REQUIRED)
find_package(tf2 REQUIRED)
find_package(tf2_ros REQUIRED)
find_package(rclcpp_lifecycle REQUIRED)

include_directories(include)

# 2. one executable per node: build it, link it, install it
add_executable(hello_node src/hello_node.cpp)
target_link_libraries(hello_node rclcpp::rclcpp)
install(TARGETS hello_node DESTINATION lib/${PROJECT_NAME})

add_executable(heartbeat src/heartbeat.cpp)
target_link_libraries(heartbeat rclcpp::rclcpp)
install(TARGETS heartbeat DESTINATION lib/${PROJECT_NAME})

add_executable(log_demo src/log_demo.cpp)
target_link_libraries(log_demo rclcpp::rclcpp)
install(TARGETS log_demo DESTINATION lib/${PROJECT_NAME})

add_executable(circle_driver src/circle_driver.cpp)
target_link_libraries(circle_driver rclcpp::rclcpp ${geometry_msgs_TARGETS})
install(TARGETS circle_driver DESTINATION lib/${PROJECT_NAME})

add_executable(square_driver src/square_driver.cpp)
target_link_libraries(square_driver rclcpp::rclcpp ${geometry_msgs_TARGETS})
install(TARGETS square_driver DESTINATION lib/${PROJECT_NAME})

add_executable(pose_monitor src/pose_monitor.cpp)
target_link_libraries(pose_monitor rclcpp::rclcpp ${turtlesim_TARGETS})
install(TARGETS pose_monitor DESTINATION lib/${PROJECT_NAME})

add_executable(go_to_goal src/go_to_goal.cpp)
target_link_libraries(go_to_goal rclcpp::rclcpp ${geometry_msgs_TARGETS} ${turtlesim_TARGETS})
install(TARGETS go_to_goal DESTINATION lib/${PROJECT_NAME})

add_executable(safety_filter src/safety_filter.cpp)
target_link_libraries(safety_filter rclcpp::rclcpp ${geometry_msgs_TARGETS} ${turtlesim_TARGETS})
install(TARGETS safety_filter DESTINATION lib/${PROJECT_NAME})

add_executable(head_joints src/head_joints.cpp)
target_link_libraries(head_joints rclcpp::rclcpp ${sensor_msgs_TARGETS})
install(TARGETS head_joints DESTINATION lib/${PROJECT_NAME})

add_executable(latched_status src/latched_status.cpp)
target_link_libraries(latched_status rclcpp::rclcpp ${std_msgs_TARGETS})
install(TARGETS latched_status DESTINATION lib/${PROJECT_NAME})

add_executable(late_listener src/late_listener.cpp)
target_link_libraries(late_listener rclcpp::rclcpp ${std_msgs_TARGETS} ${turtlesim_TARGETS})
install(TARGETS late_listener DESTINATION lib/${PROJECT_NAME})

add_executable(status_publisher src/status_publisher.cpp)
target_link_libraries(status_publisher rclcpp::rclcpp ${turtlesim_TARGETS} ${my_robot_interfaces_TARGETS})
install(TARGETS status_publisher DESTINATION lib/${PROJECT_NAME})

add_executable(switchable_driver src/switchable_driver.cpp)
target_link_libraries(switchable_driver rclcpp::rclcpp ${geometry_msgs_TARGETS} ${std_srvs_TARGETS})
install(TARGETS switchable_driver DESTINATION lib/${PROJECT_NAME})

add_executable(turtle_artist src/turtle_artist.cpp)
target_link_libraries(turtle_artist rclcpp::rclcpp ${turtlesim_TARGETS})
install(TARGETS turtle_artist DESTINATION lib/${PROJECT_NAME})

add_executable(goto_server src/goto_server.cpp)
target_link_libraries(goto_server rclcpp::rclcpp ${geometry_msgs_TARGETS} ${turtlesim_TARGETS} ${my_robot_interfaces_TARGETS})
install(TARGETS goto_server DESTINATION lib/${PROJECT_NAME})

add_executable(drive_distance_server src/drive_distance_server.cpp)
target_link_libraries(drive_distance_server rclcpp::rclcpp rclcpp_action::rclcpp_action ${geometry_msgs_TARGETS} ${my_robot_interfaces_TARGETS})
install(TARGETS drive_distance_server DESTINATION lib/${PROJECT_NAME})

add_executable(drive_distance_client src/drive_distance_client.cpp)
target_link_libraries(drive_distance_client rclcpp::rclcpp rclcpp_action::rclcpp_action ${my_robot_interfaces_TARGETS})
install(TARGETS drive_distance_client DESTINATION lib/${PROJECT_NAME})

add_executable(cruise_control src/cruise_control.cpp)
target_link_libraries(cruise_control rclcpp::rclcpp ${geometry_msgs_TARGETS} ${rcl_interfaces_TARGETS})
install(TARGETS cruise_control DESTINATION lib/${PROJECT_NAME})

add_executable(turtle_tf_broadcaster src/turtle_tf_broadcaster.cpp)
target_link_libraries(turtle_tf_broadcaster rclcpp::rclcpp tf2::tf2 tf2_ros::tf2_ros ${geometry_msgs_TARGETS} ${turtlesim_TARGETS})
install(TARGETS turtle_tf_broadcaster DESTINATION lib/${PROJECT_NAME})

add_executable(turtle_follower src/turtle_follower.cpp)
target_link_libraries(turtle_follower rclcpp::rclcpp tf2::tf2 tf2_ros::tf2_ros ${geometry_msgs_TARGETS} ${turtlesim_TARGETS})
install(TARGETS turtle_follower DESTINATION lib/${PROJECT_NAME})

add_executable(battery_checker src/battery_checker.cpp)
target_link_libraries(battery_checker rclcpp::rclcpp ${std_srvs_TARGETS})
install(TARGETS battery_checker DESTINATION lib/${PROJECT_NAME})

add_executable(lifecycle_driver src/lifecycle_driver.cpp)
target_link_libraries(lifecycle_driver rclcpp::rclcpp rclcpp_lifecycle::rclcpp_lifecycle ${geometry_msgs_TARGETS})
install(TARGETS lifecycle_driver DESTINATION lib/${PROJECT_NAME})

add_executable(patrol src/patrol.cpp)
target_link_libraries(patrol rclcpp::rclcpp ${geometry_msgs_TARGETS} ${std_srvs_TARGETS} ${turtlesim_TARGETS} ${my_robot_interfaces_TARGETS})
install(TARGETS patrol DESTINATION lib/${PROJECT_NAME})

add_executable(speed_driver src/speed_driver.cpp)
target_link_libraries(speed_driver rclcpp::rclcpp ${geometry_msgs_TARGETS})
install(TARGETS speed_driver DESTINATION lib/${PROJECT_NAME})

add_executable(battery_monitor src/battery_monitor.cpp)
target_link_libraries(battery_monitor rclcpp::rclcpp ${std_srvs_TARGETS} ${turtlesim_TARGETS} ${my_robot_interfaces_TARGETS})
install(TARGETS battery_monitor DESTINATION lib/${PROJECT_NAME})

add_executable(spawn_client src/spawn_client.cpp)
target_link_libraries(spawn_client rclcpp::rclcpp ${turtlesim_TARGETS})
install(TARGETS spawn_client DESTINATION lib/${PROJECT_NAME})

# 3. a component: a library plus a registration line (no main function)
find_package(rclcpp_components REQUIRED)
add_library(circle_component SHARED src/circle_component.cpp)
target_link_libraries(circle_component rclcpp::rclcpp rclcpp_components::component ${geometry_msgs_TARGETS})
rclcpp_components_register_nodes(circle_component "chiku_control_cpp::CircleComponent")
install(TARGETS circle_component
  ARCHIVE DESTINATION lib
  LIBRARY DESTINATION lib
  RUNTIME DESTINATION bin)

# 4. launch and config files go to share/<package>
install(DIRECTORY launch config DESTINATION share/${PROJECT_NAME})

# 5. unit tests (colcon test)
if(BUILD_TESTING)
  find_package(ament_cmake_gtest REQUIRED)
  ament_add_gtest(test_control_math test/test_control_math.cpp)
endif()

ament_package()
