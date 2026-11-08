# antiX Kiosk Custom Scripts

This folder contains local backup copies of the custom configuration files and scripts used on the **ASUS UL30A Home Entry Kiosk**.

> **Note:** The files in this folder are manual copies of the live system files. They are not directly synced or symlinked to the running system and may fall out of sync if future modifications are made directly on the kiosk (though the current setup is stable).

## File Mapping

| Repository File        | Target System Location                            |
| :--------------------- | :------------------------------------------------ |
| `desktop-session.conf` | `~/.desktop-session/desktop-session.conf`         |
| `icewm-startup.sh`     | `~/.icewm/startup`                                |
| `motion-diffs.conf`    | `/etc/motion/motion.conf` _(modified directives)_ |
| `update-brightness.py` | `/usr/local/bin/update_brightness.py`             |
| `wake-screen.sh`       | `/usr/local/bin/wake_screen.sh`                   |
