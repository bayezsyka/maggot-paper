# BSF Microclimate Logger

Real-time ESP32 sensor monitoring dashboard for BSF (Black Soldier Fly) microclimate experiments. Built with Next.js App Router, TypeScript, and Supabase PostgreSQL.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

| Variable                   | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `SUPABASE_URL`             | Already set to your Supabase project URL          |
| `SUPABASE_SERVICE_ROLE_KEY`| From Supabase → Settings → API → service_role key |
| `ESP32_API_KEY`            | Any random string, e.g. `openssl rand -hex 32`    |
| `DEFAULT_SESSION_CODE`     | Default session to load, e.g. `empty_chamber_test_01` |

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new).
3. Set **Environment Variables** in the Vercel dashboard:

   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ESP32_API_KEY`
   - `DEFAULT_SESSION_CODE`

4. Deploy. Done.

---

## ESP32 Integration

### POST sensor data

```
POST https://<your-domain>.vercel.app/api/logs
```

**Headers:**

```
Content-Type: application/json
x-api-key: <your ESP32_API_KEY>
```

**Body example:**

```json
{
  "device_code": "bsf_hw_01",
  "session_code": "empty_chamber_test_01",
  "esp32_uptime_ms": 120000,
  "elapsed_seconds": 120,
  "mode": "normal",
  "temp_air_in": 26.5,
  "rh_in": 72.3,
  "temp_air_out": 25.9,
  "rh_out": 66.8,
  "temp_media": 27.1,
  "soil_raw": 3190,
  "heater_status": false,
  "fan_intake_pwm": 120,
  "fan_exhaust_pwm": 80,
  "wifi_rssi": -61
}
```

**Success response (201):**

```json
{
  "ok": true,
  "id": "uuid-here",
  "recorded_at": "2025-07-08T12:00:00.000Z"
}
```

### Create a test session

```
POST https://<your-domain>.vercel.app/api/sessions
```

**Headers:**

```
Content-Type: application/json
x-api-key: <your ESP32_API_KEY>
```

**Body:**

```json
{
  "device_code": "bsf_hw_01",
  "session_code": "my_new_test_01",
  "test_name": "Temperature calibration",
  "test_type": "calibration",
  "test_note": "Testing sensor accuracy"
}
```

---

## API Endpoints

| Method | Endpoint         | Auth       | Description                      |
| ------ | ---------------- | ---------- | -------------------------------- |
| GET    | `/api/logs`      | None       | Fetch recent sensor logs         |
| POST   | `/api/logs`      | `x-api-key`| ESP32 pushes sensor data         |
| GET    | `/api/sessions`  | None       | List test sessions               |
| POST   | `/api/sessions`  | `x-api-key`| Create a new test session        |
| GET    | `/api/export`    | None       | Download logs as CSV (semicolon) |

### Query parameters

- `/api/logs?session_code=...&limit=200`
- `/api/export?session_code=...`

---

## Project Structure

```
app/
  page.tsx                  # Dashboard UI
  layout.tsx                # Root layout
  api/
    logs/route.ts           # Sensor log ingestion & retrieval
    sessions/route.ts       # Test session management
    export/route.ts         # CSV export
lib/
  supabaseAdmin.ts          # Server-only Supabase client
  csv.ts                    # CSV helper (semicolon delimiter)
types/
  bsf.ts                   # TypeScript interfaces
```

---

## Database Tables (Supabase)

- **devices** — registered ESP32 devices
- **test_sessions** — experiment sessions
- **sensor_logs** — time-series sensor data
- **latest_sensor_logs** (view) — latest reading per device
