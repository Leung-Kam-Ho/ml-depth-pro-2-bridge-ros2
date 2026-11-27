#!/usr/bin/env bash
set -e

source /opt/ros/jazzy/setup.bash

if [ -f /app/.venv/bin/activate ]; then
    source /app/.venv/bin/activate
fi

if [ -f /app/install/setup.bash ]; then
    source /app/install/setup.bash
fi

exec "$@"