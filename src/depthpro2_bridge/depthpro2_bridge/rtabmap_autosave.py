"""Run RTAB-Map and export the assembled cloud when interrupted.

Press Ctrl+C in the RTAB-Map terminal. The launch is stopped cleanly, then the
RTAB-Map database is exported to ``maps/`` in the mounted repository. Both the
original PLY and a PCD conversion are written.
"""

import argparse
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

DEFAULT_LAUNCH_ARGS = [
    "rtabmap.launch.py",
    "rtabmap_args:=--delete_db_on_start --Rtabmap/DetectionRate 1 --Kp/MaxFeatures 300",
    "rgb_topic:=/depthpro2/rgb/image",
    "depth_topic:=/depthpro2/depth/image",
    "camera_info_topic:=/depthpro2/camera_info",
    "frame_id:=base_footprint",
    "odom_topic:=/odom",
    "vo_frame_id:=odom",
    "map_topic:=/map",
    "approx_sync:=true",
    "approx_sync_max_interval:=0.5",
    "qos:=2",
    "queue_size:=20",
    "topic_queue_size:=10",
    "odom_args:=--Odom/ImageDecimation 2 --Kp/MaxFeatures 300",
    "rtabmapviz:=true",
    "rviz:=false",
    "use_sim_time:=false",
]


def default_output_dir():
    """Use the host-mounted maps/ directory when running in the container."""
    if Path("/app").is_dir():
        return Path("/app/maps")
    return Path.home() / "maps"


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db",
        default=os.environ.get("RTABMAP_DB", str(Path.home() / ".ros/rtabmap.db")),
        help="RTAB-Map database to export (default: ~/.ros/rtabmap.db).",
    )
    parser.add_argument(
        "--output-dir",
        default=os.environ.get("RTABMAP_MAP_DIR", str(default_output_dir())),
        help="Directory for the exported cloud (default: /app/maps in Docker).",
    )
    parser.add_argument(
        "--name",
        default=None,
        help="Base filename. Defaults to a timestamped depthpro2_map_* name.",
    )
    parser.add_argument("--voxel", default="0.02", help="Export voxel size in meters.")
    parser.add_argument(
        "--decimation", default="2", help="Depth image decimation used for export."
    )
    parser.add_argument(
        "--no-pcd",
        action="store_true",
        help="Keep the PLY but skip the pcl_ply2pcd conversion.",
    )
    parser.add_argument(
        "launch_args",
        nargs=argparse.REMAINDER,
        help="Optional replacement arguments for 'ros2 launch rtabmap_launch'.",
    )
    args = parser.parse_args(argv)
    if args.launch_args and args.launch_args[0] == "--":
        args.launch_args = args.launch_args[1:]
    if not args.launch_args:
        args.launch_args = list(DEFAULT_LAUNCH_ARGS)
    return args


class RtabmapAutoSaver:
    def __init__(self, args):
        self.args = args
        self.proc = None
        self.stopping = False
        signal.signal(signal.SIGINT, self._on_signal)
        signal.signal(signal.SIGTERM, self._on_signal)

    def _nudge_child(self, signum):
        # Ctrl+C in the terminal already signals the whole foreground group.
        # Only forward it if RTAB-Map is still alive after a short grace period.
        if self.proc is not None and self.proc.poll() is None:
            try:
                self.proc.send_signal(signum)
            except ProcessLookupError:
                pass

    def _on_signal(self, signum, _frame):
        if self.stopping:
            return
        self.stopping = True
        print(
            "\n[rtabmap_autosave] Interrupt received; stopping RTAB-Map and saving once...",
            flush=True,
        )
        timer = threading.Timer(0.5, self._nudge_child, args=(signum,))
        timer.daemon = True
        timer.start()

    def run(self):
        if self.stopping:
            return 0

        command = ["ros2", "launch", "rtabmap_launch", *self.args.launch_args]
        print("[rtabmap_autosave] Starting: " + " ".join(command), flush=True)
        print(
            "[rtabmap_autosave] Press Ctrl+C here to export the map to "
            f"{self.args.output_dir}",
            flush=True,
        )

        self.proc = subprocess.Popen(command)
        return_code = self.proc.wait()

        if not self.stopping:
            print(
                "[rtabmap_autosave] RTAB-Map exited without an interrupt; "
                "no export performed.",
                flush=True,
            )
            return return_code

        # Give the RTAB-Map node a moment to close and flush the database.
        time.sleep(2.0)
        return self.export()

    def export(self):
        db = Path(self.args.db).expanduser()
        if not db.is_file():
            print(f"[rtabmap_autosave] Database not found: {db}", flush=True)
            return 1

        output_dir = Path(self.args.output_dir).expanduser()
        output_dir.mkdir(parents=True, exist_ok=True)
        base = self.args.name or "depthpro2_map_" + datetime.now().strftime(
            "%Y%m%d_%H%M%S"
        )
        ply = output_dir / f"{base}_cloud.ply"
        pcd = output_dir / f"{base}_cloud.pcd"

        export_cmd = [
            "rtabmap-export",
            "--cloud",
            "--voxel",
            self.args.voxel,
            "--decimation",
            self.args.decimation,
            "--output_dir",
            str(output_dir),
            "--output",
            base,
            str(db),
        ]
        print("[rtabmap_autosave] Exporting: " + " ".join(export_cmd), flush=True)
        try:
            subprocess.run(export_cmd, check=True)
        except (FileNotFoundError, subprocess.CalledProcessError) as error:
            print(f"[rtabmap_autosave] rtabmap-export failed: {error}", flush=True)
            return 1

        if not ply.is_file():
            print(f"[rtabmap_autosave] Expected PLY was not created: {ply}", flush=True)
            return 1

        if not self.args.no_pcd:
            convert_cmd = ["pcl_ply2pcd", "-format", "0", str(ply), str(pcd)]
            try:
                subprocess.run(convert_cmd, check=True)
            except (FileNotFoundError, subprocess.CalledProcessError) as error:
                print(f"[rtabmap_autosave] PCD conversion failed: {error}", flush=True)
                return 1
            print(f"[rtabmap_autosave] Saved PCD: {pcd}", flush=True)

        print(f"[rtabmap_autosave] Saved PLY: {ply}", flush=True)
        return 0


def main(argv=None):
    return RtabmapAutoSaver(parse_args(argv)).run()


if __name__ == "__main__":
    sys.exit(main())
