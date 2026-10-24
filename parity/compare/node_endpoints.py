#!/usr/bin/env python3
"""Night 2: node-centric view of a `ros2 topic info -v` capture folder (one file per topic):
for each node, every PUBLISHER / SUBSCRIPTION with topic, type and RELIABILITY/DURABILITY.
Usage: node_endpoints.py <qos dir> [node-regex]"""
import os, re, sys, collections
d = sys.argv[1]; pat = re.compile(sys.argv[2]) if len(sys.argv) > 2 else None
by = collections.defaultdict(set)
for f in sorted(os.listdir(d)):
    if not f.endswith('.txt') or f.endswith('_hz.txt'): continue
    t = open(os.path.join(d, f)).read()
    if 'Unknown topic' in t: continue
    topic = '/' + f[:-4].replace('__', '/')
    for blk in re.split(r'\n(?=Node name: )', t)[1:]:
        g = lambda r: (re.search(r, blk, re.M) or [0, ''])[1]
        ns = g(r'^Node namespace: (.+)$').strip('/'); node = '/' + (ns + '/' if ns else '') + g(r'^Node name: (.+)$')
        by[node].add(f"{g(r'^Endpoint type: (.+)$')[:3]} {topic} [{g(r'^Topic type: (.+)$')}] {g(r'^\s+Reliability: (.+)$')}/{g(r'^\s+Durability: (.+)$')}")
for n in sorted(by):
    if pat and not pat.search(n): continue
    print(f'== {n}')
    for e in sorted(by[n]): print('  ', e)
