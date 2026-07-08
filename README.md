# BSF Microclimate Logger & Controller Dashboard

Real-time ESP32 sensor monitoring and experimental data acquisition dashboard for BSF (Black Soldier Fly) microclimate controller experiments (Stages 1–4). Built with **Next.js App Router**, **TypeScript**, and **Supabase PostgreSQL**.

---

## 🔐 Simple Access Authentication

Dashboard ini dilengkapi pengaman akses sederhana. Untuk masuk ke halaman utama dashboard dan mengunduh data CSV paper, masukkan kode akses:

```
s1t26k01
```

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` ke `.env.local`:

```bash
cp .env.example .env.local
```

Isi variabel environment berikut di `.env.local` atau di dashboard hosting (Vercel):

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL project Supabase Anda |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (Server-side ONLY, jangan diekspos ke client) |
| `ESP32_API_KEY` | Key untuk autentikasi pengiriman POST ESP32 |
| `DEFAULT_SESSION_CODE` | Sesi default saat pertama load, misal `stage1_validation_01` |

### 3. Run SQL Migration di Supabase SQL Editor

Jalankan file SQL migrasi di Supabase SQL Editor untuk membuat atau memperbarui tabel dan view:
1. Buka dashboard Supabase → **SQL Editor** → **New Query**.
2. Buka isi file [`supabase/migrations/002_experiment_fields.sql`](file:///supabase/migrations/002_experiment_fields.sql).
3. Paste dan klik **Run**. Migrasi bersifat *idempotent* (`ADD COLUMN IF NOT EXISTS`), aman dijalankan berkali-kali tanpa menghapus data lama.

### 4. Run locally

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## 🧪 Daftar Sesi Eksperimen Tahap 1–4 (Presets)

Sistem siap menerima 4 tahap eksperimen utama untuk analisis paper:

1. **`stage1_validation_01` (Validation Stage)**
   - Stage Number: `1` | Stage Name: `validation`
   - Controller Type: `validation_sequence`
   - Target Temp: `28.0 — 30.0 °C` | Planned Duration: `12 jam`
2. **`stage2_characterization_01` (Characterization Stage)**
   - Stage Number: `2` | Stage Name: `characterization`
   - Controller Type: `characterization_sequence`
   - Target Temp: `28.0 — 30.0 °C` | Planned Duration: `12 jam`
3. **`stage3_threshold_01` (Threshold Control Stage)**
   - Stage Number: `3` | Stage Name: `threshold_control`
   - Controller Type: `threshold`
   - Target Temp: `28.0 — 30.0 °C` | Planned Duration: `24 jam`
4. **`stage4_fuzzy_01` (Fuzzy Differential Control Stage)**
   - Stage Number: `4` | Stage Name: `fuzzy_differential_control`
   - Controller Type: `fuzzy_differential`
   - Target Temp: `28.0 — 30.0 °C` | Planned Duration: `24 jam`

> [!IMPORTANT]
> **Penting untuk Sinkronisasi ESP32**: Pastikan firmware ESP32 mengirimkan `session_code` yang sama dengan sesi yang Anda pilih di dashboard agar data tersimpan di sesi yang sesuai.

---

## 📡 ESP32 Integration (/api/logs)

### POST Sensor Data

```http
POST /api/logs
Content-Type: application/json
x-api-key: <ESP32_API_KEY>
```

#### 1. Contoh Payload ESP32 Lama (Tetap didukung penuh - Backward Compatible)
```json
{
  "device_code": "bsf_hw_01",
  "session_code": "empty_chamber_test_01",
  "esp32_uptime_ms": 120000,
  "elapsed_seconds": 120,
  "mode": "fuzzy_strong_heating",
  "temp_air_in": 26.5,
  "rh_in": 72.3,
  "temp_air_out": 25.9,
  "rh_out": 66.8,
  "temp_media": 27.1,
  "soil_raw": 3190,
  "heater_status": true,
  "fan_intake_pwm": 190,
  "fan_exhaust_pwm": 60,
  "wifi_rssi": -57,
  "note": "legacy payload"
}
```

#### 2. Contoh Payload ESP32 Baru (Eksperimen Tahap 1–4)
```json
{
  "device_code": "bsf_hw_01",
  "session_code": "stage1_validation_01",
  "esp32_uptime_ms": 120000,
  "elapsed_seconds": 120,
  "test_stage": 1,
  "phase_name": "stage1_intake_medium",
  "mode": "validation_sequence",
  "target_temp_min": 28.0,
  "target_temp_max": 30.0,
  "temp_air_in": 26.5,
  "rh_in": 72.3,
  "temp_air_out": 25.9,
  "rh_out": 66.8,
  "temp_media": 27.1,
  "soil_raw": 3190,
  "delta_temp": 0.6,
  "delta_rh": 5.5,
  "temp_trend": 0.02,
  "heater_status": true,
  "heater_demand": 80.0,
  "fan_intake_pwm": 190,
  "fan_exhaust_pwm": 60,
  "safety_state": "normal",
  "sensor_error_flags": "",
  "wifi_rssi": -57,
  "note": "firmware=bsf_fw_v1.0"
}
```

---

## 📊 Penjelasan Singkat Field Eksperimen

- `delta_temp`: Selisih suhu udara dalam dengan luar chamber (`temp_air_in - temp_air_out`). Server menghitung otomatis jika tidak dikirim.
- `delta_rh`: Selisih kelembaban udara dalam dengan luar chamber (`rh_in - rh_out`). Server menghitung otomatis jika tidak dikirim.
- `temp_trend`: Perubahan suhu internal per interval monitoring.
- `heater_demand`: Persentase kebutuhan daya/pemanasan pemanas (0–100%).
- `safety_state`: Status proteksi sistem (`normal` / `sensor_error` / `overheat_cutoff` / `safe_stop`).
- `sensor_error_flags`: String gabungan error sensor jika ada (misal `"SHT_ERR,DS18B20_ERR"`).

---

## 📥 Export CSV untuk Analisis Paper

Dapat dilakukan melalui tombol **Export CSV** di dashboard atau langsung via endpoint:

```http
GET /api/export?session_code=stage1_validation_01
```

Spesifikasi CSV:
- **Delimiter**: Semicolon (`;`)
- **Decimal**: Titik (`.`)
- **Null / Missing value**: String kosong (`""`)
- **Urutan Kolom (25 kolom wajib urut)**:
  1. `recorded_at`
  2. `elapsed_seconds`
  3. `session_code`
  4. `test_stage`
  5. `phase_name`
  6. `mode`
  7. `target_temp_min`
  8. `target_temp_max`
  9. `temp_air_in`
  10. `rh_in`
  11. `temp_air_out`
  12. `rh_out`
  13. `temp_media`
  14. `soil_raw`
  15. `delta_temp`
  16. `delta_rh`
  17. `temp_trend`
  18. `heater_status` (`1` = ON, `0` = OFF)
  19. `heater_demand`
  20. `fan_intake_pwm`
  21. `fan_exhaust_pwm`
  22. `safety_state`
  23. `sensor_error_flags`
  24. `wifi_rssi`
  25. `note`
