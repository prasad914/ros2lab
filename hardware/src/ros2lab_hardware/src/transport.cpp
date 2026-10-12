#include "ros2lab_hardware/transport.hpp"

#include <arpa/inet.h>
#include <fcntl.h>
#include <netdb.h>
#include <poll.h>
#include <sys/socket.h>
#include <termios.h>
#include <unistd.h>

#include <cerrno>
#include <cstring>

namespace ros2lab_hardware
{

namespace
{
speed_t baud_constant(int baud)
{
  switch (baud) {
    case 9600: return B9600;
    case 19200: return B19200;
    case 38400: return B38400;
    case 57600: return B57600;
    case 115200: return B115200;
    case 230400: return B230400;
    case 460800: return B460800;
    case 500000: return B500000;   // Arduino Mega (exact at 16 MHz)
    case 921600: return B921600;
    case 1000000: return B1000000;
    default: return 0;
  }
}

int wait_readable(int fd, int timeout_ms)
{
  pollfd p{fd, POLLIN, 0};
  return ::poll(&p, 1, timeout_ms);
}
}  // namespace

// ---------------- USB serial ----------------
bool SerialTransport::open(std::string & error)
{
  const speed_t speed = baud_constant(baud_);
  if (!speed) {error = "unsupported baud rate " + std::to_string(baud_); return false;}
  fd_ = ::open(device_.c_str(), O_RDWR | O_NOCTTY | O_NONBLOCK | O_CLOEXEC);
  if (fd_ < 0) {
    error = "cannot open " + device_ + ": " + std::strerror(errno) +
      (errno == EACCES ? " (add yourself to the dialout group: sudo usermod -aG dialout $USER, then log in again)" : "") +
      (errno == ENOENT ? " (is the board plugged in? ls /dev/ttyUSB* /dev/ttyACM*; a CP2102 / FTDI board needs its serial number in the udev rule, see udev/99-ros2lab-mcu.rules)" : "");
    return false;
  }
  termios tio{};
  if (tcgetattr(fd_, &tio) != 0) {error = std::string("tcgetattr: ") + std::strerror(errno); close(); return false;}
  cfmakeraw(&tio);
  cfsetispeed(&tio, speed);
  cfsetospeed(&tio, speed);
  tio.c_cflag |= (CLOCAL | CREAD);
  tio.c_cflag &= ~static_cast<tcflag_t>(CRTSCTS | CSTOPB | PARENB);
  tio.c_cflag = (tio.c_cflag & ~static_cast<tcflag_t>(CSIZE)) | CS8;
  tio.c_cc[VMIN] = 0;
  tio.c_cc[VTIME] = 0;
  if (tcsetattr(fd_, TCSANOW, &tio) != 0) {error = std::string("tcsetattr: ") + std::strerror(errno); close(); return false;}
  tcflush(fd_, TCIOFLUSH);
  return true;
}

void SerialTransport::close()
{
  if (fd_ >= 0) {::close(fd_);}
  fd_ = -1;
}

bool SerialTransport::write(const std::vector<uint8_t> & bytes)
{
  size_t done = 0;
  while (done < bytes.size()) {
    const ssize_t n = ::write(fd_, bytes.data() + done, bytes.size() - done);
    if (n < 0) {
      if (errno == EAGAIN || errno == EINTR) {
        pollfd p{fd_, POLLOUT, 0};
        if (::poll(&p, 1, 20) <= 0) {return false;}
        continue;
      }
      return false;
    }
    done += static_cast<size_t>(n);
  }
  return true;
}

int SerialTransport::read(std::vector<uint8_t> & out, int timeout_ms)
{
  if (fd_ < 0) {return -1;}
  const int r = wait_readable(fd_, timeout_ms);
  if (r < 0) {return errno == EINTR ? 0 : -1;}
  if (r == 0) {return 0;}
  uint8_t buf[512];
  int total = 0;
  for (;;) {
    const ssize_t n = ::read(fd_, buf, sizeof(buf));
    if (n > 0) {out.insert(out.end(), buf, buf + n); total += static_cast<int>(n); continue;}
    if (n == 0) {return total ? total : -1;}   // the device went away (USB unplugged)
    if (errno == EAGAIN || errno == EINTR) {return total;}
    return -1;
  }
}

// ---------------- UDP (Wi-Fi) ----------------
bool UdpTransport::open(std::string & error)
{
  addrinfo hints{}, * res = nullptr;
  hints.ai_family = AF_INET;
  hints.ai_socktype = SOCK_DGRAM;
  const int rc = getaddrinfo(host_.c_str(), std::to_string(port_).c_str(), &hints, &res);
  if (rc != 0 || !res) {error = "cannot resolve " + host_ + ": " + gai_strerror(rc); return false;}
  addr_.assign(reinterpret_cast<uint8_t *>(res->ai_addr), reinterpret_cast<uint8_t *>(res->ai_addr) + res->ai_addrlen);
  freeaddrinfo(res);
  fd_ = ::socket(AF_INET, SOCK_DGRAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
  if (fd_ < 0) {error = std::string("socket: ") + std::strerror(errno); return false;}
  if (local_port_ > 0) {
    sockaddr_in local{};
    local.sin_family = AF_INET;
    local.sin_addr.s_addr = htonl(INADDR_ANY);
    local.sin_port = htons(static_cast<uint16_t>(local_port_));
    if (::bind(fd_, reinterpret_cast<sockaddr *>(&local), sizeof(local)) != 0) {
      error = "bind to port " + std::to_string(local_port_) + ": " + std::strerror(errno);
      close();
      return false;
    }
  }
  return true;
}

void UdpTransport::close()
{
  if (fd_ >= 0) {::close(fd_);}
  fd_ = -1;
}

bool UdpTransport::write(const std::vector<uint8_t> & bytes)
{
  const ssize_t n = ::sendto(fd_, bytes.data(), bytes.size(), 0, reinterpret_cast<const sockaddr *>(addr_.data()), static_cast<socklen_t>(addr_.size()));
  return n == static_cast<ssize_t>(bytes.size());
}

int UdpTransport::read(std::vector<uint8_t> & out, int timeout_ms)
{
  if (fd_ < 0) {return -1;}
  const int r = wait_readable(fd_, timeout_ms);
  if (r <= 0) {return r < 0 && errno != EINTR ? -1 : 0;}
  int total = 0;
  uint8_t buf[1500];
  for (;;) {
    const ssize_t n = ::recvfrom(fd_, buf, sizeof(buf), 0, nullptr, nullptr);
    if (n > 0) {out.insert(out.end(), buf, buf + n); total += static_cast<int>(n); continue;}
    if (n < 0 && (errno == EAGAIN || errno == EINTR)) {return total;}
    return total ? total : -1;
  }
}

std::unique_ptr<Transport> make_transport(
  const std::string & kind, const std::string & device, int baud, const std::string & host, int port, std::string & error)
{
  if (kind == "serial") {return std::make_unique<SerialTransport>(device, baud);}
  if (kind == "udp") {return std::make_unique<UdpTransport>(host, port);}
  error = "transport must be 'serial' (USB) or 'udp' (Wi-Fi), not '" + kind + "'";
  return nullptr;
}

}  // namespace ros2lab_hardware
