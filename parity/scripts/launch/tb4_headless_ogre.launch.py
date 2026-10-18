# tb4_headless.launch.py with the server sensors rendered by Gazebo's ogre (OGRE 1) engine instead of ogre2, headless (EGL):
# overnight 2026-10-19 B4, one attempt at a valid TurtleBot4 gpu_lidar under EGL (ogre2 + EGL gives every range =
# range_min on this machine, fixtures/tb4/p2c_sensors/README.md). Everything else as tb4_headless.launch.py.
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
        # passed to the installed turtlebot4_spawn.launch.py, which includes turtlebot4_navigation's launch files
        DeclareLaunchArgument('slam', default_value='false'),
        DeclareLaunchArgument('localization', default_value='false'),
        DeclareLaunchArgument('nav2', default_value='false'),
        SetEnvironmentVariable('GZ_SIM_RESOURCE_PATH', ':'.join([
            os.path.join(tb4, 'worlds'), os.path.join(create_bringup, 'worlds'),
            str(Path(tb4_desc).parent.resolve()), str(Path(create_desc).parent.resolve())])),
        inc(os.path.join(gz, 'launch', 'gz_sim.launch.py'),
            [('gz_args', [LaunchConfiguration('world'), '.sdf', ' -r -s --headless-rendering --render-engine-server ogre -v 2'])]),
        Node(package='ros_gz_bridge', executable='parameter_bridge', name='clock_bridge', output='screen',
             arguments=['/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock']),
        inc(os.path.join(tb4, 'launch', 'turtlebot4_spawn.launch.py'),
            [('rviz', 'false'), ('model', LaunchConfiguration('model')), ('slam', LaunchConfiguration('slam')),
             ('localization', LaunchConfiguration('localization')), ('nav2', LaunchConfiguration('nav2'))]),
    ])
