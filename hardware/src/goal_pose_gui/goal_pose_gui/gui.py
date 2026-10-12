"""goal_pose_gui: a window (like joint_state_publisher_gui) to type goals for any robot.

  ros2 run goal_pose_gui goal_pose_gui --ros-args -p robot_type:=arm -p planning_group:=ur_manipulator
  ros2 run goal_pose_gui goal_pose_gui --ros-args -p robot_type:=diff -p stamped:=true \\
      -r cmd_vel:=/diff_drive_controller/cmd_vel

robot_type: arm | diff | ackermann | holonomic | legged | drone
  arm     Pose tab: tool x, y, z (m) and roll, pitch, yaw (deg) in the planning frame -> MoveIt (/move_action,
          or /compute_cartesian_path + /execute_trajectory for a straight line).
          Joints tab: one slider per joint -> MoveIt joint goal, or (use_moveit:=false) straight to
          /<controller>/follow_joint_trajectory.
  others  Goal tab: x, y (z for drones), yaw in odom -> /navigate_to_pose (Nav2, or pose_follower from this package).
          Velocity tab: sliders -> cmd_vel at 10 Hz (Twist, or TwistStamped with stamped:=true).
"""
import math
import sys
import xml.etree.ElementTree as ET

import rclpy
from rclpy.action import ActionClient
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile

from python_qt_binding.QtCore import Qt, QTimer
from python_qt_binding.QtWidgets import (QApplication, QCheckBox, QComboBox, QDoubleSpinBox, QFormLayout,
                                         QHBoxLayout, QLabel, QPushButton, QScrollArea, QSlider, QTabWidget,
                                         QVBoxLayout, QWidget)

from builtin_interfaces.msg import Duration as DurationMsg
from control_msgs.action import FollowJointTrajectory
from geometry_msgs.msg import Pose, PoseStamped, Twist, TwistStamped
from moveit_msgs.action import ExecuteTrajectory, MoveGroup
from moveit_msgs.msg import (BoundingVolume, Constraints, JointConstraint, MotionPlanRequest,
                             OrientationConstraint, PositionConstraint)
from moveit_msgs.srv import GetCartesianPath
from nav2_msgs.action import NavigateToPose
from sensor_msgs.msg import JointState
from shape_msgs.msg import SolidPrimitive
from std_msgs.msg import String
from tf2_ros import Buffer, TransformListener
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint

from goal_pose_gui.geometry import quaternion_from_rpy, rpy_from_quaternion

D2R = math.pi / 180.0
SLIDER_STEPS = 1000


class GoalNode(Node):
    """All ROS communication of the window."""

    def __init__(self):
        super().__init__('goal_pose_gui')
        self.declare_parameter('robot_type', 'arm')
        self.declare_parameter('planning_group', 'arm')
        self.declare_parameter('planning_frame', '')          # '' = the root link of the URDF
        self.declare_parameter('end_effector_link', '')      # '' = the last link of the group (from the SRDF)
        self.declare_parameter('pipeline_id', 'ompl')
        self.declare_parameter('planner_id', 'RRTConnectkConfigDefault')
        self.declare_parameter('use_moveit', True)
        self.declare_parameter('controller', 'arm_controller')
        self.declare_parameter('stamped', False)
        self.declare_parameter('frame_id', 'odom')
        self.declare_parameter('max_linear', 0.5)
        self.declare_parameter('max_angular', 1.5)
        self.p = lambda n: self.get_parameter(n).value  # noqa: E731

        latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.urdf_joints = []          # [(name, lower, upper, prismatic)]
        self.root_link = 'base_link'
        self.joint_positions = {}
        self.create_subscription(String, 'robot_description', self._on_description, latched)
        self.create_subscription(JointState, 'joint_states', self._on_joint_states, 10)
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)

        self.move_group = ActionClient(self, MoveGroup, 'move_action')
        self.execute_traj = ActionClient(self, ExecuteTrajectory, 'execute_trajectory')
        self.cartesian = self.create_client(GetCartesianPath, 'compute_cartesian_path')
        self.fjt = ActionClient(self, FollowJointTrajectory, f"{self.p('controller')}/follow_joint_trajectory")
        self.nav = ActionClient(self, NavigateToPose, 'navigate_to_pose')
        self.cmd_pub = self.create_publisher(TwistStamped if self.p('stamped') else Twist, 'cmd_vel', 10)
        self.goal_pub = self.create_publisher(PoseStamped, 'goal_pose', 10)
        self._goal_handle = None
        self.status = lambda text: self.get_logger().info(text)   # replaced by the window

    # ---------- robot model ----------
    def _on_description(self, msg):
        try:
            root = ET.fromstring(msg.data)
        except ET.ParseError as e:
            self.get_logger().error(f'robot_description does not parse: {e}')
            return
        children = {j.find('child').get('link') for j in root.findall('joint')}
        links = [link.get('name') for link in root.findall('link')]
        roots = [name for name in links if name not in children]
        self.root_link = roots[0] if roots else 'base_link'
        joints = []
        for j in root.findall('joint'):
            kind = j.get('type')
            if kind not in ('revolute', 'continuous', 'prismatic') or j.find('mimic') is not None:
                continue
            lim = j.find('limit')
            lo, hi = (-math.pi, math.pi)
            if kind != 'continuous' and lim is not None:
                lo, hi = float(lim.get('lower', lo)), float(lim.get('upper', hi))
            joints.append((j.get('name'), lo, hi, kind == 'prismatic'))
        self.urdf_joints = joints

    def _on_joint_states(self, msg):
        for name, pos in zip(msg.name, msg.position):
            self.joint_positions[name] = pos

    def planning_frame(self):
        return self.p('planning_frame') or self.root_link

    def tool_pose(self, tip):
        """The tool's pose in the planning frame from TF, or None."""
        try:
            t = self.tf_buffer.lookup_transform(self.planning_frame(), tip, rclpy.time.Time())
        except Exception:  # noqa: BLE001 - TF not there yet
            return None
        tr, q = t.transform.translation, t.transform.rotation
        return (tr.x, tr.y, tr.z) + rpy_from_quaternion(q.x, q.y, q.z, q.w)

    # ---------- arms: MoveIt ----------
    def _request(self, vel, acc, time):
        r = MotionPlanRequest()
        r.group_name = self.p('planning_group')
        r.pipeline_id = self.p('pipeline_id')
        r.planner_id = self.p('planner_id')
        r.num_planning_attempts = 1
        r.allowed_planning_time = float(time)
        r.max_velocity_scaling_factor = float(vel)
        r.max_acceleration_scaling_factor = float(acc)
        r.start_state.is_diff = True
        r.workspace_parameters.header.frame_id = self.planning_frame()
        for c, v in (('min_corner', -2.0), ('max_corner', 2.0)):
            corner = getattr(r.workspace_parameters, c)
            corner.x = corner.y = corner.z = v
        return r

    def plan_pose(self, xyz, rpy_deg, tip, execute, vel=0.5, acc=0.5, time=5.0, cartesian=False):
        q = quaternion_from_rpy(*(a * D2R for a in rpy_deg))
        pose = Pose()
        pose.position.x, pose.position.y, pose.position.z = xyz
        pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w = q
        if cartesian:
            return self._cartesian(pose, tip, execute, vel, acc)
        frame = self.planning_frame()
        pc = PositionConstraint()
        pc.header.frame_id, pc.link_name, pc.weight = frame, tip, 1.0
        sphere = SolidPrimitive(type=SolidPrimitive.SPHERE, dimensions=[0.001])
        pc.constraint_region = BoundingVolume(primitives=[sphere], primitive_poses=[pose])
        oc = OrientationConstraint()
        oc.header.frame_id, oc.link_name, oc.weight = frame, tip, 1.0
        oc.orientation = pose.orientation
        oc.absolute_x_axis_tolerance = oc.absolute_y_axis_tolerance = oc.absolute_z_axis_tolerance = 0.01
        req = self._request(vel, acc, time)
        req.goal_constraints = [Constraints(position_constraints=[pc], orientation_constraints=[oc])]
        self._send_move_group(req, execute)

    def plan_joints(self, values, execute, vel=0.5, acc=0.5, time=5.0):
        req = self._request(vel, acc, time)
        req.goal_constraints = [Constraints(joint_constraints=[
            JointConstraint(joint_name=n, position=float(v), tolerance_above=0.001, tolerance_below=0.001, weight=1.0)
            for n, v in values.items()])]
        self._send_move_group(req, execute)

    def _send_move_group(self, req, execute):
        if not self.move_group.wait_for_server(timeout_sec=1.0):
            self.status('move_group is not running (/move_action). Start the MoveIt launch file first.')
            return
        goal = MoveGroup.Goal()
        goal.request = req
        goal.planning_options.plan_only = not execute
        goal.planning_options.planning_scene_diff.is_diff = True
        goal.planning_options.planning_scene_diff.robot_state.is_diff = True
        self.status('Planning ...')
        self.move_group.send_goal_async(goal).add_done_callback(self._on_move_group_accepted)

    def _on_move_group_accepted(self, future):
        handle = future.result()
        if not handle.accepted:
            self.status('move_group rejected the goal')
            return
        self._goal_handle = handle
        handle.get_result_async().add_done_callback(self._on_move_group_result)

    def _on_move_group_result(self, future):
        res = future.result().result
        code = res.error_code.val
        self.status('SUCCESS' if code == 1 else f'MoveIt error code {code} (see the move_group terminal)')

    def _cartesian(self, pose, tip, execute, vel, acc):
        if not self.cartesian.wait_for_service(timeout_sec=1.0):
            self.status('/compute_cartesian_path is not available (is move_group running?)')
            return
        req = GetCartesianPath.Request()
        req.header.frame_id = self.planning_frame()
        req.group_name, req.link_name = self.p('planning_group'), tip
        req.start_state.is_diff = True
        req.waypoints = [pose]
        req.max_step = 0.01
        req.avoid_collisions = True
        for name, value in (('max_velocity_scaling_factor', vel), ('max_acceleration_scaling_factor', acc)):
            if hasattr(req, name):        # added in later MoveIt 2 releases
                setattr(req, name, float(value))

        def done(future):
            r = future.result()
            self.status(f'Cartesian path: {r.fraction * 100:.0f} % of the way')
            if execute and r.fraction > 0.99 and self.execute_traj.wait_for_server(timeout_sec=1.0):
                goal = ExecuteTrajectory.Goal()
                goal.trajectory = r.solution
                self.execute_traj.send_goal_async(goal)
        self.cartesian.call_async(req).add_done_callback(done)

    def send_joint_trajectory(self, values, seconds):
        if not self.fjt.wait_for_server(timeout_sec=1.0):
            self.status(f"No action server {self.p('controller')}/follow_joint_trajectory")
            return
        goal = FollowJointTrajectory.Goal()
        traj = JointTrajectory()
        traj.joint_names = list(values.keys())
        pt = JointTrajectoryPoint(positions=[float(v) for v in values.values()])
        pt.time_from_start = DurationMsg(sec=int(seconds), nanosec=int((seconds % 1) * 1e9))
        traj.points = [pt]
        goal.trajectory = traj
        self.fjt.send_goal_async(goal)
        self.status(f"Trajectory sent to {self.p('controller')}")

    def cancel(self):
        if self._goal_handle is not None:
            self._goal_handle.cancel_goal_async()
            self._goal_handle = None
            self.status('Goal canceled')

    # ---------- bases ----------
    def navigate(self, x, y, z, yaw_deg):
        ps = PoseStamped()
        ps.header.frame_id = self.p('frame_id')
        ps.header.stamp = self.get_clock().now().to_msg()
        ps.pose.position.x, ps.pose.position.y, ps.pose.position.z = float(x), float(y), float(z)
        q = quaternion_from_rpy(0.0, 0.0, yaw_deg * D2R)
        ps.pose.orientation.x, ps.pose.orientation.y, ps.pose.orientation.z, ps.pose.orientation.w = q
        if not self.nav.wait_for_server(timeout_sec=1.0):
            self.goal_pub.publish(ps)
            self.status('No /navigate_to_pose server: published the goal on /goal_pose instead')
            return
        goal = NavigateToPose.Goal()
        goal.pose = ps
        self.status('Goal sent to /navigate_to_pose')
        self.nav.send_goal_async(goal).add_done_callback(self._on_move_group_accepted_nav)

    def _on_move_group_accepted_nav(self, future):
        handle = future.result()
        self._goal_handle = handle if handle.accepted else None
        if not handle.accepted:
            self.status('/navigate_to_pose rejected the goal')
            return
        handle.get_result_async().add_done_callback(lambda f: self.status(
            'Goal reached' if f.result().status == 4 else f'Goal ended with status {f.result().status}'))

    def publish_velocity(self, vx, vy, vz, wz):
        t = Twist()
        t.linear.x, t.linear.y, t.linear.z, t.angular.z = float(vx), float(vy), float(vz), float(wz)
        if self.p('stamped'):
            m = TwistStamped()
            m.header.stamp = self.get_clock().now().to_msg()
            m.header.frame_id = 'base_link'
            m.twist = t
            self.cmd_pub.publish(m)
        else:
            self.cmd_pub.publish(t)


def spin(label, lo, hi, step, decimals=3, value=0.0):
    s = QDoubleSpinBox()
    s.setRange(lo, hi)
    s.setSingleStep(step)
    s.setDecimals(decimals)
    s.setValue(value)
    s.setAccessibleName(label)
    return s


class GoalWindow(QWidget):

    def __init__(self, node):
        super().__init__()
        self.node = node
        self.setWindowTitle('Goal Pose')
        self.status = QLabel('')
        self.status.setWordWrap(True)
        node.status = self._status
        layout = QVBoxLayout(self)
        tabs = QTabWidget()
        layout.addWidget(tabs)
        layout.addWidget(self.status)
        kind = node.p('robot_type')
        if kind == 'arm':
            tabs.addTab(self._pose_tab(), 'Pose')
            tabs.addTab(self._joint_tab(), 'Joints')
        else:
            tabs.addTab(self._goal_tab(kind == 'drone'), 'Goal')
            tabs.addTab(self._velocity_tab(kind in ('holonomic', 'legged', 'drone'), kind == 'drone'), 'Velocity')
        self.resize(320, 480)

    def _status(self, text):
        self.status.setText(text)
        self.node.get_logger().info(text)

    # ----- arm: tool pose -----
    def _pose_tab(self):
        w = QWidget()
        form = QFormLayout(w)
        self.xyz = [spin(n, -5, 5, 0.01) for n in ('x', 'y', 'z')]
        self.rpy = [spin(n, -180, 180, 5, 1) for n in ('roll', 'pitch', 'yaw')]
        for n, s in zip(('x (m)', 'y (m)', 'z (m)'), self.xyz):
            form.addRow(n, s)
        for n, s in zip(('roll (deg)', 'pitch (deg)', 'yaw (deg)'), self.rpy):
            form.addRow(n, s)
        self.tip = QComboBox()
        self.tip.setEditable(True)
        self.tip.addItem(self.node.p('end_effector_link') or 'tool0')
        form.addRow('Tool link', self.tip)
        self.vel = spin('velocity scaling', 0.01, 1, 0.05, 2, 0.5)
        self.acc = spin('acceleration scaling', 0.01, 1, 0.05, 2, 0.5)
        form.addRow('Velocity scaling', self.vel)
        form.addRow('Acceleration scaling', self.acc)
        self.cart = QCheckBox('Cartesian path (straight line)')
        form.addRow(self.cart)
        row = QHBoxLayout()
        for text, fn in (('Use current', self._use_current), ('Plan', lambda: self._plan(False)),
                         ('Plan && Execute', lambda: self._plan(True)), ('Stop', self.node.cancel)):
            b = QPushButton(text)
            b.clicked.connect(fn)
            row.addWidget(b)
        form.addRow(row)
        return w

    def _use_current(self):
        p = self.node.tool_pose(self.tip.currentText())
        if p is None:
            self._status(f'No TF from {self.node.planning_frame()} to {self.tip.currentText()} yet')
            return
        for s, v in zip(self.xyz, p[:3]):
            s.setValue(v)
        for s, v in zip(self.rpy, p[3:]):
            s.setValue(v / D2R)

    def _plan(self, execute):
        self.node.plan_pose([s.value() for s in self.xyz], [s.value() for s in self.rpy], self.tip.currentText(),
                            execute, self.vel.value(), self.acc.value(), cartesian=self.cart.isChecked())

    # ----- arm: joints -----
    def _joint_tab(self):
        w = QWidget()
        outer = QVBoxLayout(w)
        self.joint_box = QVBoxLayout()
        holder = QWidget()
        holder.setLayout(self.joint_box)
        area = QScrollArea()
        area.setWidgetResizable(True)
        area.setWidget(holder)
        outer.addWidget(area)
        self.joint_spins = {}
        self.duration = spin('time', 0.5, 30, 0.5, 1, 3.0)
        row = QHBoxLayout()
        for text, fn in (('Load joints', self._load_joints), ('Use current', self._joints_current),
                         ('Plan && Execute', self._send_joints)):
            b = QPushButton(text)
            b.clicked.connect(fn)
            row.addWidget(b)
        outer.addWidget(QLabel('Time (s), without MoveIt'))
        outer.addWidget(self.duration)
        outer.addLayout(row)
        return w

    def _load_joints(self):
        while self.joint_box.count():
            item = self.joint_box.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        self.joint_spins = {}
        for name, lo, hi, prismatic in self.node.urdf_joints:
            s = spin(name, lo, hi, 0.005 if prismatic else 0.01)
            s.setValue(self.node.joint_positions.get(name, 0.0))
            slider = QSlider(Qt.Horizontal)
            slider.setRange(0, SLIDER_STEPS)
            span = (hi - lo) or 1.0
            slider.setValue(int((s.value() - lo) / span * SLIDER_STEPS))
            slider.valueChanged.connect(lambda v, s=s, lo=lo, span=span: s.setValue(lo + span * v / SLIDER_STEPS))
            self.joint_box.addWidget(QLabel(f'{name} ({"m" if prismatic else "rad"})'))
            self.joint_box.addWidget(s)
            self.joint_box.addWidget(slider)
            self.joint_spins[name] = s
        if not self.joint_spins:
            self._status('No /robot_description yet (is robot_state_publisher running?)')

    def _joints_current(self):
        for name, s in self.joint_spins.items():
            s.setValue(self.node.joint_positions.get(name, s.value()))

    def _send_joints(self):
        values = {n: s.value() for n, s in self.joint_spins.items()}
        if not values:
            self._status('Press Load joints first')
        elif self.node.p('use_moveit'):
            self.node.plan_joints(values, True)
        else:
            self.node.send_joint_trajectory(values, self.duration.value())

    # ----- bases -----
    def _goal_tab(self, fly):
        w = QWidget()
        form = QFormLayout(w)
        self.goal = {k: spin(k, -100, 100, 0.1) for k in ('x', 'y', 'z')}
        self.goal_yaw = spin('yaw', -180, 180, 5, 1)
        form.addRow('x (m)', self.goal['x'])
        form.addRow('y (m)', self.goal['y'])
        if fly:
            self.goal['z'].setValue(1.0)
            form.addRow('z (m)', self.goal['z'])
        form.addRow('yaw (deg)', self.goal_yaw)
        row = QHBoxLayout()
        go = QPushButton('Go')
        go.clicked.connect(lambda: self.node.navigate(self.goal['x'].value(), self.goal['y'].value(),
                                                      self.goal['z'].value() if fly else 0.0, self.goal_yaw.value()))
        cancel = QPushButton('Cancel goal')
        cancel.clicked.connect(self.node.cancel)
        row.addWidget(go)
        row.addWidget(cancel)
        form.addRow(row)
        return w

    def _velocity_tab(self, holonomic, fly):
        w = QWidget()
        form = QFormLayout(w)
        self.vel_sliders = {}
        lin, ang = self.node.p('max_linear'), self.node.p('max_angular')
        axes = [('linear.x', 'vx', lin)]
        axes += [('linear.y', 'vy', lin)] if holonomic else []
        axes += [('linear.z', 'vz', lin)] if fly else []
        axes += [('angular.z', 'wz', ang)]
        for label, key, top in axes:
            s = QSlider(Qt.Horizontal)
            s.setRange(-100, 100)
            s.setValue(0)
            self.vel_sliders[key] = (s, top)
            form.addRow(label, s)
        self.publishing = QCheckBox('Publish at 10 Hz')
        form.addRow(self.publishing)
        stop = QPushButton('Stop (all zero)')
        stop.clicked.connect(self._stop)
        form.addRow(stop)
        self.vel_timer = QTimer(self)
        self.vel_timer.timeout.connect(self._publish_velocity)
        self.vel_timer.start(100)
        return w

    def _value(self, key):
        if key not in self.vel_sliders:
            return 0.0
        s, top = self.vel_sliders[key]
        return s.value() / 100.0 * top

    def _publish_velocity(self):
        if self.publishing.isChecked():
            self.node.publish_velocity(self._value('vx'), self._value('vy'), self._value('vz'), self._value('wz'))

    def _stop(self):
        for s, _ in self.vel_sliders.values():
            s.setValue(0)
        self.node.publish_velocity(0, 0, 0, 0)


def main(args=None):
    rclpy.init(args=args)
    node = GoalNode()
    app = QApplication(sys.argv)
    window = GoalWindow(node)
    window.show()
    timer = QTimer()
    timer.timeout.connect(lambda: rclpy.spin_once(node, timeout_sec=0.0))
    timer.start(20)
    try:
        code = app.exec_()
    except KeyboardInterrupt:
        code = 0
    node.destroy_node()
    rclpy.try_shutdown()
    sys.exit(code)


if __name__ == '__main__':
    main()
