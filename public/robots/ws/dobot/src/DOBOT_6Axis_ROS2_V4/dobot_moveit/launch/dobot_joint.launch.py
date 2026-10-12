from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition, UnlessCondition
from launch.substitutions import LaunchConfiguration
import os


def generate_launch_description():
    robot_type = os.getenv("DOBOT_TYPE", "cr5")

    robot_type_arg = DeclareLaunchArgument(
        name='robot_type',
        default_value=robot_type,
        description='Robot type (e.g., cr5, cr10, cr12)'
    )

    timeout_arg = DeclareLaunchArgument(
        name='trajectory_execution_timeout',
        default_value='120.0',
        description='Trajectory execution timeout in seconds'
    )

    use_sim_arg = DeclareLaunchArgument(
        name='use_sim_time',
        default_value='false',
        description='Use simulation (Gazebo) time instead of system time'
    )

    return LaunchDescription([
        robot_type_arg,
        timeout_arg,
        use_sim_arg,
        Node(
            package='dobot_moveit',
            executable='action_move_server',
            parameters=[
                {'robot_type': LaunchConfiguration('robot_type')},
                {'trajectory_execution_timeout': LaunchConfiguration('trajectory_execution_timeout')}
            ],
            output='screen',
            condition=UnlessCondition(LaunchConfiguration('use_sim_time')),
        ),
        Node(
            package='dobot_moveit',
            executable='joint_states',
            parameters=[{
                'publish_frequency': 50.0,
            }],
            output='screen',
            condition=UnlessCondition(LaunchConfiguration('use_sim_time')),
        ),
    ])