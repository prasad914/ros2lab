// Actuators of the ROS2Lab course robots, for the ESP32 (Arduino core 3.x) and the Arduino Mega 2560:
//   ServoPwm      a hobby servo (MG996R, DS3218, SG90) on a GPIO pin: position in rad, no feedback (the estimate ramps)
//   ServoPca9685  the same, on a PCA9685 16-channel PWM board (I2C 0x40) for robots with many servos (legs)
//   StsServo      a Feetech STS3215 serial bus servo (SO-101 style arms): position command and real position feedback
//   DcMotor       a DC gear motor with a quadrature encoder and a TB6612FNG / L298N / BTS7960 driver: velocity (rad/s)
//                 or position (rad) control with a PID loop
#pragma once
#include <Arduino.h>
#include <Wire.h>
#include "bridge_core.h"
#if defined(ARDUINO_ARCH_AVR)
#include <Servo.h>
#endif

namespace bridge
{

static inline float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }

// ---------------- hobby servo ----------------
// us_min..us_max is the pulse range of the servo's whole travel (e.g. 500..2500 us for 180 deg on an MG996R, 270 deg on
// a DS3218); the middle of it is the servo's centre. zero_rad is the joint angle at the servo's centre (calibration:
// usually 0). Commands are clamped to the joint's limits rad_min..rad_max, never to the servo's travel.
struct ServoRange { uint16_t us_min, us_max; float travel_rad; float rad_min, rad_max; float max_speed; bool invert; float zero_rad; };

class ServoBase : public Actuator
{
public:
  explicit ServoBase(const ServoRange & r, float initial = 0) : r_(r), target_(initial), est_(initial) {}
  void enable(bool on) override { on_ = on; if (!on) detach(); else attach(); }
  void command(float v) override { target_ = clampf(v, r_.rad_min, r_.rad_max); }
  void update(float dt) override
  {
    // a hobby servo has no feedback: estimate where it is from its speed (rad/s at no load, from its data sheet)
    const float step = r_.max_speed * dt, d = target_ - est_;
    vel_ = d > step ? r_.max_speed : (d < -step ? -r_.max_speed : d / (dt > 0 ? dt : 1));
    est_ += d > step ? step : (d < -step ? -step : d);
    if (on_) write_us(us(target_));
  }
  float position() override { return est_; }
  float velocity() override { return vel_; }

protected:
  uint16_t us(float rad) const
  {
    float k = (rad - r_.zero_rad) / r_.travel_rad;    // -0.5 .. 0.5 over the servo's travel
    if (r_.invert) k = -k;
    return (uint16_t)(0.5f * (r_.us_min + r_.us_max) + clampf(k, -0.5f, 0.5f) * (r_.us_max - r_.us_min));
  }
  virtual void attach() {}
  virtual void detach() {}
  virtual void write_us(uint16_t us) = 0;
  ServoRange r_;
  float target_, est_, vel_ = 0;
  bool on_ = false;
};

class ServoPwm : public ServoBase
{
public:
  ServoPwm(uint8_t pin, const ServoRange & r, float initial = 0) : ServoBase(r, initial), pin_(pin) {}
  void begin() override {}

protected:
#if defined(ARDUINO_ARCH_ESP32)
  void attach() override { ledcAttach(pin_, 50, 16); }                 // 50 Hz, 16-bit duty
  void detach() override { ledcDetach(pin_); }
  void write_us(uint16_t us) override { ledcWrite(pin_, (uint32_t)us * 65535UL / 20000UL); }
#else
  void attach() override { if (!s_.attached()) s_.attach(pin_, r_.us_min, r_.us_max); }   // the library's default is 544..2400 us
  void detach() override { s_.detach(); }
  void write_us(uint16_t us) override { s_.writeMicroseconds(us); }
  Servo s_;
#endif
  uint8_t pin_;
};

// ---------------- PCA9685 (16 channels, I2C) ----------------
class Pca9685
{
public:
  explicit Pca9685(uint8_t addr = 0x40) : addr_(addr) {}
  void begin(TwoWire & wire = Wire)
  {
    w_ = &wire;
    write8(0x00, 0x10);                         // MODE1: sleep
    write8(0xFE, 121);                          // PRESCALE: 25 MHz / (4096 * 50 Hz) - 1 = 121
    write8(0x00, 0x20);                         // MODE1: wake, auto-increment
    delay(1);
    write8(0x00, 0xA0);                         // restart + auto-increment
  }
  void set_us(uint8_t ch, uint16_t us)          // 20 ms period: 4096 ticks
  {
    const uint16_t off = us ? (uint16_t)((uint32_t)us * 4096UL / 20000UL) : 0;
    w_->beginTransmission(addr_);
    w_->write(0x06 + 4 * ch);
    w_->write(0); w_->write(0);                 // ON at 0
    w_->write(off & 0xFF); w_->write(us ? (off >> 8) : 0x10);   // full OFF when us = 0 (servo relaxed)
    w_->endTransmission();
  }

private:
  void write8(uint8_t reg, uint8_t v) { w_->beginTransmission(addr_); w_->write(reg); w_->write(v); w_->endTransmission(); }
  uint8_t addr_;
  TwoWire * w_ = &Wire;
};

class ServoPca9685 : public ServoBase
{
public:
  ServoPca9685(Pca9685 & board, uint8_t channel, const ServoRange & r, float initial = 0) : ServoBase(r, initial), b_(board), ch_(channel) {}
  void begin() override {}

protected:
  void detach() override { b_.set_us(ch_, 0); }
  void write_us(uint16_t us) override { b_.set_us(ch_, us); }
  Pca9685 & b_;
  uint8_t ch_;
};

// ---------------- Feetech STS3215 serial bus servo (half duplex, 1 Mbps) ----------------
class StsBus
{
public:
  explicit StsBus(HardwareSerial & s) : s_(s) {}
  // the bus runs at 1 Mbit/s through a half-duplex adapter (Waveshare / Feetech bus-servo board, or a 74LS241 circuit)
#if defined(ARDUINO_ARCH_ESP32)
  void begin(int8_t rx_pin, int8_t tx_pin, uint32_t baud = 1000000) { s_.begin(baud, SERIAL_8N1, rx_pin, tx_pin); }
#else
  void begin(int8_t, int8_t, uint32_t baud = 1000000) { s_.begin(baud); }
#endif
  void write_pos(uint8_t id, int16_t pos, uint16_t speed)
  {
    const uint8_t p[] = {0x2A, (uint8_t)(pos & 0xFF), (uint8_t)(pos >> 8), 0, 0, (uint8_t)(speed & 0xFF), (uint8_t)(speed >> 8)};
    packet(id, 0x03, p, sizeof(p));             // WRITE goal position, time, speed
  }
  void torque(uint8_t id, bool on) { const uint8_t p[] = {0x28, (uint8_t)(on ? 1 : 0)}; packet(id, 0x03, p, 2); }
  bool read_pos(uint8_t id, int16_t & pos, int16_t & speed)
  {
    const uint8_t p[] = {0x38, 4};              // present position (2) + present speed (2)
    while (s_.available()) s_.read();
    packet(id, 0x02, p, 2);
    uint8_t r[10]; uint8_t n = 0; const uint32_t t0 = micros();
    while (n < 10 && micros() - t0 < 3000) if (s_.available()) r[n++] = (uint8_t)s_.read();
    if (n < 10 || r[0] != 0xFF || r[1] != 0xFF || r[2] != id) return false;
    pos = (int16_t)(r[5] | (r[6] << 8));
    uint16_t sp = (uint16_t)(r[7] | (r[8] << 8));
    speed = (sp & 0x8000) ? -(int16_t)(sp & 0x7FFF) : (int16_t)sp;   // bit 15 = direction
    return true;
  }

private:
  void packet(uint8_t id, uint8_t instr, const uint8_t * p, uint8_t n)
  {
    uint8_t sum = id + (n + 2) + instr;
    s_.write(0xFF); s_.write(0xFF); s_.write(id); s_.write((uint8_t)(n + 2)); s_.write(instr);
    for (uint8_t i = 0; i < n; ++i) { s_.write(p[i]); sum += p[i]; }
    s_.write((uint8_t)~sum);
    s_.flush();
  }
  HardwareSerial & s_;
};

class StsServo : public Actuator
{
public:
  // offset: the raw position (0..4095) that is 0 rad in the URDF; sign: +1 or -1
  StsServo(StsBus & bus, uint8_t id, int16_t offset = 2048, int8_t sign = 1, float lo = -3.0f, float hi = 3.0f)
  : bus_(bus), id_(id), off_(offset), sign_(sign), lo_(lo), hi_(hi) {}
  void begin() override {}
  void enable(bool on) override { bus_.torque(id_, on); on_ = on; }
  void command(float v) override { target_ = clampf(v, lo_, hi_); dirty_ = true; }
  void update(float) override
  {
    if (on_ && dirty_) { bus_.write_pos(id_, (int16_t)(off_ + sign_ * target_ * 4096.0f / 6.2831853f), 0); dirty_ = false; }
    if (++skip_ % 4 == 0) {                      // read back at a quarter of the loop rate (the bus is shared)
      int16_t p, s;
      if (bus_.read_pos(id_, p, s)) { pos_ = sign_ * (p - off_) * 6.2831853f / 4096.0f; vel_ = sign_ * s * 6.2831853f / 4096.0f; }
    }
  }
  float position() override { return pos_; }
  float velocity() override { return vel_; }

private:
  StsBus & bus_;
  uint8_t id_;
  int16_t off_;
  int8_t sign_;
  float lo_, hi_, target_ = 0, pos_ = 0, vel_ = 0;
  bool on_ = false, dirty_ = false;
  uint8_t skip_ = 0;
};

// ---------------- DC motor with encoder ----------------
enum class Driver : uint8_t { TB6612, L298N, BTS7960 };
struct MotorPins { Driver driver; uint8_t pwm_a, pin_b, pin_c, enc_a, enc_b; };   // TB6612/L298N: PWM, IN1, IN2; BTS7960: RPWM, LPWM, (unused)
struct MotorTuning { float counts_per_rev; float kp, ki, kd; float max_vel; bool position_mode; bool invert; };

void encoder_attach(uint8_t idx, uint8_t pin_a, uint8_t pin_b);   // actuators.cpp: interrupt trampolines
long encoder_count(uint8_t idx);

class DcMotor : public Actuator
{
public:
  DcMotor(uint8_t index, const MotorPins & p, const MotorTuning & t) : i_(index), p_(p), t_(t) {}
  void begin() override
  {
    pinMode(p_.pwm_a, OUTPUT); pinMode(p_.pin_b, OUTPUT);
    if (p_.driver != Driver::BTS7960) pinMode(p_.pin_c, OUTPUT);
#if defined(ARDUINO_ARCH_ESP32)
    ledcAttach(p_.pwm_a, 20000, 10);            // 20 kHz, 10-bit: quiet motors
    if (p_.driver == Driver::BTS7960) ledcAttach(p_.pin_b, 20000, 10);
#endif
    encoder_attach(i_, p_.enc_a, p_.enc_b);
    last_ = encoder_count(i_);
    drive(0);
  }
  void enable(bool on) override { on_ = on; integ_ = 0; if (!on) drive(0); }
  void command(float v) override { target_ = t_.position_mode ? v : clampf(v, -t_.max_vel, t_.max_vel); }
  void update(float dt) override
  {
    if (dt <= 0) return;
    const long c = encoder_count(i_);
    const float k = (t_.invert ? -1.0f : 1.0f) * 6.2831853f / t_.counts_per_rev;
    pos_ = c * k;
    const float v_now = (c - last_) * k / dt;
    vel_ = 0.7f * vel_ + 0.3f * v_now;            // a light low-pass on the measured speed
    last_ = c;
    if (!on_) return;
    const float want = t_.position_mode ? clampf(2.5f * (target_ - pos_), -t_.max_vel, t_.max_vel) : target_;
    const float e = want - vel_;
    integ_ = clampf(integ_ + e * dt, -1.0f, 1.0f);
    const float de = (e - prev_e_) / dt; prev_e_ = e;
    float u = t_.kp * e + t_.ki * integ_ + t_.kd * de + want / t_.max_vel;   // feed-forward + PID
    if (!t_.position_mode && fabsf(target_) < 1e-3f && fabsf(vel_) < 0.05f) { u = 0; integ_ = 0; }
    drive(clampf(u, -1, 1) * (t_.invert ? -1 : 1));
  }
  float position() override { return pos_; }
  float velocity() override { return vel_; }

private:
  void pwm(uint8_t pin, uint16_t duty)
  {
#if defined(ARDUINO_ARCH_ESP32)
    ledcWrite(pin, duty);                        // 0..1023
#else
    analogWrite(pin, duty >> 2);                 // 0..255
#endif
  }
  void drive(float u)                            // -1 .. 1
  {
    const uint16_t d = (uint16_t)(fabsf(u) * 1023);
    if (p_.driver == Driver::BTS7960) { pwm(p_.pwm_a, u > 0 ? d : 0); pwm(p_.pin_b, u < 0 ? d : 0); return; }
    digitalWrite(p_.pin_b, u > 0 ? HIGH : LOW);
    digitalWrite(p_.pin_c, u < 0 ? HIGH : LOW);
    pwm(p_.pwm_a, d);
  }
  uint8_t i_;
  MotorPins p_;
  MotorTuning t_;
  float target_ = 0, pos_ = 0, vel_ = 0, integ_ = 0, prev_e_ = 0;
  long last_ = 0;
  bool on_ = false;
};

}  // namespace bridge
