# <launch>
# 	<!-- Launch file for Velodyne16 VLP-16 LiDAR -->

# 	<arg name="rviz" default="true" />

# 	<node pkg="point_lio_unilidar" type="pointlio_mapping" name="laserMapping" output="screen">
# 		<rosparam command="load" file="$(find point_lio_unilidar)/config/unilidar_l2.yaml" />
		
# 		<!--change to 1 to use IMU as input of Point-LIO-->
# 		<param name="use_imu_as_input" type="bool" value="0"/>
		
# 		<param name="prop_at_freq_of_imu" type="bool" value="1"/>
# 		<param name="check_satu" type="bool" value="1"/>
# 		<param name="init_map_size" type="int" value="10"/>
# 		<param name="point_filter_num" type="int" value="1"/> <!--4, 3-->

# 		<param name="space_down_sample" type="bool" value="1" />
# 		<param name="filter_size_surf" type="double" value="0.1" /> <!--0.5, 0.3, 0.2, 0.15, 0.1-->
# 		<param name="filter_size_map" type="double" value="0.1" /> <!--0.5, 0.3, 0.15, 0.1-->
# 		<param name="cube_side_length" type="double" value="1000" /> <!--2000-->
# 		<param name="runtime_pos_log_enable" type="bool" value="0" /> <!--1-->
# 	</node>

# 	<group if="$(arg rviz)">
# 		<node launch-prefix="nice" pkg="rviz" type="rviz" name="rviz" args="-d $(find point_lio_unilidar)/rviz_cfg/loam_livox.rviz" />
# 	</group> launch-prefix="gdb -ex run --args"

# </launch>
from launch import LaunchDescription
from launch.actions import GroupAction, DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    # Declare the RViz argument
    rviz_arg = DeclareLaunchArgument(
        'rviz', default_value='true',
        description='Flag to launch RViz.')

    # Point-LIO subtracts this from IMU stamps. For the same physical instant,
    # time_lag = imu_stamp - camera_stamp. Start at 0 and measure the real delay
    # before changing it; a guessed 0.1 s is several frames at 30 Hz.
    time_lag_arg = DeclareLaunchArgument(
        'time_lag_imu_to_lidar', default_value='0.00',
        description='IMU-to-camera timestamp offset in seconds (Point-LIO subtracts it from IMU stamps).')

    bridge_min_depth_arg = DeclareLaunchArgument(
        'min_depth', default_value='0.5',
        description='Bridge near clip; must match preprocess.blind in depthpro2.yaml.')
    bridge_max_depth_arg = DeclareLaunchArgument(
        'max_depth', default_value='5.0',
        description='Bridge far clip; must match mapping.det_range in depthpro2.yaml.')
    point_stride_arg = DeclareLaunchArgument(
        'point_stride', default_value='5',
        description='Pixel stride for depth points; lower gives denser clouds and more stable planes.')
    point_rate_arg = DeclareLaunchArgument(
        'point_rate', default_value='20.0',
        description='Maximum point-cloud publish rate in Hz.')
    lidar_meas_cov_arg = DeclareLaunchArgument(
        'lidar_meas_cov', default_value='0.5',
        description='Scalar measurement noise for ML-derived depth points; higher trusts them less.')

    laser_mapping_params = [
        PathJoinSubstitution([
            FindPackageShare('point_lio'),
            'config', 'depthpro2.yaml'
        ]),
        {
            'use_imu_as_input': True,  # Change to True to use IMU as input of Point-LIO
            'prop_at_freq_of_imu': True,  # True to propagate at IMU frequency; False to propagate at depth-frame frequency
            'check_satu': True,
            'init_map_size': 10,
            'point_filter_num': 1,  # ignored by lidar_type 5; density is set by the bridge's point_stride
            'space_down_sample': True,
            'filter_size_surf': 0.1,
            'filter_size_map': 0.1,
            'cube_side_length': 100.0,  # > 2 * 1.5 * det_range (10 m)
            'runtime_pos_log_enable': False,  # True requires ROOT_DIR/Log/ to exist; otherwise pointlio_mapping segfaults
            'common.time_lag_imu_to_lidar': ParameterValue(
                LaunchConfiguration('time_lag_imu_to_lidar'), value_type=float),
            'mapping.lidar_meas_cov': ParameterValue(
                LaunchConfiguration('lidar_meas_cov'), value_type=float),
        }
    ]

    # Node definition for laserMapping with Point-LIO
    laser_mapping_node = Node(
        package='point_lio',
        executable='pointlio_mapping',
        name='laserMapping',
        output='screen',
        parameters=laser_mapping_params,
        # prefix='gdb -ex run --args'
    )
    
    depthpro2_bridge_node = Node(
        package='depthpro2_bridge',
        executable='bridge_node',
        name='depthpro2_bridge',
        parameters=[{
            'host': 'host.docker.internal',
            'port': 8766,
            'min_depth': ParameterValue(LaunchConfiguration('min_depth'), value_type=float),
            'max_depth': ParameterValue(LaunchConfiguration('max_depth'), value_type=float),
            'point_stride': ParameterValue(LaunchConfiguration('point_stride'), value_type=int),
            'point_rate': ParameterValue(LaunchConfiguration('point_rate'), value_type=float),
        }],
    )

    # Conditional RViz node launch
    rviz_node = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz',
        arguments=['-d', PathJoinSubstitution([
            FindPackageShare('point_lio'),
            'rviz_cfg', 'loam_livox.rviz'
        ])],
        condition=IfCondition(LaunchConfiguration('rviz')),
        prefix='nice'
    )

    # Assemble the launch description
    ld = LaunchDescription([
        rviz_arg,
        time_lag_arg,
        bridge_min_depth_arg,
        bridge_max_depth_arg,
        point_stride_arg,
        point_rate_arg,
        lidar_meas_cov_arg,
        laser_mapping_node,
        depthpro2_bridge_node,
        GroupAction(
            actions=[rviz_node],
            condition=IfCondition(LaunchConfiguration('rviz'))
        ),
    ])

    return ld
