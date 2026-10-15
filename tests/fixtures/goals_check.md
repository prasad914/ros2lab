# Goals Check Report

### Start Pose
- World: x=-2.0, y=-0.5
- Pixel: x=13, y=76
- Value (0=black/occupied, 254/255=white/free): 205

### Goals
- **goal_1** (Verified safe free goal 1 (near corridor)): World=(-0.95, -0.5) -> Pixel=(34, 76), Value=254, MinObstacleDist=0.43m -> Status: VALID FREE
- **goal_2** (Verified safe free goal 2 (center open space)): World=(0.75, 0.0) -> Pixel=(68, 66), Value=254, MinObstacleDist=0.41m -> Status: VALID FREE
- **goal_3** (Verified safe free goal 3 (right area)): World=(1.05, 0.0) -> Pixel=(74, 66), Value=254, MinObstacleDist=0.40m -> Status: VALID FREE
- **goal_4** (Verified safe free goal 4 (upper area)): World=(0.05, 1.3) -> Pixel=(54, 40), Value=254, MinObstacleDist=0.40m -> Status: VALID FREE
- **goal_5** (Verified safe free goal 5 (lower area)): World=(0.75, -1.0) -> Pixel=(68, 86), Value=254, MinObstacleDist=0.40m -> Status: VALID FREE

### Obstacle Goal
- **obstacle_goal_invalid** (Goal placed inside a wall/obstacle to test recovery and planner failure handling): World=(-1.05, 2.8) -> Pixel=(32, 10), Value=0 -> Status: VALID OBSTACLE (occupied)
