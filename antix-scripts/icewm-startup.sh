#!/bin/bash
#Check localization of Zzz File Manager:r:
if [ ! -f ~/.config/zzzfm/zzzfm_already_localized ]; then zzzfmlocalize ; fi

# ============
# My own stuff
# ============

xhost +local:

sleep 3

chmod 666 /sys/class/backlight/asus_laptop/brightness

# Disable X11 screen blanking, screen saver, and DPM timeouts initially
xset s off
xset s noblank
xset +dpms
xset dpms 30 30 30

# Hide the mouse cursor after 2 seconds of inactivity
unclutter -idle 2 -root &

# Suppress Chromium crash alertsand restore banners if unclean shutdown occurs
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/Default/Preferences 2>/dev/null
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences 2>/dev/null

# Launch Chromium in dedicated Kiosk mode
chromium \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disallow-screenshot-for-inhibit-screensaver \
  --disable-features=PowerInhibitManager \
  --disable-translate \
  --disable-features=Translate \
  --check-for-update-interval=31536000 \
  --overscroll-history-navigation=0 \
  "http://10.0.0.4:8181" &