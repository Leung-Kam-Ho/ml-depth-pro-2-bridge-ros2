# https://github.com/Tiryoh/docker-ros2-desktop-vnc
# Copyright 2020-2024 Tiryoh<tiryoh@gmail.com>
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# This Dockerfile is based on https://github.com/AtsushiSaito/docker-ubuntu-sweb
# which is released under the Apache-2.0 license.

FROM ubuntu:noble-20260410

ARG TARGETPLATFORM
ARG TARGETARCH
ARG QEMU_CPU

LABEL maintainer="Tiryoh<tiryoh@gmail.com>"

SHELL ["/bin/bash", "-c"]

RUN apt-get update -q && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        ubuntu-mate-desktop && \
    apt-get autoclean && \
    apt-get autoremove && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/share/glib-2.0/schemas/ && \
    printf "[org.mate.interface]\ngtk-theme='Yaru-bark-dark'\nicon-theme='Yaru-bark-dark'\n\n[org.mate.Marco.general]\ntheme='Yaru-bark-dark'\n\n[org.mate.screensaver]\nidle-activation-enabled=false\nlock-enabled=false\n\n[org.mate.power-manager]\nsleep-display-ac=0\nsleep-display-battery=0\nsleep-computer-ac=0\nsleep-computer-battery=0\n" > /usr/share/glib-2.0/schemas/99_mate-settings.gschema.override && \
    glib-compile-schemas /usr/share/glib-2.0/schemas/

RUN mkdir -p /root/.config/gtk-3.0 && \
    printf "[Settings]\ngtk-theme-name=Yaru-bark-dark\ngtk-icon-theme-name=Yaru-bark-dark\ngtk-application-prefer-dark-theme=1\n" > /root/.config/gtk-3.0/settings.ini

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        tigervnc-standalone-server tigervnc-common \
        supervisor wget curl gosu git sudo python3-full python3-pip \
        python-is-python3 tini \
        build-essential vim lsb-release locales \
        bash-completion tzdata terminator \
        qt6-gtk-platformtheme x11-xserver-utils && \
    apt-get autoclean && \
    apt-get autoremove && \
    rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/AtsushiSaito/noVNC.git -b add_clipboard_support /usr/lib/novnc && \
    python3 -m venv /opt/websockify-venv && \
    /opt/websockify-venv/bin/pip install --no-cache-dir git+https://github.com/novnc/websockify.git@v0.10.0 && \
    ln -s /usr/lib/novnc/vnc.html /usr/lib/novnc/index.html && \
    sed -i "s/UI.initSetting('resize', 'off');/UI.initSetting('resize', 'remote');/g" /usr/lib/novnc/app/ui.js

RUN sed -i 's/Prompt=.*/Prompt=never/' /etc/update-manager/release-upgrades && \
    sed -i 's/enabled=1/enabled=0/g' /etc/default/apport

ENV ROS_DISTRO=jazzy
ENV QT_QPA_PLATFORMTHEME=gtk3
ARG INSTALL_PACKAGE=desktop

RUN (apt-get update -q || true) && \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 \
        https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
        -o /usr/share/keyrings/ros-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/ros2.list > /dev/null && \
    (apt-get update -q || true) && \
    apt-get install -y \
    python3-argcomplete \
    python3-colcon-common-extensions \
    python3-rosdep python3-vcstool \
    libgirepository1.0-dev \
    libgtk2.0-dev \
    libcairo2-dev \
    libpcl-dev \
    pcl-tools \
    net-tools \
    libboost-all-dev \
    libeigen3-dev \
    libyaml-cpp-dev \
    libgtest-dev \
    pkg-config \
    python3-dev \
    gir1.2-glib-2.0 \
    ros-${ROS_DISTRO}-${INSTALL_PACKAGE} \
    ros-${ROS_DISTRO}-ros-gz \
    ros-${ROS_DISTRO}-joint-state-publisher \
    ros-${ROS_DISTRO}-pcl-ros \
    ros-${ROS_DISTRO}-pcl-conversions \
    ros-${ROS_DISTRO}-pcl-msgs \
    ros-${ROS_DISTRO}-rosbag2-py \
    ros-${ROS_DISTRO}-rqt-bag \
    ros-${ROS_DISTRO}-navigation2 \
    ros-${ROS_DISTRO}-nav2-bringup \
    ros-${ROS_DISTRO}-twist-mux \
    gnome-terminal && \
    rosdep init && \
    rosdep update && \
    apt-get autoclean && \
    apt-get autoremove && \
    rm -rf /var/lib/apt/lists/*

# The bag-splitting utility uses the ROS Python API. Ensure it is importable
# with the system interpreter used by ROS 2 (rather than an isolated venv).
RUN . /opt/ros/${ROS_DISTRO}/setup.bash && \
    /usr/bin/python3 -c "import rosbag2_py"

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml ./

# Install dependencies before copying the project source. The project itself
# needs README.md and src/ to be present for its setuptools build.
RUN uv venv --system-site-packages && uv sync --no-install-project

COPY . .

# Some RMW implementations report the recorded QoS history as UNKNOWN, which
# cannot be used to create rqt_bag's playback publishers.
RUN python3 docker/rviz2/patch_rqt_bag_qos.py

RUN find /app -type f -name "*.sh" -exec sed -i 's/\r$//' {} \; && \
    find /app -type f -name "*.sh" -exec chmod +x {} \;

# WORKDIR /app/src/unilidar_sdk/unitree_lidar_sdk
# RUN mkdir -p build && \
#     cd build && \
#     cmake .. && \
#     make -j2

# Return to ROS workspace root for colcon
# WORKDIR /app

# RUN . /opt/ros/jazzy/setup.sh && \
#     uv run python -m colcon build --packages-select asm_pkg control_pkg
RUN . /opt/ros/jazzy/setup.sh && \
    uv run python -m colcon build --packages-select serial --symlink-install

RUN . /opt/ros/jazzy/setup.sh && \
    uv run python -m colcon build --symlink-install 
#--packages-select unitree_lidar_ros2 point_lio unitree_lidar_sdk

RUN rm /etc/apt/apt.conf.d/docker-clean

COPY docker/rviz2/entrypoint.sh /
ENTRYPOINT [ "/bin/bash", "-c", "/entrypoint.sh" ]

ENV USER=ubuntu
ENV PASSWD=ubuntu
