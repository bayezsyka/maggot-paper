import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SensorPayload } from "@/types/bsf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────
   POST /api/logs  — ESP32 pushes sensor data
   ────────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    // --- Auth ---
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.ESP32_API_KEY) {
      return Response.json(
        { ok: false, error: "Unauthorized – invalid or missing x-api-key" },
        { status: 401 }
      );
    }

    // --- Parse body ---
    let body: SensorPayload;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!body.device_code || !body.session_code) {
      return Response.json(
        { ok: false, error: "device_code and session_code are required" },
        { status: 400 }
      );
    }

    // --- Resolve device ---
    const { data: device, error: deviceErr } = await supabaseAdmin
      .from("devices")
      .select("id")
      .eq("device_code", body.device_code)
      .maybeSingle();

    if (deviceErr) {
      return Response.json(
        { ok: false, error: `Device lookup failed: ${deviceErr.message}` },
        { status: 500 }
      );
    }
    if (!device) {
      return Response.json(
        { ok: false, error: `Device not found: ${body.device_code}` },
        { status: 404 }
      );
    }

    // --- Resolve session ---
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("test_sessions")
      .select("id")
      .eq("session_code", body.session_code)
      .maybeSingle();

    if (sessionErr) {
      return Response.json(
        { ok: false, error: `Session lookup failed: ${sessionErr.message}` },
        { status: 500 }
      );
    }
    if (!session) {
      return Response.json(
        { ok: false, error: `Session not found: ${body.session_code}` },
        { status: 404 }
      );
    }

    // --- Insert sensor log ---
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("sensor_logs")
      .insert({
        session_id: session.id,
        device_id: device.id,
        esp32_uptime_ms: body.esp32_uptime_ms ?? null,
        elapsed_seconds: body.elapsed_seconds ?? null,
        mode: body.mode ?? null,
        temp_air_in: body.temp_air_in ?? null,
        rh_in: body.rh_in ?? null,
        temp_air_out: body.temp_air_out ?? null,
        rh_out: body.rh_out ?? null,
        temp_media: body.temp_media ?? null,
        soil_raw: body.soil_raw ?? null,
        heater_status: body.heater_status ?? null,
        fan_intake_pwm: body.fan_intake_pwm ?? null,
        fan_exhaust_pwm: body.fan_exhaust_pwm ?? null,
        wifi_rssi: body.wifi_rssi ?? null,
        note: body.note ?? null,
      })
      .select("id, recorded_at")
      .single();

    if (insertErr) {
      return Response.json(
        { ok: false, error: `Insert failed: ${insertErr.message}` },
        { status: 500 }
      );
    }

    return Response.json(
      { ok: true, id: inserted.id, recorded_at: inserted.recorded_at },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/logs]", err);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* ──────────────────────────────────────────────────────────
   GET /api/logs  — Dashboard fetches recent logs
   ────────────────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionCode =
      searchParams.get("session_code") ||
      process.env.DEFAULT_SESSION_CODE ||
      "empty_chamber_test_01";
    const limitParam = Number(searchParams.get("limit") || "100");
    const limit = Math.min(Math.max(1, limitParam), 1000);

    // --- Resolve session ---
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("test_sessions")
      .select("id, session_code, test_name, test_type, started_at, ended_at")
      .eq("session_code", sessionCode)
      .maybeSingle();

    if (sessionErr) {
      return Response.json(
        { ok: false, error: `Session lookup failed: ${sessionErr.message}` },
        { status: 500 }
      );
    }
    if (!session) {
      return Response.json(
        { ok: false, error: `Session not found: ${sessionCode}` },
        { status: 404 }
      );
    }

    // --- Fetch logs ---
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from("sensor_logs")
      .select("*")
      .eq("session_id", session.id)
      .order("recorded_at", { ascending: false })
      .limit(limit);

    if (logsErr) {
      return Response.json(
        { ok: false, error: `Logs query failed: ${logsErr.message}` },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, session, logs });
  } catch (err) {
    console.error("[GET /api/logs]", err);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
