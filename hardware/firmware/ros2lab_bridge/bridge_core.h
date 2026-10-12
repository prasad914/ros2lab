// The board's logic, independent of the hardware: answers HELLO, applies COMMANDs to the actuators, reports STATE,
// enables / disables the motors and stops everything when the Jetson goes quiet (watchdog). Hardware lives behind the
// Actuator and Imu interfaces (actuators.h, imu.h), so the same core runs on an ESP32, an Arduino Mega and in the
// host tests (firmware/test).
#pragma once
#include "bridge_proto.h"

namespace bridge
{

class Actuator
{
public:
  virtual ~Actuator() {}
  virtual void begin() = 0;
  virtual void enable(bool on) = 0;
  virtual void command(float value) = 0;   // position (rad or m) or velocity (rad/s), as the joint is configured
  virtual void update(float dt) = 0;       // the control loop (PID, ramps), called every few milliseconds
  virtual float position() = 0;
  virtual float velocity() = 0;
};

class Imu
{
public:
  virtual ~Imu() {}
  virtual bool begin() = 0;
  // orientation quaternion x y z w, angular velocity rad/s, linear acceleration m/s^2 (gravity included, as sensor_msgs/Imu)
  virtual bool read(float q[4], float gyro[3], float accel[3]) = 0;
};

class Link
{
public:
  virtual ~Link() {}
  virtual void send(const uint8_t * data, uint16_t n) = 0;
};

class Core
{
public:
  Core(Actuator ** acts, uint8_t n, const char * robot_id, Imu * imu = 0)
  : a_(acts), n_(n), id_(robot_id), imu_(imu) {}

  void begin()
  {
    for (uint8_t i = 0; i < n_; ++i) a_[i]->begin();
    imu_ok_ = imu_ && imu_->begin();
  }

  // one complete frame from a link (USB serial or UDP); the answer goes back on the same link
  void handle(const Parser & p, uint32_t now_ms, Link & link)
  {
    switch (p.type()) {
      case T_HELLO: {
        FrameWriter w(out_, T_HELLO_ACK);
        w.u8(VERSION); w.u8(n_); w.u8(imu_ok_ ? 1 : 0); w.str(id_);
        link.send(out_, w.finish());
        break;
      }
      case T_PING: { FrameWriter w(out_, T_PONG); link.send(out_, w.finish()); break; }
      case T_ENABLE:
        enabled_ = p.length() >= 1 && p.payload()[0] == 1;
        for (uint8_t i = 0; i < n_; ++i) a_[i]->enable(enabled_);
        last_cmd_ = now_ms; watchdog_tripped_ = false;
        break;
      case T_COMMAND: {
        const uint8_t k = p.length() ? p.payload()[0] : 0;
        if (k == n_ && p.length() == 1 + 4 * k) {
          if (enabled_) for (uint8_t i = 0; i < n_; ++i) a_[i]->command(Parser::f32(p.payload() + 1 + 4 * i));
          last_cmd_ = now_ms;
          if (watchdog_tripped_ && enabled_) { watchdog_tripped_ = false; for (uint8_t i = 0; i < n_; ++i) a_[i]->enable(true); }
        } else if (k != 0) {   // an empty COMMAND only asks for the state
          fault(link, F_BAD_COMMAND, "COMMAND has the wrong number of joints");
        }
        send_state(now_ms, link);
        break;
      }
      default: break;
    }
  }

  // the control loop: actuators and the watchdog (call every 2 to 10 ms)
  void tick(uint32_t now_ms, float dt, Link * fault_link = 0)
  {
    if (enabled_ && !watchdog_tripped_ && now_ms - last_cmd_ > WATCHDOG_MS) {
      watchdog_tripped_ = true;
      for (uint8_t i = 0; i < n_; ++i) a_[i]->enable(false);
      if (fault_link) fault(*fault_link, F_WATCHDOG, "no command for 500 ms: motors stopped");
    }
    for (uint8_t i = 0; i < n_; ++i) a_[i]->update(dt);
  }

  bool enabled() const { return enabled_ && !watchdog_tripped_; }
  uint8_t joints() const { return n_; }

private:
  void send_state(uint32_t now_ms, Link & link)
  {
    FrameWriter w(out_, T_STATE);
    w.u32(now_ms); w.u8(n_);
    for (uint8_t i = 0; i < n_; ++i) { w.f32(a_[i]->position()); w.f32(a_[i]->velocity()); }
    float q[4] = {0, 0, 0, 1}, g[3] = {0, 0, 0}, ac[3] = {0, 0, 0};
    const bool imu = imu_ok_ && imu_->read(q, g, ac);
    w.u8(imu ? 1 : 0);
    if (imu) { for (uint8_t i = 0; i < 4; ++i) w.f32(q[i]); for (uint8_t i = 0; i < 3; ++i) w.f32(g[i]); for (uint8_t i = 0; i < 3; ++i) w.f32(ac[i]); }
    link.send(out_, w.finish());
  }
  void fault(Link & link, FaultCode c, const char * text)
  {
    FrameWriter w(out_, T_FAULT);
    w.u8(c); w.str(text);
    link.send(out_, w.finish());
  }

  Actuator ** a_;
  uint8_t n_;
  const char * id_;
  Imu * imu_;
  bool imu_ok_ = false, enabled_ = false, watchdog_tripped_ = false;
  uint32_t last_cmd_ = 0;
  uint8_t out_[MAX_PAYLOAD + 8];
};

}  // namespace bridge
