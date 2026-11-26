from setuptools import setup

package_name = "depthpro2_bridge"

setup(
    name=package_name,
    version="0.1.0",
    packages=[package_name],
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
    ],
    install_requires=["setuptools", "numpy"],
    zip_safe=True,
    maintainer="Depth Pro 2 demo",
    maintainer_email="noreply@example.com",
    description="ROS 2 bridge for the Depth Pro 2 Mac demo",
    license="See repository LICENSE",
    entry_points={"console_scripts": ["bridge_node = depthpro2_bridge.bridge_node:main"]},
)
