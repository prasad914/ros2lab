cmake_minimum_required(VERSION 3.16)
project(ros2lab_hardware LANGUAGES CXX)

if(CMAKE_CXX_COMPILER_ID MATCHES "(GNU|Clang)")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(hardware_interface REQUIRED)
find_package(pluginlib REQUIRED)
find_package(rclcpp REQUIRED)
find_package(rclcpp_lifecycle REQUIRED)

add_library(ros2lab_hardware SHARED src/bridge_system.cpp src/transport.cpp)
target_compile_features(ros2lab_hardware PUBLIC cxx_std_17)
target_include_directories(ros2lab_hardware PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include/${PROJECT_NAME}>)
target_link_libraries(ros2lab_hardware PUBLIC
  hardware_interface::hardware_interface pluginlib::pluginlib rclcpp::rclcpp rclcpp_lifecycle::rclcpp_lifecycle)
pluginlib_export_plugin_description_file(hardware_interface ros2lab_hardware.xml)

# a small command-line tool: talk to the board without ROS (bench tests, wiring checks)
add_executable(bridge_probe src/bridge_probe.cpp src/transport.cpp)
target_include_directories(bridge_probe PRIVATE include)
target_compile_features(bridge_probe PRIVATE cxx_std_17)

install(DIRECTORY include/ DESTINATION include/${PROJECT_NAME})
install(TARGETS ros2lab_hardware EXPORT export_${PROJECT_NAME}
  ARCHIVE DESTINATION lib LIBRARY DESTINATION lib RUNTIME DESTINATION bin)
install(TARGETS bridge_probe DESTINATION lib/${PROJECT_NAME})
install(PROGRAMS scripts/ros2lab_robot_setup.py DESTINATION lib/${PROJECT_NAME} RENAME ros2lab_robot_setup)
install(DIRECTORY config launch udev DESTINATION share/${PROJECT_NAME})

if(BUILD_TESTING)
  find_package(ament_cmake_gtest REQUIRED)
  ament_add_gtest(test_protocol test/test_protocol.cpp)
  target_include_directories(test_protocol PRIVATE include)
  ament_add_gtest(test_bridge_system test/test_bridge_system.cpp)
  target_link_libraries(test_bridge_system ros2lab_hardware util)
endif()

ament_export_targets(export_${PROJECT_NAME} HAS_LIBRARY_TARGET)
ament_export_dependencies(hardware_interface pluginlib rclcpp rclcpp_lifecycle)
ament_package()
