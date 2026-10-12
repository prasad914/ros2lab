#!/usr/bin/env bash
# Compile the bridge firmware for the Arduino Mega 2560 with avr-g++ (no Arduino IDE needed):
#   firmware/test/build_mega.sh <robot_config.h> [Servo library folder]
# Needs: sudo apt install arduino-core-avr gcc-avr avr-libc ; the Servo library: git clone https://github.com/arduino-libraries/Servo
set -euo pipefail
CFG=$(readlink -f "$1"); SERVO=${2:-$HOME/Arduino/libraries/Servo}
HERE=$(cd "$(dirname "$0")/../ros2lab_bridge" && pwd)
CORE=/usr/share/arduino/hardware/arduino/avr
OUT=$(mktemp -d)
FLAGS="-mmcu=atmega2560 -DF_CPU=16000000L -DARDUINO=10819 -DARDUINO_AVR_MEGA2560 -DARDUINO_ARCH_AVR -Os -ffunction-sections -fdata-sections -Wall"
INC="-I$CORE/cores/arduino -I$CORE/variants/mega -I$CORE/libraries/Wire/src -I$CORE/libraries/Wire/src/utility -I$SERVO/src -I$OUT"
cp "$CFG" "$OUT/robot_config.h"
cp "$HERE"/*.h "$HERE"/actuators.cpp "$OUT/"
cp "$HERE/ros2lab_bridge.ino" "$OUT/sketch.cpp"
objs=()
for f in "$CORE"/cores/arduino/*.c; do avr-gcc $FLAGS $INC -c "$f" -o "$OUT/$(basename "$f").o"; objs+=("$OUT/$(basename "$f").o"); done
for f in "$CORE"/cores/arduino/*.cpp "$CORE"/libraries/Wire/src/Wire.cpp "$SERVO"/src/avr/Servo.cpp; do avr-g++ $FLAGS -std=gnu++11 -fno-exceptions -fno-threadsafe-statics $INC -c "$f" -o "$OUT/$(basename "$f").o"; objs+=("$OUT/$(basename "$f").o"); done
avr-gcc $FLAGS $INC -c "$CORE"/libraries/Wire/src/utility/twi.c -o "$OUT/twi.o"; objs+=("$OUT/twi.o")
for f in sketch.cpp actuators.cpp; do avr-g++ $FLAGS -std=gnu++11 -fno-exceptions -fno-threadsafe-statics -Wextra $INC -c "$OUT/$f" -o "$OUT/$f.o"; objs+=("$OUT/$f.o"); done
avr-gcc $FLAGS -Wl,--gc-sections "${objs[@]}" -o "$OUT/bridge.elf" -lm
avr-objcopy -O ihex -R .eeprom "$OUT/bridge.elf" "$OUT/bridge.hex"
avr-size --mcu=atmega2560 -C "$OUT/bridge.elf" | grep -E "Program|Data"
echo "hex: $OUT/bridge.hex"
