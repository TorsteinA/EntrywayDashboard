#!/usr/bin/env python3
import os
import sys
from PIL import Image

#Config & Paths
IMAGE_PATH = "/tmp/motion/current_room.jpg"
BACKLIGHT_PATH = "/sys/class/backlight/asus_laptop/brightness"
MAX_BRIGHTNESS_PATH = "/sys/class/backlight/asus_laptop/max_brightness"

# Calibration Values (0-255 greyscale)
Y_MIN = 10.0
Y_MAX = 180.0

# Backlight limits
MIN_BRIGHTNESS = 1
MAX_BRIGHTNESS = 15
MIN_BRIGHTNESS_PCT = 0.05
MAX_BRIGHTNESS_PCT = 1.00


def get_max_brightness():
        try:
                with open(MAX_BRIGHTNESS_PATH, "r") as f:
                        return int(f.read().strip())
        except Exception as e:
                print(f"Error reading max brightness: {e}")
                return 15

def compute_mean_luminance(image_path):
        if not os.path.exists(image_path):
                return None
        try:
                with Image.open(image_path) as img:
                        # Convert image to 8bit greyscale ('L')
                        grey = img.convert("L")
                        pixels = list(grey.getdata())
                        if not pixels:
                                return None
                        return sum(pixels) / len(pixels)
        except Exception as e:
                print(f"Error processing image: {e}")
                return None

def main():
        luminance = compute_mean_luminance(IMAGE_PATH)
        if luminance is None:
                sys.exit(0)

        max_hw = get_max_brightness()
        clamped_y = max(Y_MIN, min(Y_MAX, luminance))
        norm_y = (clamped_y - Y_MIN) / (Y_MAX - Y_MIN)
        curved_ratio = norm_y ** 2
        target_pct = MIN_BRIGHTNESS_PCT + (curved_ratio * (MAX_BRIGHTNESS_PCT - MIN_BRIGHTNESS_PCT))
        target_brightness = int(target_pct * max_hw)

        try:
                with open(BACKLIGHT_PATH, "w") as f:
                        f.write(str(target_brightness))
        except Exception as e:
                print(f"Error writing brightness {e}")

if __name__ == "__main__":
        main()

