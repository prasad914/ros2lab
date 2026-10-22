#!/usr/bin/env python3
"""Tiny X11 driver for the RViz2 baseline: real mouse/keyboard events through XTest (ctypes, no xdotool) and
screenshots through Pillow. Usage (DISPLAY given as first argument):
  xctl.py :51 shot out.png [x y w h]
  xctl.py :51 click x y [button]          left click (button 1) by default; 3 = right click
  xctl.py :51 dclick x y                  double click
  xctl.py :51 drag x1 y1 x2 y2            press at (x1,y1), move in steps, release at (x2,y2)
  xctl.py :51 key ctrl+s                  key chord (names: X keysyms, e.g. Return, Tab, Escape, ctrl, shift, alt)
  xctl.py :51 type "some text"
  xctl.py :51 move x y
"""
import ctypes
import sys
import time

from PIL import ImageGrab

X11 = ctypes.cdll.LoadLibrary('libX11.so.6')
XT = ctypes.cdll.LoadLibrary('libXtst.so.6')
X11.XOpenDisplay.restype = ctypes.c_void_p
X11.XOpenDisplay.argtypes = [ctypes.c_char_p]
X11.XStringToKeysym.restype = ctypes.c_ulong
X11.XStringToKeysym.argtypes = [ctypes.c_char_p]
X11.XKeysymToKeycode.restype = ctypes.c_ubyte
X11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
X11.XFlush.argtypes = [ctypes.c_void_p]
X11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
XT.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
XT.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
XT.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]

ALIAS = {'ctrl': 'Control_L', 'shift': 'Shift_L', 'alt': 'Alt_L', 'enter': 'Return', 'esc': 'Escape', ' ': 'space'}
CHARS = {'.': 'period', '/': 'slash', '_': 'underscore', '-': 'minus', ':': 'colon', ' ': 'space', '*': 'asterisk',
         '[': 'bracketleft', ']': 'bracketright', '(': 'parenleft', ')': 'parenright', '|': 'bar', '^': 'asciicircum',
         '$': 'dollar', '=': 'equal', ',': 'comma', '+': 'plus', '?': 'question', '\\': 'backslash'}
SHIFTED = set('_:*()|^$+?') | set('ABCDEFGHIJKLMNOPQRSTUVWXYZ')


class X:
    def __init__(self, disp):
        self.disp = disp
        self.d = X11.XOpenDisplay(disp.encode())
        if not self.d:
            raise SystemExit(f'cannot open display {disp}')

    def sync(self):
        X11.XSync(self.d, 0)

    def move(self, x, y):
        XT.XTestFakeMotionEvent(self.d, -1, int(x), int(y), 0)
        self.sync()

    def button(self, b, down):
        XT.XTestFakeButtonEvent(self.d, b, 1 if down else 0, 0)
        self.sync()

    def click(self, x, y, b=1):
        self.move(x, y); time.sleep(0.15)
        self.button(b, True); time.sleep(0.08); self.button(b, False)

    def dclick(self, x, y):
        self.click(x, y); time.sleep(0.08); self.click(x, y)

    def drag(self, x1, y1, x2, y2, steps=20):
        self.move(x1, y1); time.sleep(0.2)
        self.button(1, True); time.sleep(0.2)
        for i in range(1, steps + 1):
            self.move(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); time.sleep(0.03)
        time.sleep(0.2)
        self.button(1, False)

    def code(self, name):
        ks = X11.XStringToKeysym(ALIAS.get(name, name).encode())
        return X11.XKeysymToKeycode(self.d, ks)

    def key(self, chord):
        names = chord.split('+') if chord != '+' else ['plus']
        codes = [self.code(n) for n in names]
        for c in codes:
            XT.XTestFakeKeyEvent(self.d, c, 1, 0); self.sync(); time.sleep(0.03)
        for c in reversed(codes):
            XT.XTestFakeKeyEvent(self.d, c, 0, 0); self.sync(); time.sleep(0.03)

    def type(self, text):
        for ch in text:
            name = CHARS.get(ch, ch)
            self.key(('shift+' if ch in SHIFTED else '') + name)
            time.sleep(0.02)

    def shot(self, out, box=None):
        im = ImageGrab.grab(xdisplay=self.disp)
        if box:
            x, y, w, h = box
            im = im.crop((x, y, x + w, y + h))
        im.save(out)


def main():
    disp, cmd, *a = sys.argv[1:]
    x = X(disp)
    if cmd == 'shot':
        x.shot(a[0], tuple(int(v) for v in a[1:5]) if len(a) >= 5 else None)
    elif cmd == 'click':
        x.click(int(a[0]), int(a[1]), int(a[2]) if len(a) > 2 else 1)
    elif cmd == 'dclick':
        x.dclick(int(a[0]), int(a[1]))
    elif cmd == 'drag':
        x.drag(*(int(v) for v in a[:4]))
    elif cmd == 'key':
        x.key(a[0])
    elif cmd == 'type':
        x.type(a[0])
    elif cmd == 'move':
        x.move(int(a[0]), int(a[1]))
    else:
        raise SystemExit(__doc__)


if __name__ == '__main__':
    main()
