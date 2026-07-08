"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────── */
interface DeviceInfo {
  id: string;
  device_code: string;
  device_name?: string;
}

interface SessionInfo {
  id: string;
  session_code: string;
  test_name?: string;
  test_type?: string;
  started_at?: string;
  ended_at?: string;
  device_code?: string;
}

interface LogRow {
  id: string;
  recorded_at: string;
  elapsed_seconds?: number;
  mode?: string;
  temp_air_in?: number;
  rh_in?: number;
  temp_air_out?: number;
  rh_out?: number;
  temp_media?: number;
  soil_raw?: number;
  heater_status?: boolean;
  fan_intake_pwm?: number;
  fan_exhaust_pwm?: number;
  wifi_rssi?: number;
}

const REFRESH_MS = 30_000;

export default function DashboardPage() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Setup device (one-time)
  const [needSetup, setNeedSetup] = useState(false);
  const [setupCode, setSetupCode] = useState("bsf_hw_01");
  const [setupName, setSetupName] = useState("BSF Hardware Unit 01");
  const [setupLoading, setSetupLoading] = useState(false);

  // New session form
  const [showNewSession, setShowNewSession] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("baseline");
  const [formMsg, setFormMsg] = useState<string | null>(null);

  /* ── Load device ─────────────────────────────────────── */
  const loadDevice = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      const data = await res.json();
      if (data.ok && data.devices.length > 0) {
        setDevice(data.devices[0]);
        setNeedSetup(false);
      } else {
        setNeedSetup(true);
      }
    } catch {
      setNeedSetup(true);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (data.ok) {
        setSessions(data.sessions);
        if (!selectedSession && data.sessions.length > 0) {
          setSelectedSession(data.sessions[0].session_code);
        }
      }
    } catch { /* silent */ }
  }, [selectedSession]);

  useEffect(() => {
    loadDevice();
    loadSessions();
  }, [loadDevice, loadSessions]);

  /* ── Fetch logs ──────────────────────────────────────── */
  const fetchLogs = useCallback(async () => {
    if (!selectedSession) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/logs?session_code=${encodeURIComponent(selectedSession)}&limit=200`
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        setActiveSession(null);
        setLogs([]);
      } else {
        setActiveSession(data.session);
        setLogs(data.logs);
        setLastRefresh(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => {
    if (!selectedSession) return;
    fetchLogs();
    const iv = setInterval(fetchLogs, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchLogs, selectedSession]);

  /* ── Register device (one-time) ──────────────────────── */
  const handleSetupDevice = async () => {
    if (!setupCode.trim()) return;
    setSetupLoading(true);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: setupCode.trim(), device_name: setupName.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setDevice(data.device);
        setNeedSetup(false);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Gagal mendaftarkan device");
    } finally {
      setSetupLoading(false);
    }
  };

  /* ── Create session ──────────────────────────────────── */
  const handleCreateSession = async () => {
    if (!device || !newName.trim()) return;
    setFormMsg(null);
    const code = newName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_code: device.device_code,
          session_code: code,
          test_name: newName.trim(),
          test_type: newType.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setFormMsg(data.error);
      } else {
        setNewName("");
        setShowNewSession(false);
        setFormMsg(null);
        await loadSessions();
        setSelectedSession(data.session.session_code);
      }
    } catch {
      setFormMsg("Gagal membuat sesi");
    }
  };

  /* ── Device setup screen ─────────────────────────────── */
  if (needSetup) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">BSF Microclimate Logger</h1>
          <p className="text-sm text-gray-500 mb-5">Daftarkan device ESP32 untuk mulai monitoring.</p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Kode device"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Nama device (opsional)"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSetupDevice}
              disabled={!setupCode.trim() || setupLoading}
              className="w-full h-9 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-sm font-medium text-white transition-colors cursor-pointer"
            >
              {setupLoading ? "Mendaftarkan..." : "Daftarkan Device"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  const latest = logs[0] ?? null;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <h1 className="text-sm font-semibold text-gray-900 shrink-0">
            BSF Microclimate Logger
          </h1>
          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
            >
              <option value="">-- Pilih Sesi --</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.session_code}>
                  {s.test_name || s.session_code}
                </option>
              ))}
            </select>
            <button
              onClick={fetchLogs}
              disabled={loading || !selectedSession}
              className="h-8 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-3 text-sm font-medium text-white transition-colors cursor-pointer"
            >
              {loading ? "Memuat..." : "Muat"}
            </button>
            <a
              href={selectedSession ? `/api/export?session_code=${encodeURIComponent(selectedSession)}` : "#"}
              className={`h-8 inline-flex items-center rounded-md border border-gray-300 bg-white hover:bg-gray-50 px-3 text-sm text-gray-700 transition-colors ${!selectedSession ? "opacity-40 pointer-events-none" : ""}`}
            >
              Unduh CSV
            </a>
            <button
              onClick={() => setShowNewSession(!showNewSession)}
              className={`h-8 rounded-md border px-3 text-sm transition-colors cursor-pointer ${
                showNewSession
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              + Sesi Baru
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-4 space-y-4">
        {/* ── New session form ─────────────────────────── */}
        {showNewSession && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Buat Sesi Baru</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Nama sesi pengujian"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 h-8 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="baseline">Baseline</option>
                <option value="calibration">Kalibrasi</option>
                <option value="experiment">Eksperimen</option>
                <option value="production">Produksi</option>
              </select>
              <button
                onClick={handleCreateSession}
                disabled={!newName.trim()}
                className="h-8 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 text-sm font-medium text-white transition-colors cursor-pointer"
              >
                Buat
              </button>
            </div>
            {formMsg && <p className="mt-2 text-sm text-red-600">{formMsg}</p>}
          </div>
        )}

        {/* ── Error ────────────────────────────────────── */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Session info bar ─────────────────────────── */}
        {activeSession && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>Sesi <b className="text-gray-800">{activeSession.test_name || activeSession.session_code}</b></span>
            {activeSession.test_type && <span>Tipe <b className="text-gray-800">{activeSession.test_type}</b></span>}
            {lastRefresh && <span>Diperbarui <b className="text-gray-800">{lastRefresh.toLocaleTimeString("id-ID")}</b></span>}
            <span className="text-gray-400">otomatis setiap {REFRESH_MS / 1000} detik</span>
          </div>
        )}

        {/* ── Latest Reading ───────────────────────────── */}
        {latest && (
          <section>
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Pembacaan Terakhir
              <span className="ml-2 normal-case tracking-normal font-normal text-gray-400">{fmtTime(latest.recorded_at)}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              <Card label="Mode" value={latest.mode ?? "—"} />
              <Card label="Suhu Masuk" value={fmtVal(latest.temp_air_in)} unit="°C" />
              <Card label="RH Masuk" value={fmtVal(latest.rh_in)} unit="%" />
              <Card label="Suhu Keluar" value={fmtVal(latest.temp_air_out)} unit="°C" />
              <Card label="RH Keluar" value={fmtVal(latest.rh_out)} unit="%" />
              <Card label="Suhu Media" value={fmtVal(latest.temp_media)} unit="°C" />
              <Card label="Soil Raw" value={fmtVal(latest.soil_raw)} />
              <Card label="Heater" value={latest.heater_status === true ? "ON" : latest.heater_status === false ? "OFF" : "—"} highlight={latest.heater_status === true} />
              <Card label="Fan Masuk" value={fmtVal(latest.fan_intake_pwm)} unit="PWM" />
              <Card label="Fan Keluar" value={fmtVal(latest.fan_exhaust_pwm)} unit="PWM" />
            </div>
          </section>
        )}

        {/* ── Table ────────────────────────────────────── */}
        {logs.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Riwayat Log <span className="normal-case tracking-normal font-normal text-gray-400">{logs.length} baris</span>
            </h2>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {["No","Waktu","Durasi","Mode","S.Masuk","RH.In","S.Keluar","RH.Out","S.Media","Soil","Heater","Fan In","Fan Out","RSSI"].map((h) => (
                        <th key={h} className="px-2.5 py-2 whitespace-nowrap border-b border-gray-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row, i) => (
                      <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-2.5 py-1.5 text-gray-400 tabular-nums border-b border-gray-100">{i + 1}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-700 tabular-nums border-b border-gray-100 font-mono">{fmtTime(row.recorded_at)}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-600 border-b border-gray-100">{row.elapsed_seconds != null ? `${(row.elapsed_seconds / 60).toFixed(1)}m` : "—"}</td>
                        <td className="px-2.5 py-1.5 text-gray-700 border-b border-gray-100">{row.mode ?? "—"}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-700 border-b border-gray-100">{fmtVal(row.temp_air_in)}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-700 border-b border-gray-100">{fmtVal(row.rh_in)}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-700 border-b border-gray-100">{fmtVal(row.temp_air_out)}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-700 border-b border-gray-100">{fmtVal(row.rh_out)}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-700 border-b border-gray-100">{fmtVal(row.temp_media)}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-700 border-b border-gray-100">{fmtVal(row.soil_raw)}</td>
                        <td className="px-2.5 py-1.5 border-b border-gray-100">
                          {row.heater_status === true ? <span className="rounded bg-blue-100 text-blue-700 px-1 py-0.5 font-medium">ON</span>
                            : row.heater_status === false ? <span className="text-gray-400">OFF</span> : "—"}
                        </td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-700 border-b border-gray-100">{fmtVal(row.fan_intake_pwm)}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-700 border-b border-gray-100">{fmtVal(row.fan_exhaust_pwm)}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-gray-500 border-b border-gray-100">{fmtVal(row.wifi_rssi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ── Empty ────────────────────────────────────── */}
        {!selectedSession && sessions.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm mb-3">Belum ada sesi pengujian.</p>
            <button onClick={() => setShowNewSession(true)} className="rounded-md bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white cursor-pointer">
              Buat Sesi Pertama
            </button>
          </div>
        )}
        {selectedSession && !loading && logs.length === 0 && !error && (
          <div className="text-center text-gray-400 py-16 text-sm">Belum ada data log untuk sesi ini.</div>
        )}
        {!selectedSession && sessions.length > 0 && (
          <div className="text-center text-gray-400 py-16 text-sm">Pilih sesi untuk melihat data.</div>
        )}
      </main>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */
function fmtVal(v: number | undefined | null): string {
  return v === null || v === undefined ? "—" : String(v);
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  } catch { return iso; }
}

function Card({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${highlight ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
      <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
      <div className="text-base font-semibold tabular-nums text-gray-900">
        {value}{unit && <span className="text-[10px] font-normal text-gray-400 ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}
