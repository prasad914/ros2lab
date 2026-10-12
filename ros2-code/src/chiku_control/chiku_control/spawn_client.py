import rclpy
from rclpy.node import Node
from turtlesim.srv import Spawn


def main(args=None):
    rclpy.init(args=args)
    node = Node('spawn_client')                             # a plain node: no class of our own needed
    client = node.create_client(Spawn, '/spawn')            # 1. make a client for the /spawn service
    while not client.wait_for_service(timeout_sec=1.0):     # 2. wait until turtlesim offers it
        node.get_logger().info('waiting for /spawn ... is turtlesim running?')
    request = Spawn.Request()                               # 3. fill in the request
    request.x = 2.0
    request.y = 8.0
    request.theta = 0.0
    request.name = 'chiku2'
    future = client.call_async(request)                     # 4. send it (do not wait here)
    rclpy.spin_until_future_complete(node, future)          # 5. now wait for the answer
    node.get_logger().info(f'turtlesim made a turtle called {future.result().name}')
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
