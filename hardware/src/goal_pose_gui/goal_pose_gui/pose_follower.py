"""pose_follower: drives a mobile, legged or flying robot to a goal pose, without Nav2.

Subscribes:  /goal_pose (geometry_msgs/PoseStamped)   -- e.g. RViz "2D Goal Pose", or the goal window
             /odom      (nav_msgs/Odometry)           -- where the robot is
Action:      /navigate_to_pose (nav2_msgs/action/NavigateToPose), the same interface as Nav2's bt_navigator
Publishes:   cmd_vel (geometry_msgs/Twist, or TwistStamped with -p stamped:=true for Jazzy's diff_drive_controller)

It is a simple proportional controller: no map and no obstacle avoidance. Use Nav2 for that.
"""
import math
import threading

import rclpy
from rclpy.action import ActionServer, CancelResponse, GoalResponse
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node

from geometry_msgs.msg import PoseStamped, Twist, TwistStamped
from nav_msgs.msg import Odometry
from nav2_msgs.action import NavigateToPose

from goal_pose_gui.geometry import FollowerGains, follower_command, rpy_from_quaternion

ROBOT_TYPES = {
    'diff': dict(max_linear=0.22, max_angular=1.5, holonomic=False, fly=False),
    'ackermann': dict(max_linear=0.6, max_angular=0.8, holonomic=False, fly=False, car=True),
    'holonomic': dict(max_linear=0.4, max_angular=1.2, holonomic=True, fly=False),
    'legged': dict(max_linear=0.5, max_angular=1.0, holonomic=True, fly=False),
    'drone': dict(max_linear=0.5, max_angular=1.0, holonomic=True, fly=True),
}


class PoseFollower(Node):

    def __init__(self):
        super().__init__('pose_follower')
        self.declare_parameter('robot_type', 'diff')          # diff, ackermann, holonomic, legged, drone
        self.declare_parameter('stamped', False)              # publish TwistStamped (Jazzy diff_drive_controller)
        self.declare_parameter('frame_id', 'base_link')       # header.frame_id of TwistStamped
        self.declare_parameter('rate', 20.0)                  # control rate (Hz)
        defaults = ROBOT_TYPES.get(self.get_parameter('robot_type').value, ROBOT_TYPES['diff'])
        for name in ('max_linear', 'max_angular'):
            self.declare_parameter(name, defaults[name])
        self.declare_parameter('xy_tolerance', 0.05)
        self.declare_parameter('yaw_tolerance', 0.05)
        self.declare_parameter('k_linear', 0.8)
        self.declare_parameter('k_angular', 2.0)
        self.declare_parameter('min_radius', 0.6)             # m: smallest turning radius (robot_type ackermann)
        self.declare_parameter('timeout', 120.0)              # s; a goal that takes longer is aborted

        self._stamped = bool(self.get_parameter('stamped').value)
        self._pub = self.create_publisher(TwistStamped if self._stamped else Twist, 'cmd_vel', 10)
        self._group = ReentrantCallbackGroup()
        self.create_subscription(Odometry, 'odom', self._on_odom, 10, callback_group=self._group)
        self.create_subscription(PoseStamped, 'goal_pose', self._on_goal_pose, 10, callback_group=self._group)
        self._server = ActionServer(self, NavigateToPose, 'navigate_to_pose', execute_callback=self._execute,
                                    goal_callback=self._accept, cancel_callback=lambda _: CancelResponse.ACCEPT,
                                    callback_group=self._group)
        self._lock = threading.Lock()
        self._pose = None           # (x, y, z, yaw) from /odom
        self._topic_goal = None     # a goal from /goal_pose (no action client waiting)
        self._aligning = False
        self._active_handle = None
        period = 1.0 / float(self.get_parameter('rate').value)
        self._timer = self.create_timer(period, self._on_timer, callback_group=self._group)
        self.get_logger().info(
            f"pose_follower ready ({self.get_parameter('robot_type').value}): /goal_pose and the "
            f"/navigate_to_pose action -> cmd_vel ({'TwistStamped' if self._stamped else 'Twist'})")

    # ---------- inputs ----------
    def _gains(self):
        p = lambda n: self.get_parameter(n).value  # noqa: E731
        kind = ROBOT_TYPES.get(p('robot_type'), ROBOT_TYPES['diff'])
        return FollowerGains(p('max_linear'), p('max_angular'), p('xy_tolerance'), p('yaw_tolerance'),
                             p('k_linear'), p('k_angular'), kind['holonomic'], kind['fly'],
                             kind.get('car', False), p('min_radius'))

    def _on_odom(self, msg):
        q = msg.pose.pose.orientation
        _, _, yaw = rpy_from_quaternion(q.x, q.y, q.z, q.w)
        p = msg.pose.pose.position
        with self._lock:
            self._pose = (p.x, p.y, p.z, yaw)

    @staticmethod
    def _goal_tuple(pose_stamped):
        q = pose_stamped.pose.orientation
        _, _, yaw = rpy_from_quaternion(q.x, q.y, q.z, q.w)
        p = pose_stamped.pose.position
        return (p.x, p.y, p.z, yaw)

    def _on_goal_pose(self, msg):
        if msg.header.frame_id not in ('', 'odom'):
            self.get_logger().warn(f"Goal frame '{msg.header.frame_id}' is used as odom (no TF lookup here)")
        with self._lock:
            self._topic_goal = self._goal_tuple(msg)
            self._aligning = False
        g = self._topic_goal
        self.get_logger().info(f'New goal from /goal_pose: x={g[0]:.2f}, y={g[1]:.2f}, yaw={g[3]:.2f} rad')

    def _accept(self, _goal_request):
        if self._pose is None:
            self.get_logger().warn('No /odom yet: goal rejected')
            return GoalResponse.REJECT
        return GoalResponse.ACCEPT

    # ---------- control ----------
    def _publish(self, vx, vy, vz, wz):
        t = Twist()
        t.linear.x, t.linear.y, t.linear.z, t.angular.z = float(vx), float(vy), float(vz), float(wz)
        if self._stamped:
            m = TwistStamped()
            m.header.stamp = self.get_clock().now().to_msg()
            m.header.frame_id = self.get_parameter('frame_id').value
            m.twist = t
            self._pub.publish(m)
        else:
            self._pub.publish(t)

    def _on_timer(self):
        # goals from /goal_pose are followed here; action goals run in _execute
        with self._lock:
            goal, pose = self._topic_goal, self._pose
        if goal is None or pose is None or self._active_handle is not None:
            return
        vx, vy, vz, wz, self._aligning, done = follower_command(pose, goal, self._gains(), self._aligning)
        self._publish(vx, vy, vz, wz)
        if done:
            with self._lock:
                self._topic_goal = None
            self.get_logger().info(f'Goal reached: x={pose[0]:.2f}, y={pose[1]:.2f}, yaw={pose[3]:.2f} rad')

    def _execute(self, handle):
        goal = self._goal_tuple(handle.request.pose)
        self.get_logger().info(f'NavigateToPose goal: x={goal[0]:.2f}, y={goal[1]:.2f}, yaw={goal[3]:.2f} rad')
        if self._active_handle is not None and self._active_handle.is_active:
            self._active_handle.abort()
        self._active_handle = handle
        with self._lock:
            self._topic_goal = None
        aligning = False
        start = self.get_clock().now()
        rate = self.create_rate(float(self.get_parameter('rate').value))
        feedback = NavigateToPose.Feedback()
        result = NavigateToPose.Result()
        try:
            while rclpy.ok():
                if handle.is_cancel_requested:
                    self._publish(0, 0, 0, 0)
                    handle.canceled()
                    return result
                if not handle.is_active:          # replaced by a newer goal
                    return result
                with self._lock:
                    pose = self._pose
                vx, vy, vz, wz, aligning, done = follower_command(pose, goal, self._gains(), aligning)
                self._publish(vx, vy, vz, wz)
                elapsed = (self.get_clock().now() - start).nanoseconds * 1e-9
                feedback.current_pose.header.frame_id = 'odom'
                feedback.current_pose.pose.position.x, feedback.current_pose.pose.position.y = pose[0], pose[1]
                feedback.distance_remaining = float(math.hypot(goal[0] - pose[0], goal[1] - pose[1]))
                feedback.navigation_time.sec = int(elapsed)
                handle.publish_feedback(feedback)
                if done:
                    handle.succeed()
                    self.get_logger().info('Goal reached')
                    return result
                if elapsed > float(self.get_parameter('timeout').value):
                    self._publish(0, 0, 0, 0)
                    result.error_code = 9  # NavigateToPose has only NONE=0 in Jazzy; a non-zero code marks a failure
                    result.error_msg = 'timeout'
                    handle.abort()
                    return result
                rate.sleep()
        finally:
            if self._active_handle is handle:
                self._active_handle = None
        return result


def main(args=None):
    rclpy.init(args=args)
    node = PoseFollower()
    executor = MultiThreadedExecutor(num_threads=3)
    executor.add_node(node)
    try:
        executor.spin()
    except KeyboardInterrupt:
        pass
    finally:
        node._publish(0, 0, 0, 0)
        node.destroy_node()
        rclpy.try_shutdown()


if __name__ == '__main__':
    main()
