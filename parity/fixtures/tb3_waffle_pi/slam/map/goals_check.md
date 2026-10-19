goals: `parity/fixtures/goals.yaml`  
map: `parity/fixtures/tb3_waffle_pi/slam/map/map.yaml` (image `map.pgm`, 111 x 103 px, resolution 0.05000000074505806, origin [-0.938, -2.065, 0.0], negate 0, occupied_thresh 0.65, free_thresh 0.196)
occupied cells: 335

| pose | x | y | cell (mx, my) | pgm (col, row) | pixel | status | status in goals file | match | nearest occupied cell (metres) |
|---|---|---|---|---|---|---|---|---|---|
| start_pose | 0.000 | 0.000 | (18, 41) | (18, 61) | 254 | FREE | FREE | yes | 0.492 |
| goal1 | 0.200 | 1.000 | (22, 61) | (22, 41) | 254 | FREE | FREE | yes | 0.680 |
| goal2 | 2.500 | 1.950 | (68, 80) | (68, 22) | 205 | UNKNOWN | FREE | NO | 0.541 |
| goal3 | 3.750 | 0.500 | (93, 51) | (93, 51) | 205 | UNKNOWN | FREE | NO | 0.600 |
| goal4 | 2.000 | -1.400 | (58, 13) | (58, 89) | 254 | FREE | FREE | yes | 0.600 |
| goal5 | 1.500 | 0.000 | (48, 41) | (48, 61) | 254 | FREE | FREE | yes | 0.566 |
| obstacle_goal | 1.870 | 0.400 | (56, 49) | (56, 53) | 0 | OCCUPIED | OCCUPIED | yes | 0.000 |
