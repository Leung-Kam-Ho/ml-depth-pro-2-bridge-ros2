"""Allow rqt_bag to play topics whose recorded QoS history is unknown."""

from pathlib import Path


player_files = list(
    Path('/opt/ros/jazzy/lib').glob('python*/site-packages/rqt_bag/player.py'))
if len(player_files) != 1:
    raise RuntimeError(f'Expected one rqt_bag player.py, found {player_files}')

player_file = player_files[0]
source = player_file.read_text()

old_import = 'from rclpy.qos import QoSProfile\n'
new_import = 'from rclpy.qos import QoSHistoryPolicy, QoSProfile\n'
old_qos = '            qos = convert_rclcpp_qos_to_rclpy_qos(rosbag2_qos)\n'
new_qos = old_qos + (
    '            # UNKNOWN history cannot be used to create a ROS publisher.\n'
    '            if qos.history == QoSHistoryPolicy.UNKNOWN:\n'
    '                qos.history = QoSHistoryPolicy.KEEP_LAST\n'
    '                if qos.depth <= 0:\n'
    '                    qos.depth = 10\n'
)

if source.count(old_import) != 1 or source.count(old_qos) != 1:
    raise RuntimeError(f'Unexpected rqt_bag player.py layout: {player_file}')

source = source.replace(old_import, new_import, 1)
source = source.replace(old_qos, new_qos, 1)
player_file.write_text(source)
