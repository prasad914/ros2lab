// Host stubs of the Arduino / ESP32 API: only for compiling the firmware on a PC (syntax and logic tests).
#pragma once
#include <stdint.h>
#include <string.h>
#include <math.h>
#include <stddef.h>
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define CHANGE 1
#define IRAM_ATTR
inline uint32_t stub_ms = 0, stub_us = 0;
inline uint32_t millis() { return stub_ms; }
inline uint32_t micros() { return stub_us; }
inline void delay(uint32_t) {}
inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t, uint8_t) {}
inline int digitalRead(uint8_t) { return 0; }
inline void analogWrite(uint8_t, int) {}
inline int digitalPinToInterrupt(uint8_t p) { return p; }
inline void attachInterrupt(int, void (*)(), int) {}
inline void noInterrupts() {}
inline void interrupts() {}
inline bool ledcAttach(uint8_t, uint32_t, uint8_t) { return true; }
inline bool ledcDetach(uint8_t) { return true; }
inline bool ledcWrite(uint8_t, uint32_t) { return true; }
#define SERIAL_8N1 0x800001c
class HardwareSerial {
public:
  void begin(unsigned long) {}
  void begin(unsigned long, int, int, int) {}
  int available() { return 0; }
  int read() { return -1; }
  size_t write(uint8_t) { return 1; }
  size_t write(const uint8_t *, size_t n) { return n; }
  void flush() {}
};
inline HardwareSerial Serial, Serial1, Serial2;
