/* ──────────────────────────────────────────────────────────
   BSF Microclimate Logger — shared types
   ────────────────────────────────────────────────────────── */

/** Experiment stages 1-4 */
export type ExperimentStage = 1 | 2 | 3 | 4;

/** Payload sent by the ESP32 via POST /api/logs */
export interface SensorPayload {
  device_code: string;
  session_code: string;
  esp32_uptime_ms?: number | null;
  elapsed_seconds?: number | null;
  test_stage?: number | null;
  phase_name?: string | null;
  mode?: string | null;
  target_temp_min?: number | null;
  target_temp_max?: number | null;
  temp_air_in?: number | null;
  rh_in?: number | null;
  temp_air_out?: number | null;
  rh_out?: number | null;
  temp_media?: number | null;
  soil_raw?: number | null;
  delta_temp?: number | null;
  delta_rh?: number | null;
  temp_trend?: number | null;
  heater_status?: boolean | null;
  heater_demand?: number | null;
  fan_intake_pwm?: number | null;
  fan_exhaust_pwm?: number | null;
  safety_state?: string | null;
  sensor_error_flags?: string | null;
  http_success?: boolean | null;
  wifi_rssi?: number | null;
  note?: string | null;
}

/** Row returned from the `devices` table */
export interface Device {
  id: string;
  device_code: string;
  device_name?: string | null;
  created_at?: string | null;
}

/** Row returned from the `test_sessions` table / API */
export interface QualitySummary {
  total_rows: number;
  missing_temp_air_in: number;
  missing_temp_air_out: number;
  missing_rh_in: number;
  missing_rh_out: number;
  missing_temp_media: number;
  error_flag_count: number;
  duration_seconds: number;
  expected_rows: number;
  missing_rows: number;
  logging_success_percent: number;
}

/** Row returned from the `test_sessions` table / API */
export interface TestSession {
  id: string;
  device_id?: string;
  session_code: string;
  test_name?: string | null;
  test_type?: string | null;
  test_note?: string | null;
  stage_number?: number | null;
  stage_name?: string | null;
  controller_type?: string | null;
  target_temp_min?: number | null;
  target_temp_max?: number | null;
  duration_plan_hours?: number | null;
  chamber_condition?: string | null;
  location_note?: string | null;
  firmware_version?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  status?: string | null;
  device_code?: string | null;
  row_count?: number;
  first_log_at?: string | null;
  last_log_at?: string | null;
  quality_summary?: QualitySummary | null;
}

/** Row returned from the `sensor_logs` table */
export interface SensorLog {
  id: string;
  session_id: string;
  device_id: string;
  recorded_at: string;
  esp32_uptime_ms?: number | null;
  elapsed_seconds?: number | null;
  test_stage?: number | null;
  phase_name?: string | null;
  mode?: string | null;
  target_temp_min?: number | null;
  target_temp_max?: number | null;
  temp_air_in?: number | null;
  rh_in?: number | null;
  temp_air_out?: number | null;
  rh_out?: number | null;
  temp_media?: number | null;
  soil_raw?: number | null;
  delta_temp?: number | null;
  delta_rh?: number | null;
  temp_trend?: number | null;
  heater_status?: boolean | null;
  heater_demand?: number | null;
  fan_intake_pwm?: number | null;
  fan_exhaust_pwm?: number | null;
  safety_state?: string | null;
  sensor_error_flags?: string | null;
  http_success?: boolean | null;
  wifi_rssi?: number | null;
  note?: string | null;
}

/** Body for POST /api/sessions */
export interface CreateSessionPayload {
  device_code?: string;
  session_code: string;
  test_name?: string | null;
  test_type?: string | null;
  test_note?: string | null;
  stage_number?: number | null;
  stage_name?: string | null;
  controller_type?: string | null;
  target_temp_min?: number | null;
  target_temp_max?: number | null;
  duration_plan_hours?: number | null;
  chamber_condition?: string | null;
  location_note?: string | null;
  firmware_version?: string | null;
  status?: string | null;
}

/** Body for PATCH /api/sessions */
export interface UpdateSessionPayload {
  session_code?: string;
  id?: string;
  started_at?: string | null;
  ended_at?: string | null;
  status?: string | null;
  test_note?: string | null;
  location_note?: string | null;
  chamber_condition?: string | null;
  stage_number?: number | null;
  stage_name?: string | null;
  controller_type?: string | null;
  target_temp_min?: number | null;
  target_temp_max?: number | null;
  duration_plan_hours?: number | null;
  firmware_version?: string | null;
}

/** Session preset definition for stages 1-4 */
export interface SessionPreset {
  session_code: string;
  stage_number: ExperimentStage;
  stage_name: string;
  controller_type: string;
  target_temp_min: number;
  target_temp_max: number;
  duration_plan_hours: number;
}

export const SESSION_PRESETS: Record<string, SessionPreset> = {
  stage1_validation_01: {
    session_code: "stage1_validation_01",
    stage_number: 1,
    stage_name: "validation",
    controller_type: "validation_sequence",
    target_temp_min: 28,
    target_temp_max: 30,
    duration_plan_hours: 12,
  },
  stage2_characterization_01: {
    session_code: "stage2_characterization_01",
    stage_number: 2,
    stage_name: "characterization",
    controller_type: "characterization_sequence",
    target_temp_min: 28,
    target_temp_max: 30,
    duration_plan_hours: 12,
  },
  stage3_threshold_01: {
    session_code: "stage3_threshold_01",
    stage_number: 3,
    stage_name: "threshold_control",
    controller_type: "threshold",
    target_temp_min: 28,
    target_temp_max: 30,
    duration_plan_hours: 24,
  },
  stage4_fuzzy_01: {
    session_code: "stage4_fuzzy_01",
    stage_number: 4,
    stage_name: "fuzzy_differential_control",
    controller_type: "fuzzy_differential",
    target_temp_min: 28,
    target_temp_max: 30,
    duration_plan_hours: 24,
  },
};
