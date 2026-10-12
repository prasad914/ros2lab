// Host test: the firmware core (bridge_core.h, the AVR/ESP32-friendly protocol) against the Jetson side's protocol
// (ros2lab_hardware/protocol.hpp). Build and run:
//   g++ -std=c++17 -Wall -Wextra -I firmware/test/stubs -I firmware/ros2lab_bridge -I src/ros2lab_hardware/include firmware/test/test_interop.cpp -o /tmp/t && /tmp/t
#include <cassert>
#include <cmath>
#include <cstdio>
#include <vector>

#include "bridge_core.h"
#include "ros2lab_hardware/protocol.hpp"

namespace pb = ros2lab_bridge;

struct FakeServo : bridge::Actuator
{
  float target = 0, pos = 0;
  bool on = false;
  void begin() override {}
  void enable(bool e) override { on = e; }
  void command(float v) override { target = v; }
  void update(float) override { if (on) pos = target; }
  float position() override { return pos; }
  float velocity() override { return 0; }
};
struct FakeImu : bridge::Imu
{
  bool begin() override { return true; }
  bool read(float q[4], float g[3], float a[3]) override { q[0] = q[1] = q[2] = 0; q[3] = 1; g[0] = g[1] = g[2] = 0; a[0] = a[1] = 0; a[2] = 9.81f; return true; }
};
struct Capture : bridge::Link
{
  std::vector<uint8_t> bytes;
  void send(const uint8_t * d, uint16_t n) override { bytes.insert(bytes.end(), d, d + n); }
};

static std::vector<pb::Frame> host_read(Capture & c)
{
  pb::Parser p; pb::Frame f; std::vector<pb::Frame> out;
  for (uint8_t b : c.bytes) if (p.push(b, f)) out.push_back(f);
  c.bytes.clear();
  return out;
}
static void board_feed(bridge::Core & core, bridge::Parser & mp, const std::vector<uint8_t> & bytes, uint32_t now, Capture & link)
{
  for (uint8_t b : bytes) if (mp.push(b)) core.handle(mp, now, link);
}

int main()
{
  FakeServo s[3];
  bridge::Actuator * acts[3] = {&s[0], &s[1], &s[2]};
  FakeImu imu;
  bridge::Core core(acts, 3, "arm3", &imu);
  core.begin();
  bridge::Parser mp;
  Capture link;
  int checks = 0;
  // HELLO -> HELLO_ACK
  board_feed(core, mp, pb::make_hello(), 0, link);
  auto fr = host_read(link);
  pb::Hello h;
  assert(fr.size() == 1 && pb::parse_hello_ack(fr[0], h) && h.joints == 3 && h.has_imu == 1 && h.robot == "arm3"); ++checks;
  // a COMMAND before ENABLE does not move anything, but the state comes back
  board_feed(core, mp, pb::make_command({0.5f, 0.6f, 0.7f}), 10, link);
  core.tick(15, 0.005f, &link);
  fr = host_read(link);
  pb::State st;
  assert(fr.size() == 1 && pb::parse_state(fr[0], st) && st.position.size() == 3 && st.position[0] == 0.0f); ++checks;
  // ENABLE, then COMMAND -> the servos follow; STATE with the IMU
  board_feed(core, mp, pb::make_enable(true), 20, link);
  board_feed(core, mp, pb::make_command({0.5f, 0.6f, 0.7f}), 30, link);
  core.tick(35, 0.005f, &link);
  host_read(link);
  board_feed(core, mp, pb::make_command({0.5f, 0.6f, 0.7f}), 40, link);
  fr = host_read(link);
  assert(fr.size() == 1 && pb::parse_state(fr[0], st) && std::fabs(st.position[2] - 0.7f) < 1e-6f && st.has_imu && std::fabs(st.imu.accel[2] - 9.81f) < 1e-5f); ++checks;
  // wrong joint count -> FAULT (and still a state)
  board_feed(core, mp, pb::make_command({1.f}), 50, link);
  fr = host_read(link);
  assert(fr.size() == 2 && fr[0].type == pb::MsgType::FAULT && fr[1].type == pb::MsgType::STATE); ++checks;
  // the watchdog: no command for 500 ms -> motors off and a FAULT
  core.tick(600, 0.005f, &link);
  fr = host_read(link);
  assert(!core.enabled() && fr.size() == 1 && fr[0].type == pb::MsgType::FAULT && fr[0].payload[0] == static_cast<uint8_t>(pb::Fault::WATCHDOG) && !s[0].on); ++checks;
  // the next command switches the motors back on
  board_feed(core, mp, pb::make_command({0.1f, 0.2f, 0.3f}), 700, link);
  core.tick(705, 0.005f, &link);
  assert(core.enabled() && std::fabs(s[1].pos - 0.2f) < 1e-6f); ++checks;
  // noise between frames is skipped on both sides
  std::vector<uint8_t> noisy{0x00, 0xAA, 0x12, 0x55};
  auto c = pb::make_command({0.f, 0.f, 0.f}); noisy.insert(noisy.end(), c.begin(), c.end());
  host_read(link);
  board_feed(core, mp, noisy, 710, link);
  fr = host_read(link);
  assert(fr.size() == 1 && fr[0].type == pb::MsgType::STATE); ++checks;
  // byte-for-byte: both encoders produce the same frame
  uint8_t buf[256];
  bridge::FrameWriter w(buf, bridge::T_COMMAND); w.u8(2); w.f32(1.5f); w.f32(-2.25f);
  const uint16_t n = w.finish();
  const auto host = pb::make_command({1.5f, -2.25f});
  assert(host.size() == n && std::equal(host.begin(), host.end(), buf)); ++checks;
  std::printf("firmware/host interop: %d checks passed\n", checks);
  return 0;
}
