import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    urdf = os.path.join(get_package_share_directory('chiku_kinematics'), 'urdf', 'two_link_arm.urdf')
    with open(urdf) as f:
        robot_description = f.read()
    return LaunchDescription([
        # turns /joint_states + the URDF into TF frames for every link
        Node(package='robot_state_publisher', executable='robot_state_publisher',
             parameters=[{'robot_description': robot_description}]),
        Node(package='chiku_kinematics', executable='ik_node', name='ik_node', output='screen',
             parameters=[{'link1_length': 1.0, 'link2_length': 0.8}]),
    ])
