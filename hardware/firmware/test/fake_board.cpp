// A pretend microcontroller on a pseudo-terminal: the real firmware core (bridge_core.h) with simulated joints, so the
// Jetson side (ros2lab_hardware/BridgeSystem in ros2_control) can be tested end to end without a board.
//   g++ -std=c++17 -O2 -I firmware/test/stubs -I firmware/ros2lab_bridge firmware/test/fake_board.cpp -o fake_board
//   ./fake_board /tmp/ros2lab_mcu <robot_id> <modes> [imu]      modes: one letter per joint, v = velocity (wheel), p = position
// then: ros2 launch ... hardware_type:=real device:=/tmp/ros2lab_mcu
#include <fcntl.h>
#include <poll.h>
#include <termios.h>
#include <unistd.h>

#include <chrono>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include "bridge_core.h"

struct SimJoint : bridge::Actuator
{
  bool velocity_mode, on = false;
  float target = 0, pos = 0, vel = 0;
  explicit SimJoint(bool v) : velocity_mode(v) {}
  void begin() override {}
  void enable(bool e) override { on = e; if (!e) vel = 0; }
  void command(float v) override { target = v; }
  void update(float dt) override
  {
    if (!on) { vel = 0; return; }
    if (velocity_mode) { vel = target; pos += vel * dt; }
    else { const float step = std::fmax(-3.0f * dt, std::fmin(3.0f * dt, target - pos)); vel = step / dt; pos += step; }   // 3 rad/s servo
  }
  float position() override { return pos; }
  float velocity() override { return vel; }
};
struct SimImu : bridge::Imu
{
  bool begin() override { return true; }
  bool read(float q[4], float g[3], float a[3]) override { q[0] = q[1] = q[2] = 0; q[3] = 1; g[0] = g[1] = g[2] = 0; a[0] = a[1] = 0; a[2] = 9.81f; return true; }
};
struct PtyLink : bridge::Link
{
  int fd;
  explicit PtyLink(int f) : fd(f) {}
  void send(const uint8_t * d, uint16_t n) override { if (::write(fd, d, n) < 0) { /* reader gone */ } }
};

static volatile bool running = true;
int main(int argc, char ** argv)
{
  if (argc < 4) { std::fprintf(stderr, "usage: %s <link path> <robot_id> <modes v|p per joint> [imu]\n", argv[0]); return 2; }
  const std::string link_path = argv[1], modes = argv[3];
  const bool with_imu = argc > 4 && std::string(argv[4]) == "imu";
  int m = posix_openpt(O_RDWR | O_NOCTTY);
  if (m < 0 || grantpt(m) || unlockpt(m)) { std::perror("pty"); return 1; }
  termios t{}; tcgetattr(m, &t); cfmakeraw(&t); tcsetattr(m, TCSANOW, &t);
  ::unlink(link_path.c_str());
  if (::symlink(ptsname(m), link_path.c_str())) { std::perror("symlink"); return 1; }
  std::signal(SIGINT, [](int) { running = false; }); std::signal(SIGTERM, [](int) { running = false; });
  std::vector<SimJoint> joints; joints.reserve(modes.size());
  std::vector<bridge::Actuator *> acts;
  for (char c : modes) { joints.emplace_back(c == 'v'); }
  for (auto & j : joints) acts.push_back(&j);
  SimImu imu;
  bridge::Core core(acts.data(), static_cast<uint8_t>(acts.size()), argv[2], with_imu ? &imu : nullptr);
  core.begin();
  bridge::Parser parser; PtyLink link(m);
  std::printf("fake board '%s': %zu joints%s on %s -> %s\n", argv[2], acts.size(), with_imu ? " + IMU" : "", link_path.c_str(), ptsname(m));
  std::fflush(stdout);
  const auto t0 = std::chrono::steady_clock::now();
  auto now_ms = [&] { return static_cast<uint32_t>(std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count()); };
  uint32_t last_tick = 0, frames = 0;
  while (running) {
    pollfd p{m, POLLIN, 0};
    if (::poll(&p, 1, 2) > 0 && (p.revents & POLLIN)) {
      uint8_t buf[512]; const ssize_t n = ::read(m, buf, sizeof(buf));
      for (ssize_t i = 0; i < n; ++i) if (parser.push(buf[i])) { core.handle(parser, now_ms(), link); ++frames; }
    }
    const uint32_t now = now_ms();
    if (now - last_tick >= 5) { core.tick(now, (now - last_tick) / 1000.0f, &link); last_tick = now; }
  }
  ::unlink(link_path.c_str());
  std::printf("fake board: %u frames handled; joint 0 at %.3f\n", frames, acts.empty() ? 0.0 : acts[0]->position());
  return 0;
}
