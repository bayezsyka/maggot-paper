# BSF Microclimate Logger & Controller Dashboard

Real-time ESP32 sensor monitoring and experimental data acquisition dashboard for BSF (Black Soldier Fly) microclimate controller experiments (Stages 1–4). Built with **Next.js App Router**, **TypeScript**, and **Supabase PostgreSQL**.

---

## 🔐 Simple Access Authentication

Dashboard ini dilengkapi pengaman akses sederhana. Untuk masuk ke halaman utama dashboard dan mengunduh data CSV paper, masukkan kode akses:

```
s1t26k01
```

> **Note**: *Passcode is for simple access gating, not production-grade authentication.*

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
| `DEFAULT_SESSION_CODE` | Sesi default saat load, misal `stage1_validation_01` |
| `DASHBOARD_ACCESS_CODE` | Kode akses untuk membuka dashboard (`s1t26k01`) |

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

## 📋 Recommended Experiment Workflow

Berikut alur kerja yang direkomendasikan untuk menyelesaikan 4 tahap pengujian eksperimen:

1. **Run migration**: Eksekusi SQL di `supabase/migrations/002_experiment_fields.sql`.
2. **Deploy to Vercel**: Deploy aplikasi atau jalankan secara lokal.
3. **Open dashboard**: Buka dashboard dan masukkan passcode akses (`s1t26k01`).
4. **Create all preset sessions**: Klik tombol **Create All Preset Sessions** pada bagian Experiment Setup.
5. **Choose Stage 1 card**: Pilih kartu **Stage 1 (Validation)** di dashboard.
6. **Copy firmware config**: Klik tombol **Copy Config** untuk menyalin konfigurasi firmware ke clipboard:
   ```c
   #define TEST_STAGE 1
   const char* SESSION_CODE = "stage1_validation_01";
   ```
7. **Upload firmware to ESP32**: Tempelkan konfigurasi tersebut ke source code ESP32 (`esp32_logger.ino`) dan upload ke mikrokontroler.
8. **Mark session as running**: Klik tombol **Start** pada kartu Stage 1 di dashboard.
9. **Run test**: Jalankan eksperimen selama durasi yang ditentukan (12 jam untuk Stage 1 & 2, 24 jam untuk Stage 3 & 4).
10. **Mark session as completed**: Setelah selesai, klik tombol **Complete** pada kartu sesi.
11. **Export CSV**: Klik tombol **Export CSV** untuk mengunduh data pengujian lengkap yang sudah di-paginate (aman untuk eksperimen 12–24 jam).
12. **Repeat for Stage 2–4**: Ulangi langkah 5–11 untuk Stage 2, Stage 3, dan Stage 4.

> [!IMPORTANT]
> **Catatan Penting Sinkronisasi ESP32**: Dashboard hanya memilih session untuk ditampilkan. Data masuk berdasarkan `SESSION_CODE` yang dikirim firmware ESP32. Memilih session di dashboard hanya mengubah tampilan, tidak mengubah konfigurasi di dalam firmware.

---

## 🧪 Daftar 4 Tahap Eksperimen

1. **Stage 1: Validation (`stage1_validation_01`)**
   - Durasi: `12 h` | Controller: `validation_sequence`
   - Tujuan: Memvalidasi pembacaan sensor, aktuator, logging HTTP, dan sistem pengaman (safety).
2. **Stage 2: Characterization (`stage2_characterization_01`)**
   - Durasi: `12 h` | Controller: `characterization_sequence`
   - Tujuan: Karakterisasi efek pemanas dan kipas terhadap dinamika suhu & kelembaban chamber.
3. **Stage 3: Threshold Control (`stage3_threshold_01`)**
   - Durasi: `24 h` | Controller: `threshold`
   - Tujuan: Pengontrolan suhu baseline dengan rentang target `28.0 — 30.0 °C`.
4. **Stage 4: Fuzzy Differential Control (`stage4_fuzzy_01`)**
   - Durasi: `24 h` | Controller: `fuzzy_differential`
   - Tujuan: Pengontrolan cerdas berbasis diferensial ($T_{in}, RH_{in}, T_{out}, RH_{out}, \Delta T, \Delta RH, \text{trend}$).

---

## 📡 ESP32 Integration (/api/logs)

### POST Sensor Data

```http
POST /api/logs
Content-Type: application/json
x-api-key: <ESP32_API_KEY>
```

---

## 📥 Export CSV untuk Analisis Paper (Paginated)

Dapat dilakukan melalui tombol **Export CSV** di dashboard atau via endpoint:

```http
GET /api/export?session_code=stage1_validation_01
```

Spesifikasi CSV:
- **Delimiter**: Semicolon (`;`)
- **Decimal**: Titik (`.`)
- **Null / Missing value**: String kosong (`""`)
- **Pagination**: Server melakukan perulangan paginasi batch 1000 baris agar data pengujian jangka panjang (12–24 jam) tidak terpotong.
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
