// Byte transports between the Jetson and the microcontroller: USB serial (/dev/ttyUSB0, /dev/ttyACM0, /dev/ros2lab_mcu)
// or UDP over Wi-Fi (the ESP32 listens on a port; the Jetson sends to it and it answers to the sender).
#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace ros2lab_hardware
{

class Transport
{
public:
  virtual ~Transport() = default;
  virtual bool open(std::string & error) = 0;
  virtual void close() = 0;
  virtual bool is_open() const = 0;
  // writes all bytes; false on error
  virtual bool write(const std::vector<uint8_t> & bytes) = 0;
  // reads what is available, waiting at most timeout_ms; returns the number of bytes appended (-1 on error)
  virtual int read(std::vector<uint8_t> & out, int timeout_ms) = 0;
  virtual std::string describe() const = 0;
};

class SerialTransport : public Transport
{
public:
  SerialTransport(std::string device, int baud) : device_(std::move(device)), baud_(baud) {}
  ~SerialTransport() override {close();}
  bool open(std::string & error) override;
  void close() override;
  bool is_open() const override {return fd_ >= 0;}
  bool write(const std::vector<uint8_t> & bytes) override;
  int read(std::vector<uint8_t> & out, int timeout_ms) override;
  std::string describe() const override {return device_ + " @ " + std::to_string(baud_) + " baud";}

private:
  std::string device_;
  int baud_;
  int fd_ = -1;
};

class UdpTransport : public Transport
{
public:
  UdpTransport(std::string host, int port, int local_port = 0) : host_(std::move(host)), port_(port), local_port_(local_port) {}
  ~UdpTransport() override {close();}
  bool open(std::string & error) override;
  void close() override;
  bool is_open() const override {return fd_ >= 0;}
  bool write(const std::vector<uint8_t> & bytes) override;
  int read(std::vector<uint8_t> & out, int timeout_ms) override;
  std::string describe() const override {return "udp://" + host_ + ":" + std::to_string(port_);}

private:
  std::string host_;
  int port_, local_port_;
  int fd_ = -1;
  std::vector<uint8_t> addr_;   // sockaddr_in of the microcontroller
};

// "serial" or "udp", from the <hardware> parameters
std::unique_ptr<Transport> make_transport(
  const std::string & kind, const std::string & device, int baud, const std::string & host, int port, std::string & error);

}  // namespace ros2lab_hardware
