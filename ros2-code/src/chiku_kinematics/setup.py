from glob import glob

from setuptools import find_packages, setup

package_name = 'chiku_kinematics'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', glob('launch/*.py')),
        ('share/' + package_name + '/urdf', glob('urdf/*.urdf')),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='student',
    maintainer_email='student@todo.todo',
    description='Kinematics nodes for Chiku',
    license='Apache-2.0',
    extras_require={'test': ['pytest']},
    entry_points={
        'console_scripts': [
            'frames_demo = chiku_kinematics.frames_demo:main',
            'fk_node = chiku_kinematics.fk_node:main',
            'ik_node = chiku_kinematics.ik_node:main',
            'move_arm_server = chiku_kinematics.move_arm_server:main',
            'arm_cli = chiku_kinematics.arm_cli:main',
            'trajectory_node = chiku_kinematics.trajectory_node:main',
            'diff_drive_controller = chiku_kinematics.diff_drive_controller:main',
            'fake_wheels = chiku_kinematics.fake_wheels:main',
            'wheel_odometry = chiku_kinematics.wheel_odometry:main',
            'mm_planner = chiku_kinematics.mm_planner:main',
        ],
    },
)
