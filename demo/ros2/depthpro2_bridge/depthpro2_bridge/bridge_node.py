#!/usr/bin/env python3
"""Receive the demo's TCP RGB-D stream and publish standard ROS 2 messages."""

import json
import queue
import socket
import struct
import threading
import time

import numpy as np
import rclpy
from rclpy.node import Node
from rclpy.qos import (
    QoSHistoryPolicy,
    QoSProfile,
    QoSReliabilityPolicy,
    qos_profile_sensor_data,
)
from sensor_msgs.msg import CameraInfo, Image, PointCloud2, PointField


MAX_FRAME_BYTES = 64 * 1024 * 1024
POINT_DTYPE = np.dtype(
    {
        "names": ["x", "y", "z", "r", "g", "b", "padding"],
        "formats": ["<f4", "<f4", "<f4", "u1", "u1", "u1", "u1"],
        "offsets": [0, 4, 8, 12, 13, 14, 15],
        "itemsize": 16,
    }
)


def recv_exact(sock, size):
    chunks = bytearray()
    while len(chunks) < size:
        chunk = sock.recv(size - len(chunks))
        if not chunk:
            raise ConnectionError("demo closed the frame stream")
        chunks.extend(chunk)
    return bytes(chunks)


class DepthPro2Bridge(Node):
    def __init__(self):
        super().__init__("depthpro2_bridge")
        self.declare_parameter("host", "127.0.0.1")
        self.declare_parameter("port", 8766)
        self.declare_parameter("frame_id", "camera_optical_frame")
        self.declare_parameter("min_depth", 0.1)
        self.declare_parameter("max_depth", 100.0)
        self.declare_parameter("point_stride", 3)
        self.declare_parameter("point_rate", 10.0)
        self.declare_parameter("depth_topic", "/depthpro2/depth/image")
        self.declare_parameter("rgb_topic", "/depthpro2/rgb/image")
        self.declare_parameter("camera_info_topic", "/depthpro2/camera_info")
        self.declare_parameter("points_topic", "/depthpro2/points")

        self.host = self.get_parameter("host").value
        self.port = int(self.get_parameter("port").value)
        self.frame_id = self.get_parameter("frame_id").value
        self.min_depth = float(self.get_parameter("min_depth").value)
        self.max_depth = float(self.get_parameter("max_depth").value)
        self.point_stride = max(1, int(self.get_parameter("point_stride").value))
        self.point_rate = max(0.1, float(self.get_parameter("point_rate").value))
        self.last_point_publish = 0.0
        # RViz's CameraInfo and PointCloud2 subscribers commonly request reliable delivery.
        # Sensor-data QoS is best-effort and is incompatible with those subscriptions.
        point_qos = QoSProfile(
            history=QoSHistoryPolicy.KEEP_LAST,
            depth=1,
            reliability=QoSReliabilityPolicy.RELIABLE,
        )
        self.depth_pub = self.create_publisher(
            Image, self.get_parameter("depth_topic").value, qos_profile_sensor_data
        )
        self.rgb_pub = self.create_publisher(
            Image, self.get_parameter("rgb_topic").value, qos_profile_sensor_data
        )
        self.info_pub = self.create_publisher(
            CameraInfo, self.get_parameter("camera_info_topic").value, point_qos
        )
        self.points_pub = self.create_publisher(
            PointCloud2, self.get_parameter("points_topic").value, point_qos
        )

        self.frames = queue.Queue(maxsize=1)
        self.stop_event = threading.Event()
        self.socket_lock = threading.Lock()
        self.stream_socket = None
        self.reader = threading.Thread(target=self._read_stream, name="depthpro2-stream", daemon=True)
        self.reader.start()
        self.timer = self.create_timer(0.01, self._publish_latest)
        self.get_logger().info(f"Connecting to Depth Pro 2 stream at {self.host}:{self.port}")

    def _read_stream(self):
        while not self.stop_event.is_set():
            try:
                with socket.create_connection((self.host, self.port), timeout=3.0) as sock:
                    sock.settimeout(None)
                    with self.socket_lock:
                        self.stream_socket = sock
                    self.get_logger().info("Connected to the Mac frame stream")
                    while not self.stop_event.is_set():
                        frame = self._read_frame(sock)
                        try:
                            self.frames.put_nowait(frame)
                        except queue.Full:
                            try:
                                self.frames.get_nowait()
                            except queue.Empty:
                                pass
                            self.frames.put_nowait(frame)
                    with self.socket_lock:
                        self.stream_socket = None
            except (OSError, ConnectionError, ValueError, KeyError, json.JSONDecodeError) as error:
                with self.socket_lock:
                    self.stream_socket = None
                if not self.stop_event.is_set():
                    self.get_logger().warning(f"Frame stream unavailable ({error}); retrying in 1 s")
                    self.stop_event.wait(1.0)

    @staticmethod
    def _read_frame(sock):
        packet_size = struct.unpack("!I", recv_exact(sock, 4))[0]
        if packet_size < 4 or packet_size > MAX_FRAME_BYTES:
            raise ValueError(f"invalid packet size: {packet_size}")
        packet = recv_exact(sock, packet_size)
        header_size = struct.unpack("!I", packet[:4])[0]
        if header_size <= 0 or header_size > len(packet) - 4:
            raise ValueError("invalid frame metadata size")
        header = json.loads(packet[4 : 4 + header_size])
        width, height = int(header["width"]), int(header["height"])
        if width <= 0 or height <= 0 or width * height > 16_000_000:
            raise ValueError("invalid frame dimensions")
        start = 4 + header_size
        pixels = width * height
        expected = start + pixels * 3 + pixels * 4
        if expected != len(packet):
            raise ValueError("frame payload size does not match its dimensions")
        rgb = np.frombuffer(packet, dtype=np.uint8, count=pixels * 3, offset=start).reshape(height, width, 3).copy()
        depth = np.frombuffer(packet, dtype="<f4", count=pixels, offset=start + pixels * 3).reshape(height, width).copy()
        return header, rgb, depth

    def _publish_latest(self):
        try:
            header, rgb, depth = self.frames.get_nowait()
        except queue.Empty:
            return

        height, width = depth.shape
        fx, fy = float(header["fx"]), float(header["fy"])
        cx, cy = float(header["cx"]), float(header["cy"])
        if not all(np.isfinite(value) for value in (fx, fy, cx, cy)) or fx <= 0 or fy <= 0:
            self.get_logger().warning("Invalid camera intrinsics in frame; dropping it")
            return

        stamp = self.get_clock().now().to_msg()
        frame_id = self.frame_id or header.get("frame_id", "camera_optical_frame")
        image_header = self._header(stamp, frame_id)

        depth_msg = Image()
        depth_msg.header = image_header
        depth_msg.height = height
        depth_msg.width = width
        depth_msg.encoding = "32FC1"
        depth_msg.is_bigendian = 0
        depth_msg.step = width * 4
        depth_msg.data = np.asarray(depth, dtype="<f4").tobytes()
        self.depth_pub.publish(depth_msg)

        rgb_msg = Image()
        rgb_msg.header = image_header
        rgb_msg.height = height
        rgb_msg.width = width
        rgb_msg.encoding = "rgb8"
        rgb_msg.is_bigendian = 0
        rgb_msg.step = width * 3
        rgb_msg.data = rgb.tobytes()
        self.rgb_pub.publish(rgb_msg)

        info = CameraInfo()
        info.header = image_header
        info.height = height
        info.width = width
        info.distortion_model = "plumb_bob"
        info.d = [0.0] * 5
        info.k = [fx, 0.0, cx, 0.0, fy, cy, 0.0, 0.0, 1.0]
        info.r = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]
        info.p = [fx, 0.0, cx, 0.0, 0.0, fy, cy, 0.0, 0.0, 0.0, 1.0, 0.0]
        self.info_pub.publish(info)
        now = time.monotonic()
        if now - self.last_point_publish >= 1.0 / self.point_rate:
            self.points_pub.publish(self._point_cloud(image_header, rgb, depth, fx, fy, cx, cy))
            self.last_point_publish = now

    @staticmethod
    def _header(stamp, frame_id):
        from std_msgs.msg import Header

        header = Header()
        header.stamp = stamp
        header.frame_id = frame_id
        return header

    def _point_cloud(self, header, rgb, depth, fx, fy, cx, cy):
        stride = self.point_stride
        sampled_depth = depth[::stride, ::stride]
        sampled_rgb = rgb[::stride, ::stride]
        valid = (
            np.isfinite(sampled_depth)
            & (sampled_depth >= self.min_depth)
            & (sampled_depth <= self.max_depth)
            & (sampled_depth > 0)
        )
        rows, cols = np.nonzero(valid)
        z = sampled_depth[rows, cols].astype(np.float32, copy=False)
        points = np.empty(z.size, dtype=POINT_DTYPE)
        points["x"] = (cols.astype(np.float32) * stride - cx) * z / fx
        points["y"] = (rows.astype(np.float32) * stride - cy) * z / fy
        points["z"] = z
        colors = sampled_rgb[rows, cols]
        points["r"], points["g"], points["b"] = colors[:, 0], colors[:, 1], colors[:, 2]
        points["padding"] = 0

        cloud = PointCloud2()
        cloud.header = header
        cloud.height = 1
        cloud.width = int(z.size)
        cloud.fields = [
            PointField(name="x", offset=0, datatype=PointField.FLOAT32, count=1),
            PointField(name="y", offset=4, datatype=PointField.FLOAT32, count=1),
            PointField(name="z", offset=8, datatype=PointField.FLOAT32, count=1),
            PointField(name="r", offset=12, datatype=PointField.UINT8, count=1),
            PointField(name="g", offset=13, datatype=PointField.UINT8, count=1),
            PointField(name="b", offset=14, datatype=PointField.UINT8, count=1),
        ]
        cloud.is_bigendian = False
        cloud.point_step = POINT_DTYPE.itemsize
        cloud.row_step = cloud.point_step * cloud.width
        cloud.is_dense = True
        cloud.data = points.tobytes()
        return cloud

    def destroy_node(self):
        self.stop_event.set()
        with self.socket_lock:
            if self.stream_socket is not None:
                try:
                    self.stream_socket.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                self.stream_socket.close()
                self.stream_socket = None
        return super().destroy_node()


def main(args=None):
    rclpy.init(args=args)
    node = DepthPro2Bridge()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.stop_event.set()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
