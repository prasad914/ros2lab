import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    goals = os.path.join(get_package_share_directory('chiku_control'), 'config', 'goals.yaml')
    return LaunchDescription([
        DeclareLaunchArgument('with_monitor', default_value='true'),
        # robot 1: everything inside the namespace /robot1
        Node(package='turtlesim', executable='turtlesim_node', name='sim', namespace='robot1'),
        Node(package='chiku_control', executable='go_to_goal', name='go_to_goal', namespace='robot1',
             parameters=[goals]),
        # robot 2: the same programs, a different namespace, different goals (see goals.yaml)
        Node(package='turtlesim', executable='turtlesim_node', name='sim', namespace='robot2'),
        Node(package='chiku_control', executable='go_to_goal', name='go_to_goal', namespace='robot2',
             parameters=[goals]),
        # an optional extra node, watching robot 1 (remapped to its pose topic)
        Node(package='chiku_control', executable='pose_monitor', name='pose_monitor',
             remappings=[('/turtle1/pose', '/robot1/turtle1/pose')],
             condition=IfCondition(LaunchConfiguration('with_monitor'))),
    ])
