// ROS2Lab bridge protocol: the Jetson (ROS 2, ros2_control) <-> the microcontroller (ESP32 / Arduino) that drives the
// motors and servos and reads the encoders and the IMU. The same header is compiled into the firmware, so both sides
// always agree on the bytes. It is plain C++17 with no ROS and no Arduino dependency.
//
// Frame:  0xAA 0x55 | type (1) | length (1, payload bytes) | payload (0..240) | CRC-16/CCITT-FALSE (2, little endian)
//         The CRC covers type, length and payload. Floats are IEEE-754 little endian (Jetson and ESP32 / AVR all are).
//
// Host -> MCU                                         MCU -> host
//   HELLO    (0x01)  u8 protocol version              HELLO_ACK (0x81) u8 version, u8 joints, u8 has_imu, char[] robot id
//   COMMAND  (0x02)  u8 n, n x f32 (rad, m, rad/s)    STATE     (0x82) u32 ms, u8 n, n x (f32 pos, f32 vel),
//   ENABLE   (0x03)  u8 0 = motors off, 1 = on                          u8 imu, [10 x f32: qx qy qz qw gx gy gz ax ay az]
//   PING     (0x04)  (empty)                          PONG      (0x84)  (empty)
//                                                     FAULT     (0x85)  u8 code, char[] text
// The MCU stops every motor (watchdog) when no COMMAND arrives for WATCHDOG_MS.
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace ros2lab_bridge
{

constexpr uint8_t SYNC0 = 0xAA;
constexpr uint8_t SYNC1 = 0x55;
constexpr uint8_t VERSION = 1;
constexpr size_t MAX_PAYLOAD = 240;
constexpr size_t MAX_JOINTS = 24;   // 4 + 1 + 24 x 8 + 1 + 40 (IMU) = 238 bytes <= MAX_PAYLOAD; more joints: a second board
constexpr uint32_t WATCHDOG_MS = 500;

enum class MsgType : uint8_t
{
  HELLO = 0x01,
  COMMAND = 0x02,
  ENABLE = 0x03,
  PING = 0x04,
  HELLO_ACK = 0x81,
  STATE = 0x82,
  PONG = 0x84,
  FAULT = 0x85,
};

enum class Fault : uint8_t
{
  NONE = 0,
  WATCHDOG = 1,       // no command for WATCHDOG_MS: motors stopped
  BAD_COMMAND = 2,    // wrong number of joints
  OVERCURRENT = 3,
  IMU = 4,            // IMU not answering
  LOW_BATTERY = 5,
};

inline uint16_t crc16(const uint8_t * data, size_t n, uint16_t crc = 0xFFFF)
{
  for (size_t i = 0; i < n; ++i) {
    crc ^= static_cast<uint16_t>(data[i]) << 8;
    for (int b = 0; b < 8; ++b) {
      crc = (crc & 0x8000) ? static_cast<uint16_t>((crc << 1) ^ 0x1021) : static_cast<uint16_t>(crc << 1);
    }
  }
  return crc;
}

struct Frame
{
  MsgType type{MsgType::PING};
  std::vector<uint8_t> payload;
};

// ---------- writing ----------
inline std::vector<uint8_t> encode(MsgType type, const uint8_t * payload, size_t n)
{
  std::vector<uint8_t> out;
  if (n > MAX_PAYLOAD) {return out;}
  out.reserve(n + 6);
  out.push_back(SYNC0);
  out.push_back(SYNC1);
  out.push_back(static_cast<uint8_t>(type));
  out.push_back(static_cast<uint8_t>(n));
  out.insert(out.end(), payload, payload + n);
  const uint16_t crc = crc16(out.data() + 2, n + 2);
  out.push_back(static_cast<uint8_t>(crc & 0xFF));
  out.push_back(static_cast<uint8_t>(crc >> 8));
  return out;
}
inline std::vector<uint8_t> encode(MsgType type, const std::vector<uint8_t> & payload)
{
  return encode(type, payload.data(), payload.size());
}

class Writer
{
public:
  void u8(uint8_t v) {buf_.push_back(v);}
  void u32(uint32_t v) {for (int i = 0; i < 4; ++i) {buf_.push_back(static_cast<uint8_t>(v >> (8 * i)));}}
  void f32(float v) {uint32_t u; std::memcpy(&u, &v, 4); u32(u);}
  void str(const std::string & s) {buf_.insert(buf_.end(), s.begin(), s.end());}
  const std::vector<uint8_t> & bytes() const {return buf_;}

private:
  std::vector<uint8_t> buf_;
};

class Reader
{
public:
  explicit Reader(const std::vector<uint8_t> & b) : b_(b) {}
  bool ok(size_t n) const {return i_ + n <= b_.size();}
  uint8_t u8() {return ok(1) ? b_[i_++] : 0;}
  uint32_t u32()
  {
    if (!ok(4)) {i_ = b_.size(); return 0;}
    uint32_t v = 0;
    for (int k = 0; k < 4; ++k) {v |= static_cast<uint32_t>(b_[i_++]) << (8 * k);}
    return v;
  }
  float f32() {uint32_t u = u32(); float v; std::memcpy(&v, &u, 4); return v;}
  std::string rest() {std::string s(b_.begin() + static_cast<long>(i_), b_.end()); i_ = b_.size(); return s;}
  size_t left() const {return b_.size() - i_;}

private:
  const std::vector<uint8_t> & b_;
  size_t i_ = 0;
};

// ---------- reading: a byte-at-a-time parser that resynchronises after noise or a bad CRC ----------
class Parser
{
public:
  // returns true when `frame` holds a complete, CRC-checked frame
  bool push(uint8_t byte, Frame & frame)
  {
    switch (state_) {
      case 0: if (byte == SYNC0) {state_ = 1;} return false;
      case 1: state_ = (byte == SYNC1) ? 2 : (byte == SYNC0 ? 1 : 0); return false;
      case 2: type_ = byte; state_ = 3; return false;
      case 3:
        len_ = byte;
        if (len_ > MAX_PAYLOAD) {state_ = 0; ++errors_; return false;}
        payload_.clear();
        state_ = len_ ? 4 : 5;
        return false;
      case 4:
        payload_.push_back(byte);
        if (payload_.size() == len_) {state_ = 5;}
        return false;
      case 5: crc_lo_ = byte; state_ = 6; return false;
      case 6: {
          state_ = 0;
          std::vector<uint8_t> chk{type_, len_};
          chk.insert(chk.end(), payload_.begin(), payload_.end());
          const uint16_t crc = static_cast<uint16_t>(crc_lo_ | (byte << 8));
          if (crc != crc16(chk.data(), chk.size())) {++errors_; return false;}
          frame.type = static_cast<MsgType>(type_);
          frame.payload = payload_;
          return true;
        }
      default: state_ = 0; return false;
    }
  }
  size_t errors() const {return errors_;}

private:
  int state_ = 0;
  uint8_t type_ = 0, len_ = 0, crc_lo_ = 0;
  std::vector<uint8_t> payload_;
  size_t errors_ = 0;
};

// ---------- messages ----------
struct Imu
{
  std::array<float, 4> q{{0.F, 0.F, 0.F, 1.F}};   // x y z w
  std::array<float, 3> gyro{{0.F, 0.F, 0.F}};     // rad/s
  std::array<float, 3> accel{{0.F, 0.F, 0.F}};    // m/s^2
};

struct State
{
  uint32_t ms = 0;
  std::vector<float> position, velocity;
  bool has_imu = false;
  Imu imu;
};

inline std::vector<uint8_t> make_command(const std::vector<float> & values)
{
  Writer w;
  w.u8(static_cast<uint8_t>(values.size()));
  for (float v : values) {w.f32(v);}
  return encode(MsgType::COMMAND, w.bytes());
}

inline bool parse_command(const Frame & f, std::vector<float> & values)
{
  if (f.type != MsgType::COMMAND) {return false;}
  Reader r(f.payload);
  const uint8_t n = r.u8();
  if (n > MAX_JOINTS || r.left() != static_cast<size_t>(n) * 4) {return false;}
  values.resize(n);
  for (auto & v : values) {v = r.f32();}
  return true;
}

inline std::vector<uint8_t> make_state(const State & s)
{
  Writer w;
  w.u32(s.ms);
  w.u8(static_cast<uint8_t>(s.position.size()));
  for (size_t i = 0; i < s.position.size(); ++i) {
    w.f32(s.position[i]);
    w.f32(i < s.velocity.size() ? s.velocity[i] : 0.F);
  }
  w.u8(s.has_imu ? 1 : 0);
  if (s.has_imu) {
    for (float v : s.imu.q) {w.f32(v);}
    for (float v : s.imu.gyro) {w.f32(v);}
    for (float v : s.imu.accel) {w.f32(v);}
  }
  return encode(MsgType::STATE, w.bytes());
}

inline bool parse_state(const Frame & f, State & s)
{
  if (f.type != MsgType::STATE) {return false;}
  Reader r(f.payload);
  s.ms = r.u32();
  const uint8_t n = r.u8();
  if (n > MAX_JOINTS || !r.ok(static_cast<size_t>(n) * 8 + 1)) {return false;}
  s.position.resize(n);
  s.velocity.resize(n);
  for (uint8_t i = 0; i < n; ++i) {
    s.position[i] = r.f32();
    s.velocity[i] = r.f32();
  }
  s.has_imu = r.u8() != 0;
  if (s.has_imu) {
    if (!r.ok(40)) {return false;}
    for (auto & v : s.imu.q) {v = r.f32();}
    for (auto & v : s.imu.gyro) {v = r.f32();}
    for (auto & v : s.imu.accel) {v = r.f32();}
  }
  return true;
}

struct Hello
{
  uint8_t version = 0, joints = 0, has_imu = 0;
  std::string robot;
};

inline std::vector<uint8_t> make_hello()
{
  const uint8_t v = VERSION;
  return encode(MsgType::HELLO, &v, 1);
}

inline std::vector<uint8_t> make_hello_ack(uint8_t joints, bool has_imu, const std::string & robot)
{
  Writer w;
  w.u8(VERSION);
  w.u8(joints);
  w.u8(has_imu ? 1 : 0);
  w.str(robot.substr(0, 64));
  return encode(MsgType::HELLO_ACK, w.bytes());
}

inline bool parse_hello_ack(const Frame & f, Hello & h)
{
  if (f.type != MsgType::HELLO_ACK || f.payload.size() < 3) {return false;}
  Reader r(f.payload);
  h.version = r.u8();
  h.joints = r.u8();
  h.has_imu = r.u8();
  h.robot = r.rest();
  return true;
}

inline std::vector<uint8_t> make_enable(bool on)
{
  const uint8_t v = on ? 1 : 0;
  return encode(MsgType::ENABLE, &v, 1);
}

inline std::vector<uint8_t> make_fault(Fault code, const std::string & text)
{
  Writer w;
  w.u8(static_cast<uint8_t>(code));
  w.str(text.substr(0, 200));
  return encode(MsgType::FAULT, w.bytes());
}

}  // namespace ros2lab_bridge
