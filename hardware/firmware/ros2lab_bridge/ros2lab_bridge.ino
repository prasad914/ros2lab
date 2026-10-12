// ROS2Lab bridge firmware: the microcontroller between the Jetson (ROS 2 Jazzy, ros2_control) and the robot's
// servos, motors, encoders and IMU. Works on:
//   ESP32 (DevKitC, ESP32-S3)  USB serial and/or Wi-Fi (UDP port 8888)   Arduino IDE: board "ESP32 Dev Module", core 3.x
//   Arduino Mega 2560          USB serial                                Arduino IDE: board "Arduino Mega or Mega 2560"
// The robot (which joints, which pins) is in robot_config.h: generate it for your robot with
//   ros2 run ros2lab_hardware ros2lab_robot_setup <robot>_description --type <arm|diff|mecanum|ackermann|legged|...>
// The Jetson side is the ros2lab_hardware/BridgeSystem plugin; the protocol is in bridge_proto.h.
// Safety: the motors only move after the Jetson sends ENABLE, and they stop 500 ms after the last command.
#include <Arduino.h>
#include <Wire.h>
#include "bridge_core.h"
#include "actuators.h"
#include "imu.h"
#include "robot_config.h"   // ROBOT_ID, BRIDGE_BAUD, robot_setup(), optional WIFI_SSID / WIFI_PASS / WIFI_AP
#ifdef WIFI_PASS   // refuse to build with the example's default password (ros2lab_robot_setup makes a random one)
constexpr bool r2l_streq(const char* a, const char* b) { return *a == *b && (*a == '\0' || r2l_streq(a + 1, b + 1)); }
static_assert(!r2l_streq(WIFI_PASS, "change-this-password"), "Set your own WIFI_PASS in robot_config.h (ros2lab_robot_setup generates a random one)");
static_assert(sizeof(WIFI_PASS) > 8, "WIFI_PASS needs at least 8 characters (WPA2)");
#endif

#if defined(ARDUINO_ARCH_ESP32) && defined(WIFI_SSID)
#include <WiFi.h>
#include <WiFiUdp.h>
#define BRIDGE_WIFI 1
#endif
#ifndef UDP_PORT
#define UDP_PORT 8888
#endif
#ifndef CONTROL_PERIOD_US
#define CONTROL_PERIOD_US 5000   // 200 Hz control loop (PID, servo ramps)
#endif

static bridge::Actuator * actuators[bridge::MAX_JOINTS];
static uint8_t n_actuators = 0;
static bridge::Imu * imu = 0;
static bridge::Core * core = 0;

class SerialLink : public bridge::Link
{
public:
  void send(const uint8_t * d, uint16_t n) override { Serial.write(d, n); }
};
static SerialLink serial_link;
static bridge::Parser serial_parser;

#ifdef BRIDGE_WIFI
static WiFiUDP udp;
class UdpLink : public bridge::Link
{
public:
  void send(const uint8_t * d, uint16_t n) override { if (!peer_set) return; udp.beginPacket(peer, peer_port); udp.write(d, n); udp.endPacket(); }
  IPAddress peer;
  uint16_t peer_port = 0;
  bool peer_set = false;
  uint32_t last_rx = 0;
};
#ifndef PEER_LOCK_MS
#define PEER_LOCK_MS 2000   // while the Jetson talks, packets from any other address are ignored
#endif
static UdpLink udp_link;
static bridge::Parser udp_parser;
#endif

static bridge::Link * last_link = &serial_link;   // faults go to whoever talked last

void setup()
{
  Serial.begin(BRIDGE_BAUD);
  Wire.begin();
  Wire.setClock(400000);
  robot_setup(actuators, n_actuators, imu);
  static bridge::Core c(actuators, n_actuators, ROBOT_ID, imu);
  core = &c;
  core->begin();
#ifdef BRIDGE_WIFI
#ifdef WIFI_AP
  WiFi.softAP(WIFI_SSID, WIFI_PASS);           // the robot makes its own network: the Jetson joins it (ESP32 is 192.168.4.1)
#else
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);            // the robot joins the lab network: give it a fixed address in the router
  for (uint8_t i = 0; i < 40 && WiFi.status() != WL_CONNECTED; ++i) delay(250);
#endif
  WiFi.setSleep(false);                        // no power save: steady latency
  udp.begin(UDP_PORT);
#endif
}

void loop()
{
  const uint32_t now = millis();
  while (Serial.available()) {
    if (serial_parser.push((uint8_t)Serial.read())) { last_link = &serial_link; core->handle(serial_parser, now, serial_link); }
  }
#ifdef BRIDGE_WIFI
  int size = udp.parsePacket();
  if (size > 0) {
    uint8_t buf[256];
    const int n = udp.read(buf, sizeof(buf));
    const bool same = udp_link.peer_set && udp.remoteIP() == udp_link.peer && udp.remotePort() == udp_link.peer_port;
    if (!same && udp_link.peer_set && now - udp_link.last_rx < PEER_LOCK_MS) return;   // another computer while the Jetson is connected
    if (!same) { udp_link.peer = udp.remoteIP(); udp_link.peer_port = udp.remotePort(); udp_link.peer_set = true; udp_parser = bridge::Parser(); }
    udp_link.last_rx = now;
    for (int i = 0; i < n; ++i) if (udp_parser.push(buf[i])) { last_link = &udp_link; core->handle(udp_parser, now, udp_link); }
  }
#endif
  static uint32_t last_us = micros();
  const uint32_t t = micros();
  if (t - last_us >= CONTROL_PERIOD_US) {
    core->tick(now, (t - last_us) * 1e-6f, last_link);
    last_us = t;
  }
}
