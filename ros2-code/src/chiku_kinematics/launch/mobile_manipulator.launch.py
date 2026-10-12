import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node


def generate_launch_description():
    share = get_package_share_directory('chiku_kinematics')
    arm = {'link1_length': 1.0, 'link2_length': 0.8}
    return LaunchDescription([
        IncludeLaunchDescription(PythonLaunchDescriptionSource(os.path.join(share, 'launch', 'base.launch.py'))),
        Node(package='chiku_kinematics', executable='ik_node', name='ik_node', parameters=[arm], output='screen'),
        Node(package='chiku_kinematics', executable='mm_planner', name='mm_planner', parameters=[arm], output='screen'),
        # the arm is bolted 0.1 m in front of the base centre
        Node(package='tf2_ros', executable='static_transform_publisher',
             arguments=['--x', '0.1', '--frame-id', 'base_link', '--child-frame-id', 'arm_base']),
    ])
