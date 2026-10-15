import yaml
from PIL import Image
import numpy as np

with open('tests/fixtures/maps/turtlebot3_world.yaml', 'r') as f:
    map_meta = yaml.safe_load(f)

resolution = map_meta['resolution']
origin_x, origin_y, _ = map_meta['origin']

img = Image.open('tests/fixtures/maps/turtlebot3_world.pgm')
arr = np.array(img)
height, width = arr.shape

def pixel_to_world(px, py):
    wx = px * resolution + origin_x
    wy = (height - py) * resolution + origin_y
    return wx, wy

safe_goals = []
for py in range(20, height - 20, 2):
    for px in range(20, width - 20, 2):
        if arr[py, px] > 200:
            # check mindist >= 0.4m
            min_dist = 999
            radius_px = int(0.4 / resolution)
            for dy in range(-radius_px, radius_px + 1):
                for dx in range(-radius_px, radius_px + 1):
                    nx, ny = px + dx, py + dy
                    if 0 <= ny < height and 0 <= nx < width:
                        if arr[ny, nx] < 128:
                            d = np.sqrt(dx**2 + dy**2) * resolution
                            if d < min_dist:
                                min_dist = d
            if min_dist >= 0.4:
                wx, wy = pixel_to_world(px, py)
                safe_goals.append((wx, wy, min_dist))

print(f"Total safe goals found (dist >= 0.4m): {len(safe_goals)}")
# Let's select 5 spaced out safe goals
# Robot spawns at (-2.0, -0.5)
selected = []
# Let's pick goals near (-1.0, -0.5), (0.0, 0.0), (1.0, 0.5), (0.0, 1.0), (1.0, -1.0) if possible
targets = [(-1.0, -0.5), (0.0, 0.0), (1.0, 0.5), (0.0, 1.0), (1.0, -1.0)]
for tx, ty in targets:
    # find closest safe goal
    best = min(safe_goals, key=lambda g: (g[0]-tx)**2 + (g[1]-ty)**2)
    selected.append(best)

for i, (wx, wy, md) in enumerate(selected, 1):
    print(f"Goal {i}: x={wx:.2f}, y={wy:.2f} (dist to wall {md:.2f}m)")

# Find an obstacle goal
obs_goals = []
for py in range(10, height - 10):
    for px in range(10, width - 10):
        if arr[py, px] < 50:
            wx, wy = pixel_to_world(px, py)
            obs_goals.append((wx, wy))
            break
    if obs_goals:
        break
print(f"Obstacle goal: x={obs_goals[0][0]:.2f}, y={obs_goals[0][1]:.2f}")
