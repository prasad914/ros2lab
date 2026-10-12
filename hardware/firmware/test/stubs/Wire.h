#pragma once
#include "Arduino.h"
class TwoWire {
public:
  void begin() {}
  void setClock(uint32_t) {}
  void beginTransmission(uint8_t) {}
  size_t write(uint8_t) { return 1; }
  uint8_t endTransmission(bool = true) { return 0; }
  uint8_t requestFrom(uint8_t, uint8_t n) { return n; }
  int read() { return 0; }
};
inline TwoWire Wire;
