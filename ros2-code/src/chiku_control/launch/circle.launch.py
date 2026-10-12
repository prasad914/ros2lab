from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(package='turtlesim', executable='turtlesim_node', name='sim'),
        Node(package='chiku_control', executable='speed_driver', output='screen',
             parameters=[{'speed': 2.0, 'turn': 1.0}]),
        Node(package='chiku_control', executable='pose_monitor', output='screen'),
    ])
