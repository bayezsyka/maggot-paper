-- ====================================================================
-- Migration: 002_experiment_fields.sql
-- Description: Add stage 1-4 experiment fields for BSF microclimate controller
-- Idempotent migration using ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- ====================================================================

-- 1. ADD COLUMNS TO test_sessions
ALTER TABLE test_sessions
  ADD COLUMN IF NOT EXISTS stage_number integer,
  ADD COLUMN IF NOT EXISTS stage_name text,
  ADD COLUMN IF NOT EXISTS controller_type text,
  ADD COLUMN IF NOT EXISTS target_temp_min numeric,
  ADD COLUMN IF NOT EXISTS target_temp_max numeric,
  ADD COLUMN IF NOT EXISTS duration_plan_hours numeric,
  ADD COLUMN IF NOT EXISTS chamber_condition text,
  ADD COLUMN IF NOT EXISTS location_note text,
  ADD COLUMN IF NOT EXISTS firmware_version text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'planned';

-- 2. ADD COLUMNS TO sensor_logs
ALTER TABLE sensor_logs
  ADD COLUMN IF NOT EXISTS test_stage integer,
  ADD COLUMN IF NOT EXISTS phase_name text,
  ADD COLUMN IF NOT EXISTS target_temp_min numeric,
  ADD COLUMN IF NOT EXISTS target_temp_max numeric,
  ADD COLUMN IF NOT EXISTS delta_temp numeric,
  ADD COLUMN IF NOT EXISTS delta_rh numeric,
  ADD COLUMN IF NOT EXISTS temp_trend numeric,
  ADD COLUMN IF NOT EXISTS heater_demand numeric,
  ADD COLUMN IF NOT EXISTS safety_state text,
  ADD COLUMN IF NOT EXISTS sensor_error_flags text,
  ADD COLUMN IF NOT EXISTS http_success boolean DEFAULT true;

-- 3. UPDATE VIEW latest_sensor_logs
DROP VIEW IF EXISTS latest_sensor_logs;

CREATE OR REPLACE VIEW latest_sensor_logs AS
SELECT DISTINCT ON (session_id)
  id,
  session_id,
  device_id,
  recorded_at,
  esp32_uptime_ms,
  elapsed_seconds,
  test_stage,
  phase_name,
  mode,
  target_temp_min,
  target_temp_max,
  temp_air_in,
  rh_in,
  temp_air_out,
  rh_out,
  temp_media,
  soil_raw,
  delta_temp,
  delta_rh,
  temp_trend,
  heater_status,
  heater_demand,
  fan_intake_pwm,
  fan_exhaust_pwm,
  safety_state,
  sensor_error_flags,
  wifi_rssi,
  note,
  http_success
FROM sensor_logs
ORDER BY session_id, recorded_at DESC;

-- 4. ADD INDEXES IF NOT EXIST
CREATE INDEX IF NOT EXISTS idx_sensor_logs_session_recorded_at 
  ON sensor_logs (session_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_logs_recorded_at 
  ON sensor_logs (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_sessions_session_code 
  ON test_sessions (session_code);
