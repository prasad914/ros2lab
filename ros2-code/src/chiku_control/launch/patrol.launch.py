import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    config = os.path.join(get_package_share_directory('chiku_control'), 'config', 'patrol.yaml')
    return LaunchDescription([
        Node(package='turtlesim', executable='turtlesim_node', name='sim'),
        Node(package='chiku_control', executable='patrol', name='patrol',
             output='screen', parameters=[config]),
        Node(package='chiku_control', executable='turtle_tf_broadcaster', name='tf_turtle1'),
    ])
