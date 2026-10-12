from glob import glob

from setuptools import find_packages, setup

package_name = 'chiku_control'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', glob('launch/*')),
        ('share/' + package_name + '/config', glob('config/*.yaml')),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='student',
    maintainer_email='student@todo.todo',
    description="Chiku's own nodes, written in Python",
    license='Apache-2.0',
    extras_require={'test': ['pytest']},
    entry_points={
        'console_scripts': [
            'hello_node = chiku_control.hello_node:main',
            'heartbeat = chiku_control.heartbeat:main',
            'log_demo = chiku_control.log_demo:main',
            'circle_driver = chiku_control.circle_driver:main',
            'square_driver = chiku_control.square_driver:main',
            'pose_monitor = chiku_control.pose_monitor:main',
            'go_to_goal = chiku_control.go_to_goal:main',
            'safety_filter = chiku_control.safety_filter:main',
            'head_joints = chiku_control.head_joints:main',
            'latched_status = chiku_control.latched_status:main',
            'late_listener = chiku_control.late_listener:main',
            'status_publisher = chiku_control.status_publisher:main',
            'switchable_driver = chiku_control.switchable_driver:main',
            'turtle_artist = chiku_control.turtle_artist:main',
            'goto_server = chiku_control.goto_server:main',
            'drive_distance_server = chiku_control.drive_distance_server:main',
            'drive_distance_client = chiku_control.drive_distance_client:main',
            'cruise_control = chiku_control.cruise_control:main',
            'turtle_tf_broadcaster = chiku_control.turtle_tf_broadcaster:main',
            'turtle_follower = chiku_control.turtle_follower:main',
            'battery_checker = chiku_control.battery_checker:main',
            'lifecycle_driver = chiku_control.lifecycle_driver:main',
            'patrol = chiku_control.patrol:main',
            'speed_driver = chiku_control.speed_driver:main',
            'battery_monitor = chiku_control.battery_monitor:main',
            'spawn_client = chiku_control.spawn_client:main',
        ],
    },
)
