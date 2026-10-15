import yaml
from PIL import Image
import numpy as np

# Load map yaml
with open('tests/fixtures/maps/turtlebot3_world.yaml', 'r') as f:
    map_meta = yaml.safe_load(f)

resolution = map_meta['resolution']
origin_x, origin_y, _ = map_meta['origin']

# Load pgm
img = Image.open('tests/fixtures/maps/turtlebot3_world.pgm')
arr = np.array(img)
height, width = arr.shape

print(f"Map shape: width={width}, height={height}, resolution={resolution}, origin=({origin_x}, {origin_y})")

with open('tests/fixtures/goals.yaml', 'r') as f:
    goals_data = yaml.safe_load(f)

def world_to_pixel(wx, wy):
    px = int(round((wx - origin_x) / resolution))
    py = height - int(round((wy - origin_y) / resolution))
    return px, py

report = []
report.append("# Goals Check Report\n\n")

# Start pose (from launch file: x=-2.0, y=-0.5)
start_x, start_y = -2.0, -0.5
spx, spy = world_to_pixel(start_x, start_y)
val = arr[spy, spx] if (0 <= spy < height and 0 <= spx < width) else -1
report.append(f"### Start Pose\n- World: x={start_x}, y={start_y}\n- Pixel: x={spx}, y={spy}\n- Value (0=black/occupied, 254/255=white/free): {val}\n\n")

report.append("### Goals\n")
for g in goals_data['goals']:
    gid = g['id']
    desc = g['description']
    wx = g['pose']['position']['x']
    wy = g['pose']['position']['y']
    px, py = world_to_pixel(wx, wy)
    val = arr[py, px] if (0 <= py < height and 0 <= px < width) else -1

    min_dist_m = float('inf')
    if 0 <= py < height and 0 <= px < width:
        radius_px = int(0.4 / resolution)
        for dy in range(-radius_px, radius_px + 1):
            for dx in range(-radius_px, radius_px + 1):
                nx, ny = px + dx, py + dy
                if 0 <= ny < height and 0 <= nx < width:
                    if arr[ny, nx] < 128:
                        dist = np.sqrt(dx**2 + dy**2) * resolution
                        if dist < min_dist_m:
                            min_dist_m = dist

    status = "VALID FREE" if val > 200 and min_dist_m >= 0.4 else f"TOO CLOSE TO WALL (min dist {min_dist_m:.2f}m)" if val > 200 else "OCCUPIED"
    report.append(f"- **{gid}** ({desc}): World=({wx}, {wy}) -> Pixel=({px}, {py}), Value={val}, MinObstacleDist={min_dist_m:.2f}m -> Status: {status}\n")

og = goals_data['obstacle_goal']
owx = og['pose']['position']['x']
owy = og['pose']['position']['y']
opx, opy = world_to_pixel(owx, owy)
oval = arr[opy, opx] if (0 <= opy < height and 0 <= opx < width) else -1
ostatus = "VALID OBSTACLE (occupied)" if oval < 128 else "NOT AN OBSTACLE (free space!)"
report.append(f"\n### Obstacle Goal\n- **{og['id']}** ({og['description']}): World=({owx}, {owy}) -> Pixel=({opx}, {opy}), Value={oval} -> Status: {ostatus}\n")

with open('tests/fixtures/goals_check.md', 'w') as out:
    out.writelines(report)

print("Generated tests/fixtures/goals_check.md")
