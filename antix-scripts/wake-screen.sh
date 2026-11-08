#!/bin/bash
export DISPLAY=:0
export XAUTHORITY=/home/kiosk/.Xauthority

/usr/local/bin/update_brightness.py

echo "$(date '+%H:%M:%S') - wake_screen.sh executed by motion" >> /var/log/motion/motion_wakes.log
/usr/bin/xset dpms force on
/usr/bin/xdotool mousemove_relative -- 1 0
/usr/bin/xdotool mousemove_relative -- -1 0
