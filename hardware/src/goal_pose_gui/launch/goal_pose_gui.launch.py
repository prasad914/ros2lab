"""The goal window, plus the pose follower for robots that move around (no Nav2 needed).

  ros2 launch goal_pose_gui goal_pose_gui.launch.py robot_type:=arm planning_group:=ur_manipulator
  ros2 launch goal_pose_gui goal_pose_gui.launch.py robot_type:=diff
  ros2 launch goal_pose_gui goal_pose_gui.launch.py robot_type:=diff stamped:=true cmd_vel:=/diff_drive_controller/cmd_vel
"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import UnlessCondition
from launch.substitutions import LaunchConfiguration, PythonExpression
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    robot_type = LaunchConfiguration('robot_type')
    stamped = ParameterValue(LaunchConfiguration('stamped'), value_type=bool)
    sim_time = ParameterValue(LaunchConfiguration('use_sim_time'), value_type=bool)
    follower_yaml = os.path.join(get_package_share_directory('goal_pose_gui'), 'config', 'pose_follower.yaml')
    return LaunchDescription([
        DeclareLaunchArgument('robot_type', default_value='arm',
                              description='arm, diff, ackermann, holonomic, legged or drone'),
        DeclareLaunchArgument('planning_group', default_value='arm', description='MoveIt planning group (arms)'),
        DeclareLaunchArgument('end_effector_link', default_value='', description='tool link (arms)'),
        DeclareLaunchArgument('stamped', default_value='false',
                              description='publish TwistStamped (Jazzy diff_drive_controller) instead of Twist'),
        DeclareLaunchArgument('cmd_vel', default_value='/cmd_vel', description='velocity command topic'),
        DeclareLaunchArgument('use_sim_time', default_value='true'),
        Node(package='goal_pose_gui', executable='goal_pose_gui', name='goal_pose_gui', output='screen',
             parameters=[{'robot_type': robot_type, 'planning_group': LaunchConfiguration('planning_group'),
                          'end_effector_link': LaunchConfiguration('end_effector_link'), 'stamped': stamped,
                          'use_sim_time': sim_time}],
             remappings=[('cmd_vel', LaunchConfiguration('cmd_vel'))]),
        Node(package='goal_pose_gui', executable='pose_follower', name='pose_follower', output='screen',
             condition=UnlessCondition(PythonExpression(["'", robot_type, "' == 'arm'"])),
             parameters=[follower_yaml, {'robot_type': robot_type, 'stamped': stamped, 'use_sim_time': sim_time}],
             remappings=[('cmd_vel', LaunchConfiguration('cmd_vel'))]),
    ])
