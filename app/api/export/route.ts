import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCsv } from "@/lib/csv";
import type { SensorLog } from "@/types/bsf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────
   GET /api/export  — download sensor logs as CSV (semicolon)
   ────────────────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionCode =
      searchParams.get("session_code") ||
      process.env.DEFAULT_SESSION_CODE ||
      "empty_chamber_test_01";

    // --- Resolve session ---
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("test_sessions")
      .select("id, session_code")
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

    // --- Fetch ALL logs for the session, ascending ---
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from("sensor_logs")
      .select("*")
      .eq("session_id", session.id)
      .order("recorded_at", { ascending: true });

    if (logsErr) {
      return Response.json(
        { ok: false, error: `Logs query failed: ${logsErr.message}` },
        { status: 500 }
      );
    }

    // --- Build CSV ---
    const headers = [
      "No",
      "Timestamp",
      "Elapsed_Seconds",
      "Elapsed_Minutes",
      "Mode",
      "Temp_Air_In_C",
      "RH_In_Percent",
      "Temp_Air_Out_C",
      "RH_Out_Percent",
      "Temp_Media_C",
      "Soil_Raw",
      "Heater_Status",
      "Fan_Intake_PWM",
      "Fan_Exhaust_PWM",
      "ESP32_Uptime_ms",
      "WiFi_RSSI",
    ];

    const rows = (logs as SensorLog[]).map((row, idx) => [
      idx + 1,
      row.recorded_at ?? "",
      row.elapsed_seconds ?? "",
      row.elapsed_seconds != null
        ? Math.round((row.elapsed_seconds / 60) * 100) / 100
        : "",
      row.mode ?? "",
      row.temp_air_in ?? "",
      row.rh_in ?? "",
      row.temp_air_out ?? "",
      row.rh_out ?? "",
      row.temp_media ?? "",
      row.soil_raw ?? "",
      row.heater_status === true
        ? "ON"
        : row.heater_status === false
          ? "OFF"
          : "",
      row.fan_intake_pwm ?? "",
      row.fan_exhaust_pwm ?? "",
      row.esp32_uptime_ms ?? "",
      row.wifi_rssi ?? "",
    ]);

    const csv = buildCsv(headers, rows);
    const filename = `bsf-${session.session_code}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/export]", err);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
