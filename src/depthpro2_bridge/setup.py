import os
from glob import glob
from setuptools import find_packages, setup

package_name = "depthpro2_bridge"

setup(
    name=package_name,
    version="0.1.0",
    packages=[package_name],
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
        (os.path.join('share', package_name, 'launch'), glob(os.path.join('launch', '*launch.[pxy][yma]*'))),
    ],
    install_requires=["setuptools", "numpy"],
    zip_safe=True,
    maintainer="Depth Pro 2 demo",
    maintainer_email="noreply@example.com",
    description="ROS 2 bridge for the Depth Pro 2 Mac demo",
    license="See repository LICENSE",
    entry_points={
        "console_scripts": [
            "bridge_node = depthpro2_bridge.bridge_node:main",
            "track_motion = depthpro2_bridge.track_motion:main",
            "rtabmap_autosave = depthpro2_bridge.rtabmap_autosave:main",
        ]
    },
)
