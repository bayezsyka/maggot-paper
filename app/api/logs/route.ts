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

    // --- Auto-create or resolve device ---
    let { data: device, error: deviceErr } = await supabaseAdmin
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
      const { data: createdDev, error: createDevErr } = await supabaseAdmin
        .from("devices")
        .insert({
          device_code: body.device_code,
          device_name: body.device_code,
        })
        .select("id")
        .single();

      if (createDevErr || !createdDev) {
        return Response.json(
          { ok: false, error: `Auto-create device failed: ${createDevErr?.message}` },
          { status: 500 }
        );
      }
      device = createdDev;
    }

    // --- Auto-create or resolve session ---
    let { data: session, error: sessionErr } = await supabaseAdmin
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
      let stageName: string | null = null;
      let durationHours: number | null = null;
      if (body.test_stage === 1) {
        stageName = "validation";
        durationHours = 12;
      } else if (body.test_stage === 2) {
        stageName = "characterization";
        durationHours = 12;
      } else if (body.test_stage === 3) {
        stageName = "threshold_control";
        durationHours = 24;
      } else if (body.test_stage === 4) {
        stageName = "fuzzy_differential_control";
        durationHours = 24;
      }

      const { data: createdSess, error: createSessErr } = await supabaseAdmin
        .from("test_sessions")
        .insert({
          device_id: device.id,
          session_code: body.session_code,
          status: "running",
          started_at: new Date().toISOString(),
          stage_number: body.test_stage ?? null,
          stage_name: stageName,
          controller_type: body.mode ?? null,
          target_temp_min: body.target_temp_min ?? null,
          target_temp_max: body.target_temp_max ?? null,
          duration_plan_hours: durationHours,
        })
        .select("id")
        .single();

      if (createSessErr || !createdSess) {
        return Response.json(
          { ok: false, error: `Auto-create session failed: ${createSessErr?.message}` },
          { status: 500 }
        );
      }
      session = createdSess;
    }

    // --- Compute optional delta values if not provided by ESP32 ---
    let deltaTemp: number | null = body.delta_temp ?? null;
    if (
      deltaTemp === null &&
      typeof body.temp_air_in === "number" &&
      typeof body.temp_air_out === "number"
    ) {
      deltaTemp = Number((body.temp_air_in - body.temp_air_out).toFixed(2));
    }

    let deltaRh: number | null = body.delta_rh ?? null;
    if (
      deltaRh === null &&
      typeof body.rh_in === "number" &&
      typeof body.rh_out === "number"
    ) {
      deltaRh = Number((body.rh_in - body.rh_out).toFixed(2));
    }

    // --- Insert sensor log ---
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("sensor_logs")
      .insert({
        session_id: session.id,
        device_id: device.id,
        esp32_uptime_ms: body.esp32_uptime_ms ?? null,
        elapsed_seconds: body.elapsed_seconds ?? null,
        test_stage: body.test_stage ?? null,
        phase_name: body.phase_name ?? null,
        mode: body.mode ?? null,
        target_temp_min: body.target_temp_min ?? null,
        target_temp_max: body.target_temp_max ?? null,
        temp_air_in: body.temp_air_in ?? null,
        rh_in: body.rh_in ?? null,
        temp_air_out: body.temp_air_out ?? null,
        rh_out: body.rh_out ?? null,
        temp_media: body.temp_media ?? null,
        soil_raw: body.soil_raw ?? null,
        delta_temp: deltaTemp,
        delta_rh: deltaRh,
        temp_trend: body.temp_trend ?? null,
        heater_status: body.heater_status ?? null,
        heater_demand: body.heater_demand ?? null,
        fan_intake_pwm: body.fan_intake_pwm ?? null,
        fan_exhaust_pwm: body.fan_exhaust_pwm ?? null,
        safety_state: body.safety_state ?? null,
        sensor_error_flags: body.sensor_error_flags ?? null,
        http_success: body.http_success ?? true,
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
      {
        ok: true,
        status: "inserted",
        session_code: body.session_code,
        device_code: body.device_code,
        log_id: inserted.id,
        recorded_at: inserted.recorded_at,
      },
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
    const limitParam = Number(searchParams.get("limit") || "200");
    const limit = Math.min(Math.max(1, limitParam), 1000);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // --- Resolve session ---
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("test_sessions")
      .select("*")
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
    let query = supabaseAdmin
      .from("sensor_logs")
      .select("*")
      .eq("session_id", session.id);

    if (fromParam) {
      query = query.gte("recorded_at", fromParam);
    }
    if (toParam) {
      query = query.lte("recorded_at", toParam);
    }

    const { data: logs, error: logsErr } = await query
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
