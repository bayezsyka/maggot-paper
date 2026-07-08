import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CreateSessionPayload } from "@/types/bsf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────
   GET /api/sessions  — list test sessions
   ────────────────────────────────────────────────────────── */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("test_sessions")
      .select(
        "id, session_code, test_name, test_type, test_note, started_at, ended_at, device_id, devices(device_code)"
      )
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      return Response.json(
        { ok: false, error: `Query failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Flatten the joined device_code
    const sessions = (data ?? []).map((s) => {
      const raw = s.devices as
        | { device_code: string }
        | { device_code: string }[]
        | null;
      const deviceCode = Array.isArray(raw)
        ? raw[0]?.device_code ?? null
        : raw?.device_code ?? null;
      return {
        id: s.id,
        session_code: s.session_code,
        test_name: s.test_name,
        test_type: s.test_type,
        test_note: s.test_note,
        started_at: s.started_at,
        ended_at: s.ended_at,
        device_code: deviceCode,
      };
    });

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

    // --- Parse body ---
    let body: CreateSessionPayload;
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

    // --- Insert session ---
    const { data: session, error: insertErr } = await supabaseAdmin
      .from("test_sessions")
      .insert({
        device_id: device.id,
        session_code: body.session_code,
        test_name: body.test_name ?? null,
        test_type: body.test_type ?? null,
        test_note: body.test_note ?? null,
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
