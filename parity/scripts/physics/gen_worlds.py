#!/usr/bin/env python3
"""Write the Gazebo Harmonic capture worlds for the physics baseline (parity/fixtures/physics/).

Every world: max_step_size 0.001 (1 kHz), real_time_factor 1, gravity 0 0 -9.8 (SDF default, written out),
an inline ground plane (no Fuel download), a PosePublisher on every moving model (every iteration, Pose_V),
and the systems the case needs. Usage: gen_worlds.py <out dir>
"""
import math
import os
import sys

G = 9.8


def physics(ptype='ode'):
    # gz-sim picks the engine from the Physics system <engine> (default dartsim); type= is kept to test that.
    return f'''    <physics name="1ms" type="{ptype}">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1</real_time_factor>
      <real_time_update_rate>1000</real_time_update_rate>
    </physics>
    <gravity>0 0 -{G}</gravity>'''


SYSTEMS = '''    <plugin filename="gz-sim-physics-system" name="gz::sim::systems::Physics"/>
    <plugin filename="gz-sim-user-commands-system" name="gz::sim::systems::UserCommands"/>
    <plugin filename="gz-sim-scene-broadcaster-system" name="gz::sim::systems::SceneBroadcaster"/>
    <plugin filename="gz-sim-apply-link-wrench-system" name="gz::sim::systems::ApplyLinkWrench"/>
    <plugin filename="gz-sim-contact-system" name="gz::sim::systems::Contact"/>'''


def surface(mu=None, mu2=None, fdir1=None, e=None):
    s = ''
    if mu is not None:
        s += f'<friction><ode><mu>{mu}</mu><mu2>{mu if mu2 is None else mu2}</mu2>'
        if fdir1:
            s += f'<fdir1>{fdir1}</fdir1>'
        s += '</ode></friction>'
    if e is not None:
        s += f'<bounce><restitution_coefficient>{e}</restitution_coefficient><threshold>0</threshold></bounce>'
    return f'<surface>{s}</surface>' if s else ''


def ground(mu=None, e=None, name='ground'):
    return f'''    <model name="{name}">
      <static>true</static>
      <link name="link">
        <collision name="collision">
          <geometry><plane><normal>0 0 1</normal><size>200 200</size></plane></geometry>
          {surface(mu=mu, e=e)}
        </collision>
        <visual name="visual">
          <geometry><plane><normal>0 0 1</normal><size>200 200</size></plane></geometry>
        </visual>
      </link>
    </model>'''


def pose_pub():
    return '''<plugin filename="gz-sim-pose-publisher-system" name="gz::sim::systems::PosePublisher">
        <publish_link_pose>true</publish_link_pose>
        <publish_model_pose>true</publish_model_pose>
        <publish_nested_model_pose>false</publish_nested_model_pose>
        <use_pose_vector_msg>true</use_pose_vector_msg>
        <update_frequency>-1</update_frequency>
      </plugin>'''


def box(name, pose, size=(0.2, 0.2, 0.2), mass=1.0, surf='', inertial=True, contact=False):
    a, b, c = size
    ixx, iyy, izz = mass * (b * b + c * c) / 12, mass * (a * a + c * c) / 12, mass * (a * a + b * b) / 12
    inert = f'''<inertial><mass>{mass}</mass><inertia><ixx>{ixx:.6g}</ixx><iyy>{iyy:.6g}</iyy><izz>{izz:.6g}</izz>
          <ixy>0</ixy><ixz>0</ixz><iyz>0</iyz></inertia></inertial>''' if inertial else '<!-- no <inertial> on purpose -->'
    sensor = f'''<sensor name="contact" type="contact"><always_on>true</always_on><update_rate>1000</update_rate>
          <contact><collision>collision</collision><topic>/contact/{name}</topic></contact></sensor>''' if contact else ''
    return f'''    <model name="{name}">
      <pose>{pose}</pose>
      <link name="link">
        {inert}
        <collision name="collision"><geometry><box><size>{a} {b} {c}</size></box></geometry>{surf}</collision>
        <visual name="visual"><geometry><box><size>{a} {b} {c}</size></box></geometry></visual>
        {sensor}
      </link>
      {pose_pub()}
    </model>'''


def sphere(name, pose, r=0.1, mass=1.0, surf=''):
    i = 2 / 5 * mass * r * r
    return f'''    <model name="{name}">
      <pose>{pose}</pose>
      <link name="link">
        <inertial><mass>{mass}</mass><inertia><ixx>{i:.6g}</ixx><iyy>{i:.6g}</iyy><izz>{i:.6g}</izz>
          <ixy>0</ixy><ixz>0</ixz><iyz>0</iyz></inertia></inertial>
        <collision name="collision"><geometry><sphere><radius>{r}</radius></sphere></geometry>{surf}</collision>
        <visual name="visual"><geometry><sphere><radius>{r}</radius></sphere></geometry></visual>
      </link>
      {pose_pub()}
    </model>'''


def cylinder(name, pose, r=0.1, length=0.2, mass=1.0, surf=''):
    ia = mass * r * r / 2                    # about its own axis (z of the link)
    it = mass * (3 * r * r + length * length) / 12
    return f'''    <model name="{name}">
      <pose>{pose}</pose>
      <link name="link">
        <inertial><mass>{mass}</mass><inertia><ixx>{it:.6g}</ixx><iyy>{it:.6g}</iyy><izz>{ia:.6g}</izz>
          <ixy>0</ixy><ixz>0</ixz><iyz>0</iyz></inertia></inertial>
        <collision name="collision"><geometry><cylinder><radius>{r}</radius><length>{length}</length></cylinder></geometry>{surf}</collision>
        <visual name="visual"><geometry><cylinder><radius>{r}</radius><length>{length}</length></cylinder></geometry></visual>
      </link>
      {pose_pub()}
    </model>'''


def world(name, body, ptype='ode'):
    return f'''<?xml version="1.0"?>
<!-- ROS2Lab physics baseline world "{name}" (parity/scripts/physics/gen_worlds.py) -->
<sdf version="1.10">
  <world name="{name}">
{physics(ptype)}
{SYSTEMS}
{body}
  </world>
</sdf>
'''


def pendulum(name, y, damping=0.0, spring=None, theta0=0.5, L=1.0, m=1.0):
    """Bob of mass m at distance L below a pivot at z=2, released from theta0 (rad) about the y axis.
    The link frame sits at the pivot, tilted by theta0; its CoM is (0,0,-L) in the link frame."""
    sp = ''
    if spring:
        k, ref = spring
        sp = f'<spring_stiffness>{k}</spring_stiffness><spring_reference>{ref}</spring_reference>'
    i = 2 / 5 * m * 0.05 * 0.05
    return f'''    <model name="{name}">
      <pose>0 {y} 2 0 0 0</pose>
      <link name="base"><inertial><mass>1</mass><inertia><ixx>0.01</ixx><iyy>0.01</iyy><izz>0.01</izz></inertia></inertial></link>
      <joint name="fix" type="fixed"><parent>world</parent><child>base</child></joint>
      <link name="bob">
        <pose>0 0 0 0 {theta0} 0</pose>
        <inertial><pose>0 0 -{L} 0 0 0</pose><mass>{m}</mass><inertia><ixx>{i:.6g}</ixx><iyy>{i:.6g}</iyy><izz>{i:.6g}</izz></inertia></inertial>
        <visual name="v"><pose>0 0 -{L} 0 0 0</pose><geometry><sphere><radius>0.05</radius></sphere></geometry></visual>
      </link>
      <joint name="hinge" type="revolute">
        <parent>base</parent><child>bob</child>
        <axis><xyz>0 1 0</xyz><dynamics><damping>{damping}</damping><friction>0</friction>{sp}</dynamics>
          <limit><lower>-1e16</lower><upper>1e16</upper></limit></axis>
      </joint>
      {pose_pub()}
      <plugin filename="gz-sim-joint-state-publisher-system" name="gz::sim::systems::JointStatePublisher">
        <topic>/joint_state/{name}</topic>
      </plugin>
    </model>'''


def ramp_case(theta_deg):
    th = math.radians(theta_deg)
    H, T, r = 3.5, 0.1, 0.1
    n = (math.sin(th), 0, math.cos(th))
    d = (math.cos(th), 0, -math.sin(th))
    def at(s, y, h):
        return (n[0] * (T / 2 + h) + d[0] * s, y, H + n[2] * (T / 2 + h) + d[2] * s)
    sp = at(-2.5, -0.5, r)
    cy = at(-2.5, 0.5, r)
    bx = at(-2.5, 1.5, 0.1)
    rough = surface(mu=1.0)
    body = f'''    <model name="ramp">
      <static>true</static>
      <pose>0 0 {H} 0 {th:.9f} 0</pose>
      <link name="link">
        <collision name="collision"><geometry><box><size>6 4 {T}</size></box></geometry>{rough}</collision>
        <visual name="visual"><geometry><box><size>6 4 {T}</size></box></geometry></visual>
      </link>
    </model>
{ground(mu=1.0)}
{sphere('sphere', f'{sp[0]:.9f} {sp[1]} {sp[2]:.9f} 0 0 0', surf=rough)}
{cylinder('cylinder', f'{cy[0]:.9f} {cy[1]} {cy[2]:.9f} {math.pi / 2:.9f} 0 0', surf=rough)}
{box('box_frictionless', f'{bx[0]:.9f} {bx[1]} {bx[2]:.9f} 0 {th:.9f} 0', surf=surface(mu=0.0))}'''
    return world(f'incline_{theta_deg}', body)


TB3_SENSOR_SYSTEMS = '''    <plugin filename="gz-sim-sensors-system" name="gz::sim::systems::Sensors"><render_engine>ogre2</render_engine></plugin>
    <plugin filename="gz-sim-imu-system" name="gz::sim::systems::Imu"/>'''


def tb3(uri='model://turtlebot3_burger', x=0.0):
    """The INSTALLED TurtleBot3 burger model (turtlebot3_gazebo/models), unchanged, plus a PosePublisher for ground truth
    (a <plugin> inside <include> is merged into the model by SDFormat 1.9+)."""
    return f'''    <include>
      <uri>{uri}</uri>
      <name>burger</name>
      <pose>{x} 0 0.01 0 0 0</pose>
      {pose_pub()}
    </include>'''


def tb3_worlds():
    W = {}
    W['tb3_drive'] = world('tb3_drive', ground() + '\n' + tb3())
    # same, model copy without <max_linear_acceleration> (parity/scripts/physics/models/turtlebot3_burger_noacc)
    W['tb3_drive_noacc'] = world('tb3_drive_noacc', ground() + '\n' + tb3('model://turtlebot3_burger_noacc'))
    # pushing a light box: 0.1 kg, 0.15 m cube, 0.5 m ahead
    W['tb3_push'] = world('tb3_push', ground() + '\n' + tb3() + '\n' + box('light_box', '0.5 0 0.075 0 0 0', size=(0.15, 0.15, 0.15), mass=0.1))
    # sensors: empty world, and a wall whose near face is 1.0 m ahead of the lidar (lidar at x = -0.032 in the model)
    W['tb3_sensors_empty'] = world('tb3_sensors_empty', TB3_SENSOR_SYSTEMS + '\n' + ground() + '\n' + tb3())
    wall = '''    <model name="wall"><static>true</static><pose>1.018 0 0.5 0 0 0</pose>
      <link name="link"><collision name="c"><geometry><box><size>0.1 4 1</size></box></geometry></collision>
        <visual name="v"><geometry><box><size>0.1 4 1</size></box></geometry></visual></link></model>'''
    W['tb3_sensors_wall'] = world('tb3_sensors_wall', TB3_SENSOR_SYSTEMS + '\n' + ground() + '\n' + tb3() + '\n' + wall)
    return W


def main(out):
    os.makedirs(out, exist_ok=True)
    W = {}
    # (1) box drop from 1 m (bottom face at 1.0 m), contact sensor for depth/count at rest
    W['drop'] = world('drop', ground() + '\n' + box('box', '0 0 1.1 0 0 0', contact=True))
    # physics type="bullet": does gz-sim switch engine? (expected by SDF readers; measured here)
    W['drop_typebullet'] = world('drop_typebullet', ground() + '\n' + box('box', '0 0 1.1 0 0 0', contact=True), ptype='bullet')
    # which collision detector / solver does dartsim use? explicit <dart> settings vs the default drop world (-v 4 logs)
    for tag, dart in (('drop_cd_bullet', '<collision_detector>bullet</collision_detector>'),
                      ('drop_cd_ode', '<collision_detector>ode</collision_detector>'),
                      ('drop_solver_pgs', '<solver><solver_type>pgs</solver_type></solver>')):
        W[tag] = world(tag, ground() + '\n' + box('box', '0 0 1.1 0 0 0', contact=True)).replace(
            '<real_time_update_rate>1000</real_time_update_rate>',
            f'<real_time_update_rate>1000</real_time_update_rate>\n      <dart>{dart}</dart>')
    # (2) sliding: same mu on box and ground; impulse gives v0 = 0.5 m/s along +x
    for mu in (0.01, 0.1, 0.5, 1.0):
        W[f'slide_mu{mu}'] = world(f'slide_mu{mu}', ground(mu=mu) + '\n' + box('box', '0 0 0.1 0 0 0', surf=surface(mu=mu)))
    # mu != mu2 with fdir1 = x: box A pushed along x (mu 0.1 direction), box B pushed along y (mu2 1.0 direction)
    an = surface(mu=0.1, mu2=1.0, fdir1='1 0 0')
    W['slide_aniso'] = world('slide_aniso', ground(mu=1.0) + '\n' + box('box_x', '0 0 0.1 0 0 0', surf=an) + '\n' +
                             box('box_y', '0 3 0.1 0 0 0', surf=an))
    # friction combine rule: ground mu 0.5, box_lo mu 0.1, box_hi mu 1.0, both pushed to 2 m/s
    W['slide_combine'] = world('slide_combine', ground(mu=0.5) + '\n' + box('box_lo', '0 0 0.1 0 0 0', surf=surface(mu=0.1)) +
                               '\n' + box('box_hi', '0 3 0.1 0 0 0', surf=surface(mu=1.0)))
    # (3) incline: sphere + cylinder rolling (mu 1), frictionless box for g sin(theta)
    for th in (10, 15, 30, 45):
        W[f'incline_{th}'] = ramp_case(th)
    # (4) pendulum: damping 0 / 0.1 / 1, and damping 0 with a spring (k = 10 N m/rad toward hanging down)
    W['pendulum'] = world('pendulum', '\n'.join([
        pendulum('pend_d0', 0, 0.0), pendulum('pend_d01', 2, 0.1), pendulum('pend_d1', 4, 1.0),
        pendulum('pend_spring', 6, 0.0, spring=(10.0, -0.5))]))
    # (5) two-box collision on a frictionless ground: A pushed to 1 m/s toward B at rest
    fr = surface(mu=0.0)
    W['collision'] = world('collision', ground(mu=0.0) + '\n' + box('box_a', '0 0 0.1 0 0 0', surf=fr) + '\n' +
                           box('box_b', '1 0 0.1 0 0 0', surf=fr))
    # restitution: spheres e = 0 / 0.5 / 0.9 / 1 dropped from 1 m (bottom) on ground e = 1 and on ground e = 0.5
    for ge in (1.0, 0.5):
        W[f'restitution_ground{ge}'] = world(f'restitution_ground{ge}', ground(e=ge) + '\n' + '\n'.join(
            sphere(f'sphere_e{e}', f'0 {i * 0.5} 1.1 0 0 0', surf=surface(e=e)) for i, e in enumerate((0.0, 0.5, 0.9, 1.0))))
    # link without <inertial>: what mass/inertia does gz use, any warning
    W['noinertial'] = world('noinertial', ground() + '\n' + box('box_noinertial', '0 0 0.6 0 0 0', inertial=False) + '\n' +
                            box('box_ref', '0 1 0.6 0 0 0'))
    # joint limits: horizontal revolute joint (axis z, no gravity torque), effort limit 1 N m, velocity limit 0.5 rad/s,
    # position limits +-1 rad; ApplyJointForce gets 5 N m (5x the effort limit)
    W['joint_limits'] = world('joint_limits', '''    <model name="arm">
      <pose>0 0 0.5 0 0 0</pose>
      <link name="base"><inertial><mass>1</mass><inertia><ixx>0.01</ixx><iyy>0.01</iyy><izz>0.01</izz></inertia></inertial></link>
      <joint name="fix" type="fixed"><parent>world</parent><child>base</child></joint>
      <link name="bar">
        <inertial><pose>0.5 0 0 0 0 0</pose><mass>1</mass><inertia><ixx>0.001</ixx><iyy>0.0834</iyy><izz>0.0834</izz></inertia></inertial>
        <visual name="v"><pose>0.5 0 0 0 0 0</pose><geometry><box><size>1 0.05 0.05</size></box></geometry></visual>
      </link>
      <joint name="j" type="revolute">
        <parent>base</parent><child>bar</child>
        <axis><xyz>0 0 1</xyz><limit><lower>-1</lower><upper>1</upper><effort>1</effort><velocity>0.5</velocity></limit>
          <dynamics><damping>0</damping><friction>0</friction></dynamics></axis>
      </joint>
      <plugin filename="gz-sim-apply-joint-force-system" name="gz::sim::systems::ApplyJointForce"><joint_name>j</joint_name></plugin>
      <plugin filename="gz-sim-joint-state-publisher-system" name="gz::sim::systems::JointStatePublisher"><topic>/joint_state/arm</topic></plugin>
      ''' + pose_pub() + '''
    </model>''')
    # determinism: a tilted box falling on a box on the ground, no outside input
    W['determinism'] = world('determinism', ground() + '\n' + box('base_box', '0 0 0.1 0 0 0') + '\n' +
                             box('tilted', '0.03 0.02 0.8 0.4 0.3 0.2'))
    W.update(tb3_worlds())
    for k, v in W.items():
        with open(os.path.join(out, f'{k}.sdf'), 'w') as f:
            f.write(v)
    print(f'{len(W)} worlds in {out}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'worlds'))
