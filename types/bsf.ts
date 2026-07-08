/* ──────────────────────────────────────────────────────────
   BSF Microclimate Logger — shared types
   ────────────────────────────────────────────────────────── */

/** Payload sent by the ESP32 via POST /api/logs */
export interface SensorPayload {
  device_code: string;
  session_code: string;
  esp32_uptime_ms?: number;
  elapsed_seconds?: number;
  mode?: string;
  temp_air_in?: number;
  rh_in?: number;
  temp_air_out?: number;
  rh_out?: number;
  temp_media?: number;
  soil_raw?: number;
  heater_status?: boolean;
  fan_intake_pwm?: number;
  fan_exhaust_pwm?: number;
  wifi_rssi?: number;
  note?: string;
}

/** Row returned from the `devices` table */
export interface Device {
  id: string;
  device_code: string;
  device_name?: string;
  created_at?: string;
}

/** Row returned from the `test_sessions` table */
export interface TestSession {
  id: string;
  device_id: string;
  session_code: string;
  test_name?: string;
  test_type?: string;
  test_note?: string;
  started_at?: string;
  ended_at?: string;
}

/** Row returned from the `sensor_logs` table */
export interface SensorLog {
  id: string;
  session_id: string;
  device_id: string;
  recorded_at: string;
  esp32_uptime_ms?: number;
  elapsed_seconds?: number;
  mode?: string;
  temp_air_in?: number;
  rh_in?: number;
  temp_air_out?: number;
  rh_out?: number;
  temp_media?: number;
  soil_raw?: number;
  heater_status?: boolean;
  fan_intake_pwm?: number;
  fan_exhaust_pwm?: number;
  wifi_rssi?: number;
  note?: string;
}

/** Body for POST /api/sessions */
export interface CreateSessionPayload {
  device_code: string;
  session_code: string;
  test_name?: string;
  test_type?: string;
  test_note?: string;
}
