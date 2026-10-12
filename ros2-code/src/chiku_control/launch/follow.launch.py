from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(package='turtlesim', executable='turtlesim_node', name='sim'),
        Node(package='chiku_control', executable='turtle_tf_broadcaster', name='broadcaster1',
             parameters=[{'turtlename': 'turtle1'}]),
        Node(package='chiku_control', executable='turtle_tf_broadcaster', name='broadcaster2',
             parameters=[{'turtlename': 'turtle2'}]),
        Node(package='chiku_control', executable='turtle_follower', name='follower'),
    ])
