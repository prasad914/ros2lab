// bridge_probe: check the board without ROS 2 (wiring, power, firmware), e.g.
//   ros2 run ros2lab_hardware bridge_probe serial /dev/ros2lab_mcu 921600     (ESP32; an Arduino Mega: 500000)
//   ros2 run ros2lab_hardware bridge_probe udp 192.168.4.1 8888
//   ros2 run ros2lab_hardware bridge_probe serial /dev/ttyUSB0 921600 move 2 0.3   # enable, move joint 2 to 0.3 for 2 s
#include <chrono>
#include <cstdio>
#include <string>
#include <thread>
#include <vector>

#include "ros2lab_hardware/protocol.hpp"
#include "ros2lab_hardware/transport.hpp"

namespace pb = ros2lab_bridge;

int main(int argc, char ** argv)
{
  if (argc < 4) {
    std::fprintf(stderr, "usage: bridge_probe serial <device> <baud> | udp <host> <port>  [move <joint index> <value>]\n");
    return 2;
  }
  const std::string kind = argv[1];
  std::string error;
  auto t = ros2lab_hardware::make_transport(kind, argv[2], kind == "serial" ? std::stoi(argv[3]) : 0, argv[2], kind == "udp" ? std::stoi(argv[3]) : 0, error);
  if (!t || !t->open(error)) {std::fprintf(stderr, "error: %s\n", error.c_str()); return 1;}
  pb::Parser p;
  pb::Frame f;
  auto wait_for = [&](pb::MsgType type, int ms) -> bool {
      const auto until = std::chrono::steady_clock::now() + std::chrono::milliseconds(ms);
      while (std::chrono::steady_clock::now() < until) {
        std::vector<uint8_t> buf;
        if (t->read(buf, 20) < 0) {return false;}
        for (uint8_t b : buf) {if (p.push(b, f) && f.type == type) {return true;}}
      }
      return false;
    };
  pb::Hello h;
  bool ok = false;
  for (int i = 0; i < 10 && !ok; ++i) {t->write(pb::make_hello()); ok = wait_for(pb::MsgType::HELLO_ACK, 200) && pb::parse_hello_ack(f, h);}
  if (!ok) {std::fprintf(stderr, "no answer from %s\n", t->describe().c_str()); return 1;}
  std::printf("board '%s': protocol %d, %d joints, IMU %s\n", h.robot.c_str(), h.version, h.joints, h.has_imu ? "yes" : "no");
  t->write(pb::make_command({}));
  pb::State s;
  if (wait_for(pb::MsgType::STATE, 500) && pb::parse_state(f, s)) {
    for (size_t i = 0; i < s.position.size(); ++i) {std::printf("  joint %zu: position %.4f  velocity %.4f\n", i, s.position[i], s.velocity[i]);}
    if (s.has_imu) {std::printf("  imu: q=(%.3f %.3f %.3f %.3f) accel=(%.2f %.2f %.2f)\n", s.imu.q[0], s.imu.q[1], s.imu.q[2], s.imu.q[3], s.imu.accel[0], s.imu.accel[1], s.imu.accel[2]);}
  }
  if (argc >= 7 && std::string(argv[4]) == "move") {
    const size_t j = static_cast<size_t>(std::stoi(argv[5]));
    const float v = std::stof(argv[6]);
    if (j >= s.position.size()) {std::fprintf(stderr, "joint index out of range\n"); return 1;}
    std::vector<float> cmd(s.position.begin(), s.position.end());
    cmd[j] = v;
    t->write(pb::make_enable(true));
    for (int i = 0; i < 100; ++i) {t->write(pb::make_command(cmd)); std::this_thread::sleep_for(std::chrono::milliseconds(20));}
    t->write(pb::make_enable(false));
    std::printf("sent joint %zu = %.3f for 2 s, motors off again\n", j, v);
  }
  return 0;
}
