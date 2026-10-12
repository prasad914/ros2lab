// ROS2Lab bridge protocol, microcontroller side: the same frames as ros2lab_hardware/protocol.hpp (the Jetson side),
// written without the C++ standard library so that it also fits an Arduino Mega (AVR). A host test
// (firmware/test/test_interop.cpp) checks that both sides produce and read identical bytes.
//   frame: 0xAA 0x55 | type | length | payload | CRC-16/CCITT-FALSE (little endian), CRC over type, length, payload
#pragma once
#include <stdint.h>
#include <string.h>

namespace bridge
{

static const uint8_t SYNC0 = 0xAA, SYNC1 = 0x55, VERSION = 1;
static const uint8_t MAX_PAYLOAD = 240, MAX_JOINTS = 24;
static const uint32_t WATCHDOG_MS = 500;
// (T_ prefix: AVR headers already define PING, a port register)
enum Type : uint8_t { T_HELLO = 0x01, T_COMMAND = 0x02, T_ENABLE = 0x03, T_PING = 0x04, T_HELLO_ACK = 0x81, T_STATE = 0x82, T_PONG = 0x84, T_FAULT = 0x85 };
enum FaultCode : uint8_t { F_NONE = 0, F_WATCHDOG = 1, F_BAD_COMMAND = 2, F_OVERCURRENT = 3, F_IMU = 4, F_LOW_BATTERY = 5 };

inline uint16_t crc16(const uint8_t * d, uint16_t n, uint16_t crc = 0xFFFF)
{
  for (uint16_t i = 0; i < n; ++i) {
    crc ^= (uint16_t)d[i] << 8;
    for (uint8_t b = 0; b < 8; ++b) crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);
  }
  return crc;
}

// builds one frame in a caller-owned buffer (at least MAX_PAYLOAD + 6 bytes)
class FrameWriter
{
public:
  FrameWriter(uint8_t * buf, Type t) : b_(buf), n_(4) { b_[0] = SYNC0; b_[1] = SYNC1; b_[2] = t; }
  void u8(uint8_t v) { if (n_ < MAX_PAYLOAD + 4) b_[n_++] = v; }
  void u32(uint32_t v) { for (uint8_t i = 0; i < 4; ++i) u8((uint8_t)(v >> (8 * i))); }
  void f32(float v) { uint32_t u; memcpy(&u, &v, 4); u32(u); }
  void str(const char * s) { while (*s) u8((uint8_t)*s++); }
  // finishes the frame: returns its total length
  uint16_t finish()
  {
    b_[3] = (uint8_t)(n_ - 4);
    const uint16_t c = crc16(b_ + 2, (uint16_t)(n_ - 2));
    b_[n_++] = (uint8_t)(c & 0xFF);
    b_[n_++] = (uint8_t)(c >> 8);
    return n_;
  }

private:
  uint8_t * b_;
  uint16_t n_;
};

// reads frames byte by byte, resynchronising after noise or a bad CRC
class Parser
{
public:
  // true when a complete frame is ready: type(), length(), payload()
  bool push(uint8_t c)
  {
    switch (st_) {
      case 0: if (c == SYNC0) st_ = 1; return false;
      case 1: st_ = c == SYNC1 ? 2 : (c == SYNC0 ? 1 : 0); return false;
      case 2: type_ = c; st_ = 3; return false;
      case 3: len_ = c; i_ = 0; if (len_ > MAX_PAYLOAD) { st_ = 0; ++errors_; return false; } st_ = len_ ? 4 : 5; return false;
      case 4: pl_[i_++] = c; if (i_ == len_) st_ = 5; return false;
      case 5: lo_ = c; st_ = 6; return false;
      case 6: {
        st_ = 0;
        uint16_t crc = crc16(&type_, 1);
        crc = crc16(&len_, 1, crc);
        crc = crc16(pl_, len_, crc);
        if (crc != (uint16_t)(lo_ | (c << 8))) { ++errors_; return false; }
        return true;
      }
    }
    st_ = 0;
    return false;
  }
  uint8_t type() const { return type_; }
  uint8_t length() const { return len_; }
  const uint8_t * payload() const { return pl_; }
  uint16_t errors() const { return errors_; }
  static float f32(const uint8_t * p) { uint32_t u = (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); float v; memcpy(&v, &u, 4); return v; }

private:
  uint8_t st_ = 0, type_ = 0, len_ = 0, i_ = 0, lo_ = 0;
  uint8_t pl_[MAX_PAYLOAD];
  uint16_t errors_ = 0;
};

}  // namespace bridge
