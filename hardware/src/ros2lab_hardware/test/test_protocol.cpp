#include <gtest/gtest.h>

#include <cmath>

#include "ros2lab_hardware/protocol.hpp"

namespace pb = ros2lab_bridge;

static std::vector<pb::Frame> parse_all(const std::vector<uint8_t> & bytes, pb::Parser & p)
{
  std::vector<pb::Frame> out;
  pb::Frame f;
  for (uint8_t b : bytes) {if (p.push(b, f)) {out.push_back(f);}}
  return out;
}

TEST(Protocol, CrcKnownValue)
{
  const char * s = "123456789";   // CRC-16/CCITT-FALSE check value
  EXPECT_EQ(pb::crc16(reinterpret_cast<const uint8_t *>(s), 9), 0x29B1);
}

TEST(Protocol, CommandRoundTrip)
{
  pb::Parser p;
  const std::vector<float> v{0.5F, -1.25F, 3.0F};
  const auto frames = parse_all(pb::make_command(v), p);
  ASSERT_EQ(frames.size(), 1u);
  std::vector<float> back;
  ASSERT_TRUE(pb::parse_command(frames[0], back));
  EXPECT_EQ(back, v);
}

TEST(Protocol, StateWithImuRoundTrip)
{
  pb::State s;
  s.ms = 123456;
  s.position = {0.1F, 0.2F};
  s.velocity = {1.5F, -2.0F};
  s.has_imu = true;
  s.imu.q = {0.F, 0.F, 0.7071F, 0.7071F};
  s.imu.gyro = {0.01F, 0.02F, 0.03F};
  s.imu.accel = {0.F, 0.F, 9.81F};
  pb::Parser p;
  const auto frames = parse_all(pb::make_state(s), p);
  ASSERT_EQ(frames.size(), 1u);
  pb::State r;
  ASSERT_TRUE(pb::parse_state(frames[0], r));
  EXPECT_EQ(r.ms, 123456u);
  EXPECT_EQ(r.position, s.position);
  EXPECT_EQ(r.velocity, s.velocity);
  EXPECT_TRUE(r.has_imu);
  EXPECT_FLOAT_EQ(r.imu.accel[2], 9.81F);
}

TEST(Protocol, MaxJointsWithImuFits)
{
  pb::State s;
  s.position.assign(pb::MAX_JOINTS, 1.F);
  s.velocity.assign(pb::MAX_JOINTS, 2.F);
  s.has_imu = true;
  EXPECT_FALSE(pb::make_state(s).empty());
}

TEST(Protocol, ResyncAfterNoiseAndBadCrc)
{
  pb::Parser p;
  std::vector<uint8_t> bytes{0x00, 0xAA, 0x13, 0xAA};   // noise, a false start
  auto bad = pb::make_command({1.F});
  bad[6] ^= 0xFF;                                         // corrupt one payload byte
  bytes.insert(bytes.end(), bad.begin(), bad.end());
  const auto good = pb::make_command({2.F, 3.F});
  bytes.insert(bytes.end(), good.begin(), good.end());
  const auto frames = parse_all(bytes, p);
  ASSERT_EQ(frames.size(), 1u);
  std::vector<float> v;
  ASSERT_TRUE(pb::parse_command(frames[0], v));
  EXPECT_EQ(v, (std::vector<float>{2.F, 3.F}));
  EXPECT_GE(p.errors(), 1u);
}

TEST(Protocol, HelloAck)
{
  pb::Parser p;
  const auto frames = parse_all(pb::make_hello_ack(6, true, "arm6"), p);
  ASSERT_EQ(frames.size(), 1u);
  pb::Hello h;
  ASSERT_TRUE(pb::parse_hello_ack(frames[0], h));
  EXPECT_EQ(h.version, pb::VERSION);
  EXPECT_EQ(h.joints, 6);
  EXPECT_EQ(h.has_imu, 1);
  EXPECT_EQ(h.robot, "arm6");
}

TEST(Protocol, RejectsWrongSizes)
{
  pb::Frame f;
  f.type = pb::MsgType::COMMAND;
  f.payload = {3, 0, 0};   // says 3 floats, has 2 bytes
  std::vector<float> v;
  EXPECT_FALSE(pb::parse_command(f, v));
}
