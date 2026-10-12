// IMUs on I2C, without extra libraries:
//   Mpu6050  (GY-521 board, 0x68): gyro + accelerometer; orientation from a complementary filter (yaw drifts slowly)
//   Bno055   (0x28): Bosch's own 9-axis fusion (NDOF): absolute orientation
// Output follows sensor_msgs/Imu: quaternion x y z w, angular velocity rad/s, linear acceleration m/s^2 (with gravity).
#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <math.h>
#include "bridge_core.h"

namespace bridge
{

class I2cDev
{
protected:
  explicit I2cDev(uint8_t addr) : addr_(addr) {}
  bool write8(uint8_t reg, uint8_t v) { Wire.beginTransmission(addr_); Wire.write(reg); Wire.write(v); return Wire.endTransmission() == 0; }
  bool read(uint8_t reg, uint8_t * buf, uint8_t n)
  {
    Wire.beginTransmission(addr_); Wire.write(reg);
    if (Wire.endTransmission(false) != 0) return false;
    if (Wire.requestFrom(addr_, n) != n) return false;
    for (uint8_t i = 0; i < n; ++i) buf[i] = (uint8_t)Wire.read();
    return true;
  }
  uint8_t addr_;
};

class Mpu6050 : public Imu, I2cDev
{
public:
  explicit Mpu6050(uint8_t addr = 0x68) : I2cDev(addr) {}
  bool begin() override
  {
    if (!write8(0x6B, 0x01)) return false;     // PWR_MGMT_1: wake, PLL with X gyro
    write8(0x1A, 0x03);                        // CONFIG: 44 Hz low-pass
    write8(0x1B, 0x08);                        // GYRO_CONFIG: +-500 deg/s (65.5 LSB per deg/s)
    write8(0x1C, 0x08);                        // ACCEL_CONFIG: +-4 g (8192 LSB per g)
    last_ = micros();
    return true;
  }
  bool read(float q[4], float g[3], float a[3]) override
  {
    uint8_t b[14];
    if (!I2cDev::read(0x3B, b, 14)) return false;
    const float ax = (int16_t)(b[0] << 8 | b[1]) / 8192.0f * 9.80665f, ay = (int16_t)(b[2] << 8 | b[3]) / 8192.0f * 9.80665f, az = (int16_t)(b[4] << 8 | b[5]) / 8192.0f * 9.80665f;
    const float d2r = 0.0174532925f / 65.5f;
    const float gx = (int16_t)(b[8] << 8 | b[9]) * d2r, gy = (int16_t)(b[10] << 8 | b[11]) * d2r, gz = (int16_t)(b[12] << 8 | b[13]) * d2r;
    const uint32_t now = micros(); const float dt = (now - last_) * 1e-6f; last_ = now;
    // complementary filter: gyro short term, gravity direction long term
    roll_ = 0.98f * (roll_ + gx * dt) + 0.02f * atan2f(ay, az);
    pitch_ = 0.98f * (pitch_ + gy * dt) + 0.02f * atan2f(-ax, sqrtf(ay * ay + az * az));
    yaw_ += gz * dt;
    const float cr = cosf(roll_ / 2), sr = sinf(roll_ / 2), cp = cosf(pitch_ / 2), sp = sinf(pitch_ / 2), cy = cosf(yaw_ / 2), sy = sinf(yaw_ / 2);
    q[0] = sr * cp * cy - cr * sp * sy; q[1] = cr * sp * cy + sr * cp * sy; q[2] = cr * cp * sy - sr * sp * cy; q[3] = cr * cp * cy + sr * sp * sy;
    g[0] = gx; g[1] = gy; g[2] = gz; a[0] = ax; a[1] = ay; a[2] = az;
    return true;
  }

private:
  uint32_t last_ = 0;
  float roll_ = 0, pitch_ = 0, yaw_ = 0;
};

class Bno055 : public Imu, I2cDev
{
public:
  explicit Bno055(uint8_t addr = 0x28) : I2cDev(addr) {}
  bool begin() override
  {
    uint8_t id = 0;
    if (!I2cDev::read(0x00, &id, 1) || id != 0xA0) return false;   // CHIP_ID
    write8(0x3D, 0x00); delay(25);                                 // CONFIG mode
    write8(0x3B, 0x06);                                            // UNIT_SEL: m/s^2, rad/s, radians
    write8(0x3D, 0x0C); delay(20);                                 // NDOF fusion mode
    return true;
  }
  bool read(float q[4], float g[3], float a[3]) override
  {
    uint8_t b[8], gb[6], ab[6];
    if (!I2cDev::read(0x20, b, 8) || !I2cDev::read(0x14, gb, 6) || !I2cDev::read(0x08, ab, 6)) return false;
    const float s = 1.0f / 16384.0f;
    q[3] = (int16_t)(b[1] << 8 | b[0]) * s; q[0] = (int16_t)(b[3] << 8 | b[2]) * s; q[1] = (int16_t)(b[5] << 8 | b[4]) * s; q[2] = (int16_t)(b[7] << 8 | b[6]) * s;
    for (uint8_t i = 0; i < 3; ++i) { g[i] = (int16_t)(gb[2 * i + 1] << 8 | gb[2 * i]) / 900.0f; a[i] = (int16_t)(ab[2 * i + 1] << 8 | ab[2 * i]) / 100.0f; }
    return true;
  }
};

}  // namespace bridge
