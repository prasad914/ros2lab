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

def world_to_pixel(wx, wy):
    px = int(round((wx - origin_x) / resolution))
    py = height - int(round((wy - origin_y) / resolution))
    return px, py

def check_pos(wx, wy):
    px, py = world_to_pixel(wx, wy)
    if not (0 <= px < width and 0 <= py < height):
        return "OUT OF BOUNDS", -1, 0
    val = arr[py, px]
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
    return "FREE" if val > 200 else "OCCUPIED", val, min_dist

candidates = [
    ("goal_1", "Open center area right", 0.5, 0.0),
    ("goal_2", "Upper open space", 0.0, 1.0),
    ("goal_3", "Lower open space", 0.0, -1.0),
    ("goal_4", "Right corridor", 1.5, 0.0),
    ("goal_5", "Upper right area", 1.0, 1.5),
]

print("Checking candidate goals:")
for gid, desc, wx, wy in candidates:
    status, val, mind = check_pos(wx, wy)
    print(f"  {gid} ({wx}, {wy}): val={val}, mindist={mind:.2f}m -> {status}")

# Find an obstacle pixel (value < 50)
obs_found = False
for py in range(20, height - 20):
    for px in range(20, width - 20):
        if arr[py, px] < 50:
            # convert to world
            wx = px * resolution + origin_x
            wy = (height - py) * resolution + origin_y
            print(f"Obstacle goal candidate at pixel ({px}, {py}) -> World ({wx:.2f}, {wy:.2f}), val={arr[py, px]}")
            obs_found = True
            break
    if obs_found:
        break
