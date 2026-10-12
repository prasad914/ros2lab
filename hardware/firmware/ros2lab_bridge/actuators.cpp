// Quadrature encoders: an interrupt on every change of channel A, channel B gives the direction (2 counts per
// encoder line: counts_per_rev = encoder lines x 2 x gear ratio). Up to 6 encoders.
// On the Arduino Mega, channel A must be an interrupt pin: 2, 3, 18, 19, 20 or 21. On the ESP32 any input pin works.
#include "actuators.h"

namespace bridge
{

static volatile long counts[6];
static uint8_t pin_b[6];

#if defined(ARDUINO_ARCH_ESP32)
#define ISR_ATTR IRAM_ATTR
#else
#define ISR_ATTR
#endif

static void ISR_ATTR edge(uint8_t i, uint8_t a_pin)
{
  const bool a = digitalRead(a_pin), b = digitalRead(pin_b[i]);
  counts[i] += (a == b) ? -1 : 1;
}
static uint8_t pin_a[6];
static void ISR_ATTR isr0() { edge(0, pin_a[0]); }
static void ISR_ATTR isr1() { edge(1, pin_a[1]); }
static void ISR_ATTR isr2() { edge(2, pin_a[2]); }
static void ISR_ATTR isr3() { edge(3, pin_a[3]); }
static void ISR_ATTR isr4() { edge(4, pin_a[4]); }
static void ISR_ATTR isr5() { edge(5, pin_a[5]); }
static void (* const isrs[6])() = {isr0, isr1, isr2, isr3, isr4, isr5};

void encoder_attach(uint8_t idx, uint8_t a, uint8_t b)
{
  if (idx >= 6) return;
  pin_a[idx] = a; pin_b[idx] = b;
  pinMode(a, INPUT_PULLUP); pinMode(b, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(a), isrs[idx], CHANGE);
}

long encoder_count(uint8_t idx)
{
  if (idx >= 6) return 0;
  noInterrupts();
  const long c = counts[idx];
  interrupts();
  return c;
}

}  // namespace bridge
