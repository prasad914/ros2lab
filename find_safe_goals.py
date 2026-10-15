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

# Find some clearly free pixels (value > 200 and distance to wall >= 10 pixels i.e. 0.5m)
free_candidates = []
obstacle_candidates = []

radius_px = int(0.5 / resolution) # 10 pixels = 0.5m

for py in range(radius_px, height - radius_px, 5):
    for px in range(radius_px, width - radius_px, 5):
        if arr[py, px] > 200: # free space
            # check min distance to obstacle (< 128)
            min_d = 999
            for dy in range(-radius_px, radius_px + 1):
                for dx in range(-radius_px, radius_px + 1):
                    nx, ny = px + dx, py + dy
                    if arr[ny, nx] < 128:
                        d = np.sqrt(dx**2 + dy**2)
                        if d < min_d:
                            min_d = d
            if min_d >= 10: # at least 0.5m away from obstacles
                free_candidates.append((px, py, min_d * resolution))
        elif arr[py, px] < 50: # occupied (wall)
            obstacle_candidates.append((px, py))

print(f"Found {len(free_candidates)} safe free pixels and {len(obstacle_candidates)} obstacle pixels.")
if free_candidates:
    # Pick 5 spread out free candidates
    print("Sample free world coords:")
    for i in range(0, min(5, len(free_candidates))):
        px, py, dist = free_candidates[i * (len(free_candidates)//5)]
        wx, wy = pixel_to_world(px, py)
        print(f"  Pixel ({px}, {py}) -> World ({wx:.2f}, {wy:.2f}), dist to wall {dist:.2f}m")

if obstacle_candidates:
    px, py = obstacle_candidates[len(obstacle_candidates)//2]
    wx, wy = pixel_to_world(px, py)
    print(f"Sample obstacle Pixel ({px}, {py}) -> World ({wx:.2f}, {wy:.2f})")
