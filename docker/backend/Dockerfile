# Use ROS 2 Jazzy (ros_base, multi-arch) as the base image.
# NOTE: osrf/ros:jazzy-desktop is published for linux/amd64 only, which breaks
# builds on arm64 hosts with "exec format error". The desktop metapackage is
# not needed here since all required ros-jazzy-* packages are apt-installed
# below, and the GUI lives in the separate rviz2 image.
FROM ros:jazzy

# Install system dependencies:
# - python3-pip / python3-dev: Python packages and compilation support
# - libgirepository / cairo / pkg-config / gir: Some GUI / Python binding dependencies
# - curl: General download utility
ENV ROS_DISTRO=jazzy
RUN (apt-get update || true) && apt-get install -y \
    python3-pip \
    libgirepository1.0-dev \
    libcairo2-dev \
    libpcl-dev \
    pcl-tools \
    net-tools \
    iputils-ping\
    libboost-all-dev \
    libeigen3-dev \
    libyaml-cpp-dev \
    libgtest-dev \
    pkg-config \
    python3-dev \
    gir1.2-glib-2.0 \
    curl \
    socat \
    ros-${ROS_DISTRO}-pcl-ros \
    ros-${ROS_DISTRO}-pcl-conversions \
    ros-${ROS_DISTRO}-pcl-msgs \
    ros-${ROS_DISTRO}-rqt-bag \
    ros-${ROS_DISTRO}-xacro \
    ros-${ROS_DISTRO}-cv-bridge \
    ros-${ROS_DISTRO}-ros2-control \
    ros-${ROS_DISTRO}-ros2-controllers \
    ros-${ROS_DISTRO}-ros-testing \
    ros-${ROS_DISTRO}-navigation2 \
    ros-${ROS_DISTRO}-nav2-bringup \
    ros-${ROS_DISTRO}-twist-mux \
    && rm -rf /var/lib/apt/lists/*

# Copy uv and uvx executables from the official uv image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# Copy only dependency files first to leverage Docker cache
# If pyproject.toml doesn't change, Docker can reuse this layer
COPY pyproject.toml ./

# Install dependencies first without building the local project. The source
# tree is copied below, after which `uv sync` can install the project itself.
RUN uv venv --system-site-packages && uv sync --no-install-project

# Copy the rest of the source code
COPY . .

# Install the local project now that its `src/` package tree is available.
RUN uv sync

# Convert all shell scripts to LF line endings to avoid Windows CRLF issues
# CRLF can cause errors like "/bin/bash^M" or "No such file or directory"
RUN find /app -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;

# Add execute permissions to all shell scripts
RUN find /app -type f -name "*.sh" -exec chmod +x {} \;

# WORKDIR /app/src/unilidar_sdk/unitree_lidar_sdk
# RUN mkdir -p build && \
#     cd build && \
#     cmake .. && \
#     make -j2

# # Return to ROS workspace root for colcon
# WORKDIR /app


# Build ROS 2 workspace
# Source ROS environment first, then run colcon build with uv
# RUN . /opt/ros/jazzy/setup.sh && \
#     uv run python -m colcon build --packages-select asm_pkg control_pkg
RUN . /opt/ros/jazzy/setup.sh && \
    uv run python -m colcon build --packages-select serial --symlink-install
RUN . /opt/ros/jazzy/setup.sh && \
    uv run python -m colcon build --symlink-install 
# --packages-select depthpro2_bridge pointcloud_to_laserscan slam_gmapping

COPY docker/backend/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
