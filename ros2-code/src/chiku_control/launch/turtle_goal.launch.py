from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    goal_x = LaunchConfiguration('goal_x')
    goal_y = LaunchConfiguration('goal_y')
    return LaunchDescription([
        DeclareLaunchArgument('goal_x', default_value='8.0', description='Goal x in metres'),
        DeclareLaunchArgument('goal_y', default_value='8.0', description='Goal y in metres'),
        Node(package='turtlesim', executable='turtlesim_node', name='sim'),
        Node(
            package='chiku_control',
            executable='go_to_goal',
            name='go_to_goal',
            output='screen',
            parameters=[{'goal_x': goal_x, 'goal_y': goal_y}],
        ),
    ])
