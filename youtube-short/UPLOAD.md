# YouTube Short: 12 robots you can simulate in Gazebo

**Video file:** `ros2lab-gazebo-robots-short.mp4`
- 1080 × 1920 (9:16), 30 fps
- 60 s, H.264 + AAC
- The soundtrack is original (synthesised for this video), so it should not get a Content ID claim.

## Title (copy and paste)

12 Robots You Can Simulate in Gazebo 🤖 + Their ROS 2 Controllers #shorts

## Description (copy and paste)

12 robots you can simulate in Gazebo, and the controller that drives each one:

🦾 Universal Robots UR5e: joint_trajectory_controller + MoveIt 2
🚗 TurtleBot3 Waffle: diff_drive_controller + LiDAR
🐕 Unitree Go2: joint_trajectory_controller (12 joints)
🦾 Franka Research 3: joint_trajectory_controller + Franka Hand
🧍 Unitree G1: joint_trajectory_controller (29 joints)
🚙 AgileX Scout V2: diff_drive_controller (skid steer)
🏭 KUKA KR 6 R900 sixx: joint_trajectory_controller + MoveIt 2
🐕 Boston Dynamics Spot: joint_trajectory_controller (12 joints)
🚁 Bitcraze Crazyflie 2.1: VelocityControl (gz-sim)
🦾 SO-101 (LeRobot): joint_trajectory_controller + MoveIt 2
🦾 Kinova Gen3: joint_trajectory_controller + MoveIt 2
🧍 Unitree H1: joint_trajectory_controller (19 joints)

Simulate 30+ robots right in your browser, with Gazebo, RViz 2, MoveIt 2 and ros2_control. No Ubuntu needed to start.
👉 https://www.ros2lab.com
Free founding batch: register by 31 Dec 2026.

#ROS2 #Gazebo #Robotics #ros2_control #MoveIt #RobotSimulation #Shorts

## Tags (YouTube Studio, comma separated)

ROS 2, ROS2, Gazebo, Gazebo Harmonic, ROS 2 Jazzy, robotics, robot simulation, ros2_control, MoveIt 2, joint_trajectory_controller, diff_drive_controller, UR5e, TurtleBot3, Unitree Go2, Unitree G1, Unitree H1, Boston Dynamics Spot, Franka, KUKA, Kinova Gen3, SO-101, LeRobot, Crazyflie, ROS2Lab

## Upload tips

- Upload from the YouTube app or YouTube Studio. A vertical video of 3 minutes or less is published as a Short automatically.
- Pinned comment idea: "Which robot should I simulate next? Try all 30+ free at ros2lab.com 👇"
- Keep the soundtrack, or mute it and add a trending sound in the Shorts editor.

## Re-rendering

`source/` holds the generator:
- `index.html` + `short.js`: the animated page (three.js), a pure function of time.
- `render.mjs`: Playwright captures 1800 frames and pipes them to ffmpeg.
- `music.py`: synthesises the soundtrack with numpy.

To run it, serve a folder that contains:
- `index.html`, `short.js` and `fonts/` (Inter, Lexend and JetBrains Mono woff2 from Google Fonts);
- `robots/`: the site's `public/robots`;
- `three/`: the `three@0.160.0` npm package.

Then:

```bash
node render.mjs 0 1800 video.mp4
python3 music.py music.wav
ffmpeg -i video.mp4 -i music.wav -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=7 -c:a aac -b:a 192k -shortest -movflags +faststart ros2lab-gazebo-robots-short.mp4
```
