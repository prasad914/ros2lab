#!/usr/bin/env python3
"""Estimate an <inertial> block for every link of a URDF that has none, from its collision meshes.

Some makers' URDFs (ROS-Industrial's KUKA and FANUC support packages, the Dobot Magician) have no <inertial> at all.
RViz and MoveIt do not need one, but Gazebo does: libsdformat leaves out every link without a mass, so the arm falls
apart in simulation. This tool gives each such link the mass of its share of the robot's total weight (from the data
sheet), spread over the volume of its collision meshes (uniform density), with the centre of mass and the inertia
tensor of that solid in the link frame. Meshes that are not closed solids are replaced by their convex hull.

    python3 tools/mesh-inertials.py public/robots/kuka_kr6_support/urdf/kr6r900sixx.urdf 52 > kr6.json

The output is a JSON object {link: [mass, [x, y, z], [ixx, ixy, ixz, iyy, iyz, izz]]} for index.json's "inertials".
"""
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

import numpy as np
import trimesh

MIN_MASS, MIN_I = 0.05, 1e-5
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "robots")


def rpy_matrix(r, p, y):
    cr, sr, cp, sp, cy, sy = math.cos(r), math.sin(r), math.cos(p), math.sin(p), math.cos(y), math.sin(y)
    return np.array([[cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr],
                     [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr],
                     [-sp, cp * sr, cp * cr]])


def origin(el):
    o = el.find("origin")
    xyz = [float(v) for v in (o.get("xyz", "0 0 0") if o is not None else "0 0 0").split()]
    rpy = [float(v) for v in (o.get("rpy", "0 0 0") if o is not None else "0 0 0").split()]
    return np.array(xyz), rpy_matrix(*rpy)


def solid(geom):
    """(volume, centre, inertia about the centre for density 1) of one <geometry>, in the geometry frame"""
    m = geom.find("mesh")
    if m is not None:
        url = m.get("filename")
        path = os.path.join(ROOT, url.replace("package://", "")) if url.startswith("package://") else url
        mesh = trimesh.load(path, force="mesh")
        scale = [float(v) for v in m.get("scale", "1 1 1").split()]
        mesh.apply_scale(scale)
        if not mesh.is_volume:
            mesh = mesh.convex_hull
        return mesh.volume, mesh.center_mass, mesh.moment_inertia   # moment_inertia: about the centre of mass
    b = geom.find("box")
    if b is not None:
        x, y, z = [float(v) for v in b.get("size").split()]
        v = x * y * z
        return v, np.zeros(3), np.diag([v * (y * y + z * z) / 12, v * (x * x + z * z) / 12, v * (x * x + y * y) / 12])
    c = geom.find("cylinder")
    if c is not None:
        r, h = float(c.get("radius")), float(c.get("length"))
        v = math.pi * r * r * h
        return v, np.zeros(3), np.diag([v * (3 * r * r + h * h) / 12, v * (3 * r * r + h * h) / 12, v * r * r / 2])
    s = geom.find("sphere")
    if s is not None:
        r = float(s.get("radius"))
        v = 4 / 3 * math.pi * r ** 3
        return v, np.zeros(3), np.eye(3) * 0.4 * v * r * r
    return 0.0, np.zeros(3), np.zeros((3, 3))


def main():
    urdf, total = sys.argv[1], float(sys.argv[2])
    robot = ET.parse(urdf).getroot()
    fixed_child = {j.find("child").get("link") for j in robot.findall("joint") if j.get("type") == "fixed"}
    parts = {}
    for link in robot.findall("link"):
        if link.find("inertial") is not None:
            continue
        shapes = link.findall("collision") or link.findall("visual")
        vol, first, second = 0.0, np.zeros(3), np.zeros((3, 3))   # volume, sum of v*c, sum of inertias about the link origin
        for s in shapes:
            g = s.find("geometry")
            if g is None:
                continue
            v, c, I = solid(g)
            if v <= 0:
                continue
            t, R = origin(s)
            cw = R @ c + t
            Iw = R @ I @ R.T + v * (np.dot(cw, cw) * np.eye(3) - np.outer(cw, cw))   # parallel axis to the link origin
            vol += v
            first += v * cw
            second += Iw
        parts[link.get("name")] = (vol, first, second)
    total_vol = sum(p[0] for p in parts.values())
    density = total / total_vol if total_vol > 0 else 0
    out = {}
    has_parent = {j.find("child").get("link") for j in robot.findall("joint")}
    for name, (vol, first, second) in parts.items():
        if vol <= 0:
            if name in fixed_child or name not in has_parent:
                continue   # lumped into its parent by Gazebo: no mass needed
            out[name] = [0.01, [0, 0, 0], [1e-5, 0, 0, 1e-5, 0, 1e-5]]   # a frame link on a moving joint
            continue
        mass = density * vol
        com = first / vol
        Ic = density * second - mass * (np.dot(com, com) * np.eye(3) - np.outer(com, com))   # back to the centre of mass
        if mass < MIN_MASS:   # a thin flange: very small masses and inertias make physics engines unstable
            Ic, mass = Ic * (MIN_MASS / mass), MIN_MASS
        Ic = Ic + np.eye(3) * max(0.0, MIN_I - min(np.diag(Ic)))
        r6 = lambda x: float(f"{x:.6g}")
        out[name] = [r6(mass), [r6(x) for x in com], [r6(Ic[0, 0]), r6(Ic[0, 1]), r6(Ic[0, 2]), r6(Ic[1, 1]), r6(Ic[1, 2]), r6(Ic[2, 2])]]
    json.dump(out, sys.stdout, indent=None)
    print()


if __name__ == "__main__":
    main()
