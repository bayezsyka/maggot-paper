import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CreateSessionPayload, UpdateSessionPayload } from "@/types/bsf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────
   GET /api/sessions  — list test sessions with metadata
   ────────────────────────────────────────────────────────── */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("test_sessions")
      .select(
        "id, session_code, test_name, test_type, test_note, stage_number, stage_name, controller_type, target_temp_min, target_temp_max, duration_plan_hours, chamber_condition, location_note, firmware_version, started_at, ended_at, status, device_id, devices(device_code)"
      )
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) {
      return Response.json(
        { ok: false, error: `Query failed: ${error.message}` },
        { status: 500 }
      );
    }

    const rawSessions = data ?? [];

    // Fetch log metadata (row_count, first_log_at, last_log_at) for each session
    const sessions = await Promise.all(
      rawSessions.map(async (s) => {
        const raw = s.devices as
          | { device_code: string }
          | { device_code: string }[]
          | null;
        const deviceCode = Array.isArray(raw)
          ? raw[0]?.device_code ?? null
          : raw?.device_code ?? null;

        // Get count and latest log
        const { count, data: latestData } = await supabaseAdmin
          .from("sensor_logs")
          .select("recorded_at", { count: "exact" })
          .eq("session_id", s.id)
          .order("recorded_at", { ascending: false })
          .limit(1);

        // Get earliest log
        const { data: earliestData } = await supabaseAdmin
          .from("sensor_logs")
          .select("recorded_at")
          .eq("session_id", s.id)
          .order("recorded_at", { ascending: true })
          .limit(1);

        const firstLogAt = earliestData?.[0]?.recorded_at ?? null;
        const lastLogAt = latestData?.[0]?.recorded_at ?? null;

        return {
          id: s.id,
          session_code: s.session_code,
          test_name: s.test_name,
          test_type: s.test_type,
          test_note: s.test_note,
          stage_number: s.stage_number,
          stage_name: s.stage_name,
          controller_type: s.controller_type,
          target_temp_min: s.target_temp_min,
          target_temp_max: s.target_temp_max,
          duration_plan_hours: s.duration_plan_hours,
          chamber_condition: s.chamber_condition,
          location_note: s.location_note,
          firmware_version: s.firmware_version,
          started_at: s.started_at,
          ended_at: s.ended_at,
          status: s.status || "planned",
          device_code: deviceCode,
          row_count: count ?? 0,
          first_log_at: firstLogAt,
          last_log_at: lastLogAt,
        };
      })
    );

    return Response.json({ ok: true, sessions });
  } catch (err) {
    console.error("[GET /api/sessions]", err);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* ──────────────────────────────────────────────────────────
   POST /api/sessions  — create a new test session
   ────────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    let body: CreateSessionPayload;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!body.session_code) {
      return Response.json(
        { ok: false, error: "session_code is required" },
        { status: 400 }
      );
    }

    const deviceCode = body.device_code || "bsf_hw_01";

    // --- Resolve or create device ---
    let { data: device, error: deviceErr } = await supabaseAdmin
      .from("devices")
      .select("id")
      .eq("device_code", deviceCode)
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
        .insert({ device_code: deviceCode, device_name: "BSF Microclimate Unit 1" })
        .select("id")
        .single();

      if (createDevErr || !createdDev) {
        return Response.json(
          { ok: false, error: `Create device failed: ${createDevErr?.message}` },
          { status: 500 }
        );
      }
      device = createdDev;
    }

    // --- Check if session already exists ---
    const { data: existing } = await supabaseAdmin
      .from("test_sessions")
      .select("id, session_code")
      .eq("session_code", body.session_code)
      .maybeSingle();

    if (existing) {
      return Response.json(
        { ok: false, error: `Session code '${body.session_code}' already exists` },
        { status: 409 }
      );
    }

    // --- Insert session ---
    const { data: session, error: insertErr } = await supabaseAdmin
      .from("test_sessions")
      .insert({
        device_id: device.id,
        session_code: body.session_code,
        test_name: body.test_name ?? body.session_code,
        test_type: body.test_type ?? body.stage_name ?? null,
        test_note: body.test_note ?? null,
        stage_number: body.stage_number ?? null,
        stage_name: body.stage_name ?? null,
        controller_type: body.controller_type ?? null,
        target_temp_min: body.target_temp_min ?? null,
        target_temp_max: body.target_temp_max ?? null,
        duration_plan_hours: body.duration_plan_hours ?? null,
        chamber_condition: body.chamber_condition ?? null,
        location_note: body.location_note ?? null,
        firmware_version: body.firmware_version ?? null,
        status: body.status ?? "planned",
        started_at: body.status === "running" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (insertErr) {
      return Response.json(
        { ok: false, error: `Insert failed: ${insertErr.message}` },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, session }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/sessions]", err);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* ──────────────────────────────────────────────────────────
   PATCH /api/sessions  — partial update for test session
   ────────────────────────────────────────────────────────── */
export async function PATCH(request: NextRequest) {
  try {
    let body: UpdateSessionPayload;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!body.session_code && !body.id) {
      return Response.json(
        { ok: false, error: "session_code or id is required for update" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.started_at !== undefined) updates.started_at = body.started_at;
    if (body.ended_at !== undefined) updates.ended_at = body.ended_at;
    if (body.test_note !== undefined) updates.test_note = body.test_note;
    if (body.location_note !== undefined) updates.location_note = body.location_note;
    if (body.chamber_condition !== undefined) updates.chamber_condition = body.chamber_condition;
    if (body.stage_number !== undefined) updates.stage_number = body.stage_number;
    if (body.stage_name !== undefined) updates.stage_name = body.stage_name;
    if (body.controller_type !== undefined) updates.controller_type = body.controller_type;
    if (body.target_temp_min !== undefined) updates.target_temp_min = body.target_temp_min;
    if (body.target_temp_max !== undefined) updates.target_temp_max = body.target_temp_max;
    if (body.duration_plan_hours !== undefined) updates.duration_plan_hours = body.duration_plan_hours;
    if (body.firmware_version !== undefined) updates.firmware_version = body.firmware_version;

    let query = supabaseAdmin.from("test_sessions").update(updates);
    if (body.id) {
      query = query.eq("id", body.id);
    } else if (body.session_code) {
      query = query.eq("session_code", body.session_code);
    }

    const { data: session, error: updateErr } = await query
      .select("*")
      .maybeSingle();

    if (updateErr) {
      return Response.json(
        { ok: false, error: `Update failed: ${updateErr.message}` },
        { status: 500 }
      );
    }
    if (!session) {
      return Response.json(
        { ok: false, error: "Session not found" },
        { status: 404 }
      );
    }

    return Response.json({ ok: true, session });
  } catch (err) {
    console.error("[PATCH /api/sessions]", err);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
