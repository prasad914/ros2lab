import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    config = os.path.join(get_package_share_directory('chiku_control_cpp'), 'config', 'mission.yaml')
    return LaunchDescription([
        Node(package='turtlesim', executable='turtlesim_node', name='sim'),
        Node(package='chiku_control_cpp', executable='speed_driver', output='screen', parameters=[config]),
        Node(package='chiku_control_cpp', executable='battery_monitor', output='screen', parameters=[config]),
    ])
