#!/usr/bin/env python3
"""Write an .rviz config = rviz_common/default.rviz with its Displays list replaced by one entry per display class
(Class + Name + Enabled only, every other property left to RViz's defaults). Loading it in rviz2 and saving
(Ctrl+S) writes every display's full default property tree.
Usage: make_all_displays_rviz.py <out.rviz> <fixed frame> <Class> [<Class> ...]   (Class like rviz_default_plugins/Grid)
"""
import sys

src = open('/opt/ros/jazzy/share/rviz_common/default.rviz').read()
out, frame, classes = sys.argv[1], sys.argv[2], sys.argv[3:]
head, rest = src.split('  Displays:\n', 1)
_, tail = rest.split('  Enabled: true\n  Global Options:', 1)
disp = ''.join(f'    - Class: {c}\n      Enabled: true\n      Name: {c.split("/")[-1]}\n      Value: true\n' for c in classes)
tail = tail.replace('Fixed Frame: /map', f'Fixed Frame: {frame}')
open(out, 'w').write(head + '  Displays:\n' + disp + '  Enabled: true\n  Global Options:' + tail)
