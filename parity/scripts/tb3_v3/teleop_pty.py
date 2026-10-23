#!/usr/bin/env python3
"""Run `ros2 run turtlebot3_teleop teleop_keyboard` on a pseudo-terminal and type keys into it, like a student.
Usage: teleop_pty.py --keys "wwwww" --hold 6 --log out.txt [--stop s]
Types each key 0.3 s apart, waits --hold wall seconds (the robot drives), types --stop, waits 2 s, then Ctrl+C.
The program's terminal output goes to --log."""
import argparse, os, pty, select, signal, subprocess, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--keys', default='wwwww'); ap.add_argument('--hold', type=float, default=6.0)
ap.add_argument('--stop', default='s'); ap.add_argument('--log', required=True)
a = ap.parse_args()
master, slave = pty.openpty()
p = subprocess.Popen(['ros2', 'run', 'turtlebot3_teleop', 'teleop_keyboard'], stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
os.close(slave)
out = bytearray()
def pump(secs):
    end = time.time() + secs
    while time.time() < end:
        r, _, _ = select.select([master], [], [], 0.05)
        if r:
            try: out.extend(os.read(master, 4096))
            except OSError: return
pump(3.0)
for k in a.keys:
    os.write(master, k.encode()); pump(0.3)
pump(a.hold)
for k in a.stop:
    os.write(master, k.encode()); pump(0.3)
pump(2.0)
os.write(master, b'\x03'); pump(2.0)
try: os.killpg(p.pid, signal.SIGINT)
except ProcessLookupError: pass
try: p.wait(5)
except subprocess.TimeoutExpired: os.killpg(p.pid, signal.SIGKILL)
open(a.log, 'wb').write(bytes(out))
print(f'exit={p.returncode} bytes={len(out)}')
