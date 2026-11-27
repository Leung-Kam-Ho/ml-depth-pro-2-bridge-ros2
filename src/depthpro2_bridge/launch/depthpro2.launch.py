import os

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    host_arg = DeclareLaunchArgument(
        "host",
        default_value=os.environ.get("DEPTHPRO2_HOST", "host.docker.internal"),
        description="Host/IP running the Depth Pro 2 demo TCP stream.",
    )
    port_arg = DeclareLaunchArgument(
        "port",
        default_value="8766",
        description="TCP port of the Depth Pro 2 demo stream.",
    )
    frame_id_arg = DeclareLaunchArgument(
        "frame_id",
        default_value="camera_optical_frame",
        description="Frame ID for the published RGB/depth images and CameraInfo.",
    )
    point_frame_id_arg = DeclareLaunchArgument(
        "point_frame_id",
        default_value="camera_lidar_frame",
        description="Frame ID for the published point cloud.",
    )
    base_frame_arg = DeclareLaunchArgument(
        "base_frame",
        default_value="base_footprint",
        description="Robot base frame; RTAB-Map visual odometry publishes odom -> this frame.",
    )
    odom_frame_arg = DeclareLaunchArgument(
        "odom_frame",
        default_value="odom",
        description="Odometry frame used by the 2D GMapping fallback.",
    )
    base_parent_frame_arg = DeclareLaunchArgument(
        "base_parent_frame",
        default_value="imu_link",
        description=(
            "Parent frame for the optional static base_frame transform. RTAB-Map "
            "publishes real odometry, so keep publish_odom_tf:=false; this is only "
            "for static TF tests."
        ),
    )
    min_depth_arg = DeclareLaunchArgument(
        "min_depth",
        default_value="0.5",
        description="Near clip for depth points, in meters.",
    )
    max_depth_arg = DeclareLaunchArgument(
        "max_depth",
        default_value="15.0",
        description="Far clip for depth points, in meters.",
    )
    point_stride_arg = DeclareLaunchArgument(
        "point_stride",
        default_value="12",
        description="Sample every Nth pixel in each direction when building the cloud.",
    )
    point_rate_arg = DeclareLaunchArgument(
        "point_rate",
        default_value="30.0",
        description=(
            "Maximum point-cloud publish rate in Hz. Set 0 to publish every frame."
        ),
    )
    image_rate_arg = DeclareLaunchArgument(
        "image_rate",
        default_value="5.0",
        description=(
            "Maximum RGB/depth/camera-info publish rate in Hz. Set 0 to publish "
            "every streamed frame. Lower this if RTAB-Map odometry lags."
        ),
    )
    use_sim_time_arg = DeclareLaunchArgument(
        "use_sim_time",
        default_value="false",
        description="Use simulation time.",
    )
    publish_base_tf_arg = DeclareLaunchArgument(
        "publish_base_tf",
        default_value="true",
        description=(
            "Publish static base_frame -> point_frame_id TF. Set false if another "
            "node already publishes that transform."
        ),
    )
    publish_odom_tf_arg = DeclareLaunchArgument(
        "publish_odom_tf",
        default_value="false",
        description=(
            "Publish static base_parent_frame -> base_frame TF. Keep false with "
            "RTAB-Map because its visual odometry publishes odom -> base_frame; "
            "enable only for a static TF test."
        ),
    )

    bridge_node = Node(
        package="depthpro2_bridge",
        executable="bridge_node",
        name="depthpro2_bridge",
        output="screen",
        parameters=[
            {
                "use_sim_time": ParameterValue(
                    LaunchConfiguration("use_sim_time"), value_type=bool
                ),
                "host": LaunchConfiguration("host"),
                "port": ParameterValue(LaunchConfiguration("port"), value_type=int),
                "frame_id": LaunchConfiguration("frame_id"),
                "point_frame_id": LaunchConfiguration("point_frame_id"),
                "min_depth": ParameterValue(
                    LaunchConfiguration("min_depth"), value_type=float
                ),
                "max_depth": ParameterValue(
                    LaunchConfiguration("max_depth"), value_type=float
                ),
                "point_stride": ParameterValue(
                    LaunchConfiguration("point_stride"), value_type=int
                ),
                "point_rate": ParameterValue(
                    LaunchConfiguration("point_rate"), value_type=float
                ),
                "image_rate": ParameterValue(
                    LaunchConfiguration("image_rate"), value_type=float
                ),
            }
        ],
    )

    # The bridge itself only publishes camera_lidar_frame -> camera_optical_frame.
    # GMapping and RViz also need the cloud frame connected to the robot base.
    base_to_lidar_tf = Node(
        package="tf2_ros",
        executable="static_transform_publisher",
        name="base_to_camera_lidar_tf",
        output="screen",
        condition=IfCondition(LaunchConfiguration("publish_base_tf")),
        parameters=[
            {
                "use_sim_time": ParameterValue(
                    LaunchConfiguration("use_sim_time"), value_type=bool
                )
            }
        ],
        arguments=[
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            LaunchConfiguration("base_frame"),
            LaunchConfiguration("point_frame_id"),
        ],
    )

    base_parent_to_base_tf = Node(
        package="tf2_ros",
        executable="static_transform_publisher",
        name="base_parent_to_base_footprint_tf",
        output="screen",
        condition=IfCondition(LaunchConfiguration("publish_odom_tf")),
        parameters=[
            {
                "use_sim_time": ParameterValue(
                    LaunchConfiguration("use_sim_time"), value_type=bool
                )
            }
        ],
        arguments=[
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            LaunchConfiguration("base_parent_frame"),
            LaunchConfiguration("base_frame"),
        ],
    )

    return LaunchDescription([
        host_arg,
        port_arg,
        frame_id_arg,
        point_frame_id_arg,
        base_frame_arg,
        odom_frame_arg,
        base_parent_frame_arg,
        min_depth_arg,
        max_depth_arg,
        point_stride_arg,
        point_rate_arg,
        image_rate_arg,
        use_sim_time_arg,
        publish_base_tf_arg,
        publish_odom_tf_arg,
        bridge_node,
        base_to_lidar_tf,
        base_parent_to_base_tf,
    ])
