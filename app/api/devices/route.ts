import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────
   GET /api/devices  — list all devices
   ────────────────────────────────────────────────────────── */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("devices")
      .select("id, device_code, device_name, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json(
        { ok: false, error: `Query failed: ${error.message}` },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, devices: data ?? [] });
  } catch (err) {
    console.error("[GET /api/devices]", err);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* ──────────────────────────────────────────────────────────
   POST /api/devices  — create a new device
   ────────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    let body: { device_code?: string; device_name?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!body.device_code) {
      return Response.json(
        { ok: false, error: "device_code is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("devices")
      .insert({
        device_code: body.device_code,
        device_name: body.device_name || null,
      })
      .select("*")
      .single();

    if (error) {
      return Response.json(
        { ok: false, error: `Insert failed: ${error.message}` },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, device: data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/devices]", err);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
