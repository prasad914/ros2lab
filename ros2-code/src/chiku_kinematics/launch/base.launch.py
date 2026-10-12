from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    wheels = {'wheel_radius': 0.05, 'wheel_separation': 0.30}
    return LaunchDescription([
        Node(package='chiku_kinematics', executable='diff_drive_controller', parameters=[wheels]),
        Node(package='chiku_kinematics', executable='fake_wheels'),
        Node(package='chiku_kinematics', executable='wheel_odometry', parameters=[wheels], output='screen'),
    ])
