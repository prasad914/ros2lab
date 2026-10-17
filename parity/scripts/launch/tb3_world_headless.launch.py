# turtlebot3_world.launch.py without the GUI client and with server-side headless EGL rendering.
# Includes the installed turtlebot3_gazebo launch files unchanged.
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import AppendEnvironmentVariable, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource


def generate_launch_description():
    tb3 = get_package_share_directory('turtlebot3_gazebo')
    gz = get_package_share_directory('ros_gz_sim')
    world = os.path.join(tb3, 'worlds', 'turtlebot3_world.world')

    def inc(path, args):
        return IncludeLaunchDescription(PythonLaunchDescriptionSource(path), launch_arguments=args.items())

    return LaunchDescription([
        inc(os.path.join(gz, 'launch', 'gz_sim.launch.py'),
            {'gz_args': f'-r -s --headless-rendering -v2 {world}', 'on_exit_shutdown': 'true'}),
        # Same defaults as turtlebot3_world.launch.py (x_pose -2.0, y_pose -0.5, use_sim_time true).
        inc(os.path.join(tb3, 'launch', 'spawn_turtlebot3.launch.py'), {'x_pose': '-2.0', 'y_pose': '-0.5'}),
        inc(os.path.join(tb3, 'launch', 'robot_state_publisher.launch.py'), {'use_sim_time': 'true'}),
        AppendEnvironmentVariable('GZ_SIM_RESOURCE_PATH', os.path.join(tb3, 'models')),
    ])
