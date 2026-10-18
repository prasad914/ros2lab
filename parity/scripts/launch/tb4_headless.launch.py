# turtlebot4_gz.launch.py without the Gazebo GUI client: the server runs with --headless-rendering (EGL), like
# tb3_world_headless.launch.py. Same environment and clock bridge as the installed turtlebot4_gz_bringup sim.launch.py,
# then the installed turtlebot4_spawn.launch.py unchanged. Only the GUI (and its TurtleBot4 HMI GUI plugins) is left out.
import os
from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, SetEnvironmentVariable
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    tb4 = get_package_share_directory('turtlebot4_gz_bringup')
    create_bringup = get_package_share_directory('irobot_create_gz_bringup')
    tb4_desc = get_package_share_directory('turtlebot4_description')
    create_desc = get_package_share_directory('irobot_create_description')
    gz = get_package_share_directory('ros_gz_sim')

    def inc(path, args):
        return IncludeLaunchDescription(PythonLaunchDescriptionSource(path), launch_arguments=args)

    return LaunchDescription([
        DeclareLaunchArgument('world', default_value='warehouse'),
        DeclareLaunchArgument('model', default_value='standard'),
        SetEnvironmentVariable('GZ_SIM_RESOURCE_PATH', ':'.join([
            os.path.join(tb4, 'worlds'), os.path.join(create_bringup, 'worlds'),
            str(Path(tb4_desc).parent.resolve()), str(Path(create_desc).parent.resolve())])),
        inc(os.path.join(gz, 'launch', 'gz_sim.launch.py'),
            [('gz_args', [LaunchConfiguration('world'), '.sdf', ' -r -s --headless-rendering -v 2'])]),
        Node(package='ros_gz_bridge', executable='parameter_bridge', name='clock_bridge', output='screen',
             arguments=['/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock']),
        inc(os.path.join(tb4, 'launch', 'turtlebot4_spawn.launch.py'),
            [('rviz', 'false'), ('model', LaunchConfiguration('model'))]),
    ])
