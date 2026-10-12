# Starts a robot that runs on the ROS2Lab bridge: robot_state_publisher, controller_manager (ros2_control_node) with
# the ros2lab_hardware/BridgeSystem plugin (or mock_components for hardware_type:=mock), and the controller spawner.
#   ros2 launch ros2lab_hardware bridge.launch.py robot_xacro:=<urdf.xacro> controllers_file:=<controllers.yaml> \
#       controllers:="joint_state_broadcaster diff_drive_controller" hardware_type:=real transport:=serial device:=/dev/ros2lab_mcu
# The course robots' <id>_bringup packages write the same three nodes out in their own launch/real.launch.py.
import xacro
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue

XACRO_ARGS = ('hardware_type', 'transport', 'device', 'host')
# mecanum_drive_controller and the steering controllers publish odom -> base_link on ~/tf_odometry: send it to /tf
TF_ODOM_CONTROLLERS = ('mecanum_drive_controller', 'ackermann_steering_controller')


def launch_setup(context):
    get = lambda name: LaunchConfiguration(name).perform(context)  # noqa: E731
    description = xacro.process_file(get('robot_xacro'), mappings={k: get(k) for k in XACRO_ARGS}).toxml()
    controllers = get('controllers').split()
    return [
        Node(package='robot_state_publisher', executable='robot_state_publisher', output='screen',
             parameters=[{'robot_description': ParameterValue(description, value_type=str)}]),
        # Jazzy: controller_manager reads the URDF from the robot_description topic (robot_state_publisher)
        Node(package='controller_manager', executable='ros2_control_node', output='screen',
             parameters=[get('controllers_file')]),
        Node(package='controller_manager', executable='spawner', output='screen',
             arguments=controllers + ['--controller-manager', '/controller_manager', '--controller-manager-timeout', '30'] +
             (['--controller-ros-args', '-r ~/tf_odometry:=/tf'] if set(controllers) & set(TF_ODOM_CONTROLLERS) else [])),
    ]


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument('robot_xacro', description='The robot URDF / xacro that includes its <id>.ros2_control.xacro'),
        DeclareLaunchArgument('controllers_file', description='controllers.yaml (controller_manager and the controllers)'),
        DeclareLaunchArgument('controllers', default_value='joint_state_broadcaster', description='Controllers to start, separated by spaces'),
        DeclareLaunchArgument('hardware_type', default_value='real', choices=['mock', 'real'],
                              description='real: the board through ros2lab_hardware/BridgeSystem; mock: mock_components/GenericSystem'),
        DeclareLaunchArgument('transport', default_value='serial', choices=['serial', 'udp'], description='serial: USB; udp: Wi-Fi'),
        DeclareLaunchArgument('device', default_value='/dev/ros2lab_mcu', description='Serial device (USB)'),
        DeclareLaunchArgument('host', default_value='192.168.4.1', description="The board's IP address (Wi-Fi)"),
        OpaqueFunction(function=launch_setup),
    ])
