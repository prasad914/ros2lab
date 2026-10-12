#pragma once
#include "Arduino.h"
#define WIFI_STA 1
#define WL_CONNECTED 3
class IPAddress { public: IPAddress() {} bool operator==(const IPAddress &) const { return true; } };   // the real one compares the 4 bytes
class WiFiClass { public: void softAP(const char *, const char *) {} void mode(int) {} void begin(const char *, const char *) {} int status() { return WL_CONNECTED; } void setSleep(bool) {} };
inline WiFiClass WiFi;
