import math

import rclpy
from nav_msgs.msg import Odometry
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data


class MotionTracker(Node):
    """Log linear displacement and yaw relative to the first odometry pose."""

    def __init__(self):
        super().__init__("motion_tracker")

        self.declare_parameter("odom_topic", "/odom")
        self.declare_parameter("log_period", 0.5)

        topic = self.get_parameter("odom_topic").value
        period = float(self.get_parameter("log_period").value)

        # RTAB-Map publishes /odom with best-effort reliability. A reliable
        # subscription is incompatible and would receive no messages.
        self.subscription = self.create_subscription(
            Odometry, topic, self._on_odom, qos_profile_sensor_data
        )
        self.timer = self.create_timer(period, self._log)

        self.start_position = None
        self.start_yaw = None
        self.last_position = None
        self.last_yaw = None
        self.horizontal_path = 0.0
        self.total_path = 0.0
        self.total_rotation = 0.0
        self.latest = None

        self.get_logger().info(
            f"Tracking {topic}; the first odometry message defines the start pose"
        )

    @staticmethod
    def _wrap(angle):
        return (angle + math.pi) % (2.0 * math.pi) - math.pi

    @staticmethod
    def _yaw(quaternion):
        x, y, z, w = (
            quaternion.x,
            quaternion.y,
            quaternion.z,
            quaternion.w,
        )
        norm = math.sqrt(x * x + y * y + z * z + w * w)
        if norm == 0.0:
            return 0.0
        x, y, z, w = x / norm, y / norm, z / norm, w / norm
        return math.atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z))

    def _on_odom(self, msg):
        position_msg = msg.pose.pose.position
        position = (position_msg.x, position_msg.y, position_msg.z)
        yaw = self._yaw(msg.pose.pose.orientation)

        if self.start_position is None:
            self.start_position = position
            self.start_yaw = yaw
            self.last_position = position
            self.last_yaw = yaw
            self.latest = {
                "horizontal": 0.0,
                "three_d": 0.0,
                "dz": 0.0,
                "yaw": yaw,
                "yaw_from_start": 0.0,
                "horizontal_path": 0.0,
                "total_path": 0.0,
                "total_rotation": 0.0,
            }
            return

        dx = position[0] - self.start_position[0]
        dy = position[1] - self.start_position[1]
        dz = position[2] - self.start_position[2]
        horizontal = math.hypot(dx, dy)
        three_d = math.sqrt(dx * dx + dy * dy + dz * dz)

        step_dx = position[0] - self.last_position[0]
        step_dy = position[1] - self.last_position[1]
        step_dz = position[2] - self.last_position[2]
        self.horizontal_path += math.hypot(step_dx, step_dy)
        self.total_path += math.sqrt(
            step_dx * step_dx + step_dy * step_dy + step_dz * step_dz
        )
        self.total_rotation += abs(self._wrap(yaw - self.last_yaw))

        self.latest = {
            "horizontal": horizontal,
            "three_d": three_d,
            "dz": dz,
            "yaw": yaw,
            "yaw_from_start": self._wrap(yaw - self.start_yaw),
            "horizontal_path": self.horizontal_path,
            "total_path": self.total_path,
            "total_rotation": self.total_rotation,
        }

        self.last_position = position
        self.last_yaw = yaw

    def _log(self):
        if self.latest is None:
            return

        data = self.latest
        self.get_logger().info(
            "displacement: horizontal={horizontal:.3f} m, "
            "3d={three_d:.3f} m, dz={dz:+.3f} m | "
            "yaw={yaw_deg:+.1f} deg, yaw from start={yaw_delta:+.1f} deg | "
            "path={path:.3f} m, rotation={rotation:.1f} deg".format(
                horizontal=data["horizontal"],
                three_d=data["three_d"],
                dz=data["dz"],
                yaw_deg=math.degrees(data["yaw"]),
                yaw_delta=math.degrees(data["yaw_from_start"]),
                path=data["horizontal_path"],
                rotation=math.degrees(data["total_rotation"]),
            )
        )


def main(args=None):
    rclpy.init(args=args)
    node = MotionTracker()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
