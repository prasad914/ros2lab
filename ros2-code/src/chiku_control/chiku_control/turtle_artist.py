import rclpy
from rclpy.node import Node
from turtlesim.srv import Spawn, SetPen, TeleportAbsolute


class TurtleArtist(Node):
    """A client node: asks turtlesim to spawn a turtle, change its pen and teleport it."""

    def __init__(self):
        super().__init__('turtle_artist')
        self.spawn = self.create_client(Spawn, '/spawn')
        while not self.spawn.wait_for_service(timeout_sec=1.0):
            self.get_logger().info('waiting for /spawn ... is turtlesim running?')

    def call(self, client, request):
        future = client.call_async(request)                # send, do not block
        rclpy.spin_until_future_complete(self, future)     # wait here in main(), not in a callback
        return future.result()

    def draw_triangle(self):
        res = self.call(self.spawn, Spawn.Request(x=2.0, y=2.0, theta=0.0, name='artist'))
        self.get_logger().info(f'spawned {res.name}')
        pen = self.create_client(SetPen, '/artist/set_pen')
        tele = self.create_client(TeleportAbsolute, '/artist/teleport_absolute')
        pen.wait_for_service()
        tele.wait_for_service()
        self.call(pen, SetPen.Request(r=255, g=200, b=0, width=4, off=0))
        for x, y in [(8.0, 2.0), (5.0, 7.0), (2.0, 2.0)]:
            self.call(tele, TeleportAbsolute.Request(x=x, y=y, theta=0.0))
            self.get_logger().info(f'line to ({x}, {y})')


def main(args=None):
    rclpy.init(args=args)
    node = TurtleArtist()
    node.draw_triangle()
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
