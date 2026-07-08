/**
 * BSF Microclimate Logger — ESP32 HTTP POST Example (Arduino IDE / PlatformIO)
 *
 * Dependensi Library (install via Library Manager):
 * - ArduinoJson by Benoit Blanchon (v6 atau v7)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ==========================================
// 1. KONFIGURASI WIFI & SERVER
// ==========================================
const char* WIFI_SSID     = "NAMA_WIFI_KAMU";
const char* WIFI_PASSWORD = "PASSWORD_WIFI_KAMU";

// URL Endpoint Vercel
const char* SERVER_URL    = "https://maggot-paper-eight.vercel.app/api/logs";

// API Key (harus sama persis dengan ESP32_API_KEY di Vercel Environment Variables)
const char* API_KEY       = "e665190f20ad7dd1f2cd3d09e53b82297e38c2f2582757e5a182c7c68b726388";

// Kode Device & Session (harus sudah terdaftar di database Supabase / GUI website)
const char* DEVICE_CODE   = "bsf_hw_01";
const char* SESSION_CODE  = "empty_chamber_test_01";

// Interval pengiriman data (ms) - contoh: kirim setiap 30 detik
const unsigned long SEND_INTERVAL_MS = 30000;
unsigned long lastSendTime = 0;
unsigned long startTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n[WiFi] Menghubungkan ke WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[WiFi] Terhubung!");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());

  startTime = millis();
}

void loop() {
  if (millis() - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = millis();

    if (WiFi.status() == WL_CONNECTED) {
      sendSensorLog();
    } else {
      Serial.println("[WiFi] Terputus! Mencoba sambung ulang...");
      WiFi.reconnect();
    }
  }
}

void sendSensorLog() {
  WiFiClientSecure client;
  // Untuk production/testing simpel tanpa validasi sertifikat SSL root CA:
  client.setInsecure();

  HTTPClient http;
  Serial.println("[HTTP] Memulai koneksi ke server...");

  if (http.begin(client, SERVER_URL)) {
    // 1. Set Header Wajib
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", API_KEY);

    // 2. Siapkan Data Sensor (ganti nilai hardcode ini dengan pembacaan sensor aslimu)
    float tempIn   = 28.5;  // contoh dari DHT22 / SHT31
    float rhIn     = 75.2;
    float tempOut  = 27.0;
    float rhOut    = 68.4;
    float tempMedia = 29.1; // contoh dari DS18B20
    int soilRaw    = 2450;  // contoh analog read sensor kelembaban media
    bool heater    = false;
    int fanInPwm   = 128;
    int fanOutPwm  = 90;

    unsigned long uptimeMs = millis();
    unsigned long elapsedSec = (uptimeMs - startTime) / 1000;

    // 3. Buat Payload JSON
    JsonDocument doc; // ArduinoJson v7 (jika v6 gunakan StaticJsonDocument<512> doc;)
    doc["device_code"]     = DEVICE_CODE;
    doc["session_code"]    = SESSION_CODE;
    doc["esp32_uptime_ms"] = uptimeMs;
    doc["elapsed_seconds"] = elapsedSec;
    doc["mode"]            = "normal";
    doc["temp_air_in"]     = tempIn;
    doc["rh_in"]           = rhIn;
    doc["temp_air_out"]    = tempOut;
    doc["rh_out"]          = rhOut;
    doc["temp_media"]      = tempMedia;
    doc["soil_raw"]        = soilRaw;
    doc["heater_status"]   = heater;
    doc["fan_intake_pwm"]  = fanInPwm;
    doc["fan_exhaust_pwm"] = fanOutPwm;
    doc["wifi_rssi"]       = WiFi.RSSI();

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    Serial.print("[HTTP] Mengirim data: ");
    Serial.println(jsonPayload);

    // 4. Kirim HTTP POST
    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.printf("[HTTP] Sukses! Response Code: %d\n", httpResponseCode);
      String response = http.getString();
      Serial.print("[HTTP] Server Response: ");
      Serial.println(response);
    } else {
      Serial.printf("[HTTP] Error pengiriman: %s\n", http.errorToString(httpResponseCode).c_str());
    }

    http.end();
  } else {
    Serial.println("[HTTP] Gagal terhubung ke server Vercel.");
  }
}
