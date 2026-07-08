import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCsv } from "@/lib/csv";
import type { SensorLog } from "@/types/bsf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────
   GET /api/export  — download sensor logs as semicolon CSV (paginated)
   ────────────────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionCode =
      searchParams.get("session_code") ||
      process.env.DEFAULT_SESSION_CODE ||
      "stage1_validation_01";

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

    // --- Paginated fetch of ALL logs for the session, ascending ---
    const pageSize = 1000;
    let from = 0;
    let to = pageSize - 1;
    const allLogs: SensorLog[] = [];

    while (true) {
      const { data: batch, error: logsErr } = await supabaseAdmin
        .from("sensor_logs")
        .select("*")
        .eq("session_id", session.id)
        .order("recorded_at", { ascending: true })
        .range(from, to);

      if (logsErr) {
        return Response.json(
          { ok: false, error: `Logs query failed: ${logsErr.message}` },
          { status: 500 }
        );
      }

      if (!batch || batch.length === 0) {
        break;
      }

      allLogs.push(...(batch as SensorLog[]));

      if (batch.length < pageSize) {
        break;
      }

      from += pageSize;
      to += pageSize;
    }

    const headers = [
      "recorded_at",
      "elapsed_seconds",
      "session_code",
      "test_stage",
      "phase_name",
      "mode",
      "target_temp_min",
      "target_temp_max",
      "temp_air_in",
      "rh_in",
      "temp_air_out",
      "rh_out",
      "temp_media",
      "soil_raw",
      "delta_temp",
      "delta_rh",
      "temp_trend",
      "heater_status",
      "heater_demand",
      "fan_intake_pwm",
      "fan_exhaust_pwm",
      "safety_state",
      "sensor_error_flags",
      "wifi_rssi",
      "note",
    ];

    const rows = allLogs.map((row) => [
      row.recorded_at ?? "",
      row.elapsed_seconds ?? "",
      session.session_code,
      row.test_stage ?? "",
      row.phase_name ?? "",
      row.mode ?? "",
      row.target_temp_min ?? "",
      row.target_temp_max ?? "",
      row.temp_air_in ?? "",
      row.rh_in ?? "",
      row.temp_air_out ?? "",
      row.rh_out ?? "",
      row.temp_media ?? "",
      row.soil_raw ?? "",
      row.delta_temp ?? "",
      row.delta_rh ?? "",
      row.temp_trend ?? "",
      row.heater_status === true
        ? 1
        : row.heater_status === false
          ? 0
          : "",
      row.heater_demand ?? "",
      row.fan_intake_pwm ?? "",
      row.fan_exhaust_pwm ?? "",
      row.safety_state ?? "",
      row.sensor_error_flags ?? "",
      row.wifi_rssi ?? "",
      row.note ?? "",
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
