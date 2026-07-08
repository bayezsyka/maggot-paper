"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { SESSION_PRESETS, type ExperimentStage, type SessionPreset } from "@/types/bsf";

/* ── Types ─────────────────────────────────────────────── */
interface DeviceInfo {
  id: string;
  device_code: string;
  device_name?: string | null;
}

interface SessionInfo {
  id: string;
  session_code: string;
  test_name?: string | null;
  test_type?: string | null;
  test_note?: string | null;
  stage_number?: number | null;
  stage_name?: string | null;
  controller_type?: string | null;
  target_temp_min?: number | null;
  target_temp_max?: number | null;
  duration_plan_hours?: number | null;
  chamber_condition?: string | null;
  location_note?: string | null;
  firmware_version?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  status?: string | null;
  device_code?: string | null;
  row_count?: number;
  first_log_at?: string | null;
  last_log_at?: string | null;
}

interface LogRow {
  id: string;
  recorded_at: string;
  elapsed_seconds?: number | null;
  test_stage?: number | null;
  phase_name?: string | null;
  mode?: string | null;
  target_temp_min?: number | null;
  target_temp_max?: number | null;
  temp_air_in?: number | null;
  rh_in?: number | null;
  temp_air_out?: number | null;
  rh_out?: number | null;
  temp_media?: number | null;
  soil_raw?: number | null;
  delta_temp?: number | null;
  delta_rh?: number | null;
  temp_trend?: number | null;
  heater_status?: boolean | null;
  heater_demand?: number | null;
  fan_intake_pwm?: number | null;
  fan_exhaust_pwm?: number | null;
  safety_state?: string | null;
  sensor_error_flags?: string | null;
  http_success?: boolean | null;
  wifi_rssi?: number | null;
  note?: string | null;
}

const REFRESH_MS = 30_000;
const ACCESS_CODE = "s1t26k01";

export default function DashboardPage() {
  /* ── Simple Passcode Auth State ──────────────────────── */
  const [authed, setAuthed] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("bsf_auth_code");
    if (saved === ACCESS_CODE) {
      setAuthed(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput.trim() === ACCESS_CODE) {
      localStorage.setItem("bsf_auth_code", ACCESS_CODE);
      setAuthed(true);
      setPasscodeError(false);
    } else {
      setPasscodeError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("bsf_auth_code");
    setAuthed(false);
  };

  /* ── Dashboard Core State ────────────────────────────── */
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSessionCode, setSelectedSessionCode] = useState<string>("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Device setup screen
  const [needSetup, setNeedSetup] = useState(false);
  const [setupCode, setSetupCode] = useState("bsf_hw_01");
  const [setupName, setSetupName] = useState("BSF Hardware Unit 01");
  const [setupLoading, setSetupLoading] = useState(false);

  // Modal Create/Manage Session
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("stage1_validation_01");
  const [customSessionCode, setCustomSessionCode] = useState<string>("");
  const [stageNum, setStageNum] = useState<number>(1);
  const [stageName, setStageName] = useState<string>("validation");
  const [ctrlType, setCtrlType] = useState<string>("validation_sequence");
  const [targetMin, setTargetMin] = useState<number>(28);
  const [targetMax, setTargetMax] = useState<number>(30);
  const [durationHours, setDurationHours] = useState<number>(12);
  const [chamberCond, setChamberCond] = useState<string>("empty chamber with test media");
  const [locationNote, setLocationNote] = useState<string>("indoor non-AC");
  const [firmwareVer, setFirmwareVer] = useState<string>("bsf_fw_v1.0");
  const [sessionFormMsg, setSessionFormMsg] = useState<string | null>(null);

  // Status updating
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  /* ── Load Device & Sessions ──────────────────────────── */
  const loadDevice = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      const data = await res.json();
      if (data.ok && data.devices?.length > 0) {
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
      if (data.ok && data.sessions) {
        setSessions(data.sessions);
        setSelectedSessionCode((prev) => {
          if (prev && data.sessions.some((s: SessionInfo) => s.session_code === prev)) {
            return prev;
          }
          return data.sessions[0]?.session_code || "";
        });
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadDevice();
    loadSessions();
  }, [authed, loadDevice, loadSessions]);

  /* ── Fetch Logs for Selected Session ─────────────────── */
  const fetchLogs = useCallback(async () => {
    if (!selectedSessionCode) {
      setLogs([]);
      setActiveSession(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/logs?session_code=${encodeURIComponent(selectedSessionCode)}&limit=500`
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        setActiveSession(null);
        setLogs([]);
      } else {
        setActiveSession(data.session);
        setLogs(data.logs || []);
        setLastRefresh(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [selectedSessionCode]);

  useEffect(() => {
    if (!authed || !selectedSessionCode) return;
    fetchLogs();
    if (!autoRefresh) return;
    const iv = setInterval(fetchLogs, REFRESH_MS);
    return () => clearInterval(iv);
  }, [authed, fetchLogs, selectedSessionCode, autoRefresh]);

  /* ── Preset Selection Handler ────────────────────────── */
  const applyPreset = (key: string) => {
    setSelectedPresetKey(key);
    const p = SESSION_PRESETS[key];
    if (p) {
      setCustomSessionCode(p.session_code);
      setStageNum(p.stage_number);
      setStageName(p.stage_name);
      setCtrlType(p.controller_type);
      setTargetMin(p.target_temp_min);
      setTargetMax(p.target_temp_max);
      setDurationHours(p.duration_plan_hours);
    }
  };

  /* ── Create Session ──────────────────────────────────── */
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSessionCode.trim()) return;
    setSessionFormMsg(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_code: device?.device_code || "bsf_hw_01",
          session_code: customSessionCode.trim(),
          stage_number: stageNum,
          stage_name: stageName,
          controller_type: ctrlType,
          target_temp_min: targetMin,
          target_temp_max: targetMax,
          duration_plan_hours: durationHours,
          chamber_condition: chamberCond,
          location_note: locationNote,
          firmware_version: firmwareVer,
          status: "planned",
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSessionFormMsg(data.error);
      } else {
        setShowSessionModal(false);
        await loadSessions();
        setSelectedSessionCode(data.session.session_code);
      }
    } catch {
      setSessionFormMsg("Gagal membuat sesi bereksperimen");
    }
  };

  /* ── Update Session Status ───────────────────────────── */
  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeSession) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_code: activeSession.session_code,
          status: newStatus,
          started_at:
            newStatus === "running" && !activeSession.started_at
              ? new Date().toISOString()
              : undefined,
          ended_at:
            newStatus === "completed" ? new Date().toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setActiveSession(data.session);
        await loadSessions();
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* ── Device Setup Screen (One-time) ──────────────────── */
  const handleSetupDevice = async () => {
    if (!setupCode.trim()) return;
    setSetupLoading(true);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_code: setupCode.trim(),
          device_name: setupName.trim() || undefined,
        }),
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

  /* ── Data Quality Calculations ───────────────────────── */
  const quality = useMemo(() => {
    const totalRows = logs.length;
    if (totalRows === 0) {
      return {
        totalRows: 0,
        missingTempIn: 0,
        missingTempOut: 0,
        missingRhIn: 0,
        missingRhOut: 0,
        missingTempMedia: 0,
        errorFlagCount: 0,
        durationSeconds: 0,
        expectedRows: 0,
        missingRows: 0,
        successPercent: 0,
      };
    }

    let missingTempIn = 0;
    let missingTempOut = 0;
    let missingRhIn = 0;
    let missingRhOut = 0;
    let missingTempMedia = 0;
    let errorFlagCount = 0;

    for (const row of logs) {
      if (row.temp_air_in == null) missingTempIn++;
      if (row.temp_air_out == null) missingTempOut++;
      if (row.rh_in == null) missingRhIn++;
      if (row.rh_out == null) missingRhOut++;
      if (row.temp_media == null) missingTempMedia++;
      if (row.sensor_error_flags && row.sensor_error_flags.trim() !== "") {
        errorFlagCount++;
      }
    }

    // Earliest and latest from loaded logs
    const earliestTime = new Date(logs[logs.length - 1].recorded_at).getTime();
    const latestTime = new Date(logs[0].recorded_at).getTime();
    const durationSeconds = Math.max(0, Math.round((latestTime - earliestTime) / 1000));
    const expectedRows = durationSeconds > 0 ? Math.ceil(durationSeconds / 30) + 1 : totalRows;
    const missingRows = Math.max(0, expectedRows - totalRows);
    const successPercent =
      expectedRows > 0 ? Math.min(100, Math.round((totalRows / expectedRows) * 100)) : 100;

    return {
      totalRows,
      missingTempIn,
      missingTempOut,
      missingRhIn,
      missingRhOut,
      missingTempMedia,
      errorFlagCount,
      durationSeconds,
      expectedRows,
      missingRows,
      successPercent,
    };
  }, [logs]);

  const latest = logs[0] ?? null;

  /* ── VIEW: Passcode Auth Screen ──────────────────────── */
  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
              BSF
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">
                BSF Microclimate Controller
              </h1>
              <p className="text-xs text-slate-400">Akses Eksperimen Tahap 1–4</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Masukkan kode akses keamanan untuk membuka dashboard dan mengunduh data paper.
          </p>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Masukkan kode akses..."
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              className="w-full h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            {passcodeError && (
              <p className="text-xs text-rose-400">
                Kode akses salah. Silakan coba kembali.
              </p>
            )}
            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors cursor-pointer"
            >
              Masuk Dashboard
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ── VIEW: Device Setup Screen ───────────────────────── */
  if (needSetup) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-base font-semibold text-white mb-1">
            Registrasi Device ESP32
          </h1>
          <p className="text-xs text-slate-400 mb-5">
            Daftarkan device hardware pertama sebelum merekam eksperimen.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Kode device (cth: bsf_hw_01)"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value)}
              className="w-full h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm text-white"
            />
            <input
              type="text"
              placeholder="Nama device (opsional)"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              className="w-full h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm text-white"
            />
            <button
              onClick={handleSetupDevice}
              disabled={!setupCode.trim() || setupLoading}
              className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {setupLoading ? "Mendaftarkan..." : "Daftarkan Device"}
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
        </div>
      </div>
    );
  }

  /* ── VIEW: Main Dashboard ────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* ── HEADER ── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
              BSF
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">
                BSF Microclimate Controller Dashboard
              </h1>
              <p className="text-xs text-slate-400">
                Data Akuisisi & Analisis Eksperimen Tahap 1–4
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* A. Session Selector */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-1">
              <select
                value={selectedSessionCode}
                onChange={(e) => setSelectedSessionCode(e.target.value)}
                className="h-8 rounded bg-slate-950 text-xs text-white px-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Pilih Sesi Eksperimen --</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.session_code}>
                    {s.session_code} {s.stage_name ? `(${s.stage_name})` : ""} [
                    {s.status || "planned"}]
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  applyPreset("stage1_validation_01");
                  setShowSessionModal(true);
                }}
                className="h-8 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                + Buat / Preset Sesi
              </button>
            </div>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="h-9 px-3 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              {loading ? "Memuat..." : "Refresh"}
            </button>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`h-9 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                autoRefresh
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-700 bg-slate-900 text-slate-400"
              }`}
            >
              Auto Refresh: {autoRefresh ? "30s ON" : "OFF"}
            </button>

            {/* Export CSV Button */}
            {selectedSessionCode && (
              <a
                href={`/api/export?session_code=${encodeURIComponent(
                  selectedSessionCode
                )}`}
                download
                className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <span>Export CSV</span>
              </a>
            )}

            <button
              onClick={handleLogout}
              className="h-9 px-2.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-400 hover:text-rose-400 transition-colors"
              title="Keluar"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-6">
        {/* IMPORTANT ALERT IF ESP32 SESSION CODE MISMATCH NOTICE */}
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-amber-400">
              ⚠️ Catatan Sinkronisasi ESP32 & Sesi Eksperimen
            </p>
            <p>
              Pastikan firmware ESP32 mengirimkan{" "}
              <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 border border-slate-800">
                &quot;session_code&quot;: &quot;{selectedSessionCode || "..."}&quot;
              </code>{" "}
              pada POST JSON agar data terekam di sesi yang tepat. Sesi baru akan
              dibuat otomatis jika belum ada.
            </p>
          </div>
          {activeSession && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400">Status Sesi:</span>
              <select
                value={activeSession.status || "planned"}
                disabled={updatingStatus}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-medium text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="planned">planned</option>
                <option value="running">running</option>
                <option value="completed">completed</option>
                <option value="invalid">invalid</option>
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3">
            {error}
          </div>
        )}

        {/* B. EXPERIMENT SUMMARY CARDS */}
        {activeSession ? (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Experiment Summary — {activeSession.session_code}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Stage / Name</span>
                <span className="text-sm font-semibold text-white mt-0.5 block">
                  Stage {activeSession.stage_number || "?"}:{" "}
                  {activeSession.stage_name || "N/A"}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Controller Type</span>
                <span className="text-sm font-semibold text-emerald-400 mt-0.5 block">
                  {activeSession.controller_type || "N/A"}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Target Temp Range</span>
                <span className="text-sm font-semibold text-amber-300 mt-0.5 block">
                  {activeSession.target_temp_min ?? "?"} —{" "}
                  {activeSession.target_temp_max ?? "?"} °C
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Plan Duration</span>
                <span className="text-sm font-semibold text-white mt-0.5 block">
                  {activeSession.duration_plan_hours ?? "?"} Jam
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Latest Phase / Mode</span>
                <span className="text-sm font-semibold text-blue-300 mt-0.5 block truncate">
                  {latest?.phase_name || latest?.mode || "-"}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">First Log At</span>
                <span className="text-xs font-mono text-slate-300 mt-1 block">
                  {logs.length > 0
                    ? new Date(logs[logs.length - 1].recorded_at).toLocaleTimeString()
                    : "-"}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Last Log At</span>
                <span className="text-xs font-mono text-slate-300 mt-1 block">
                  {logs.length > 0
                    ? new Date(logs[0].recorded_at).toLocaleTimeString()
                    : "-"}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Total Rows Loaded</span>
                <span className="text-sm font-semibold text-emerald-400 mt-0.5 block">
                  {quality.totalRows} log
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Chamber Condition</span>
                <span className="text-xs text-slate-300 mt-1 block truncate">
                  {activeSession.chamber_condition || "-"}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Firmware</span>
                <span className="text-xs font-mono text-slate-300 mt-1 block">
                  {activeSession.firmware_version || "-"}
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {/* C. LATEST SENSOR CARDS & D. LATEST ACTUATOR CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* C. Latest Sensor Cards */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Latest Sensor Readings
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Temp Air In</span>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  {latest?.temp_air_in ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">°C</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">RH In</span>
                <div className="text-lg font-bold text-blue-400 mt-1">
                  {latest?.rh_in ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">%</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Temp Media</span>
                <div className="text-lg font-bold text-amber-400 mt-1">
                  {latest?.temp_media ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">°C</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Temp Air Out</span>
                <div className="text-lg font-bold text-emerald-300 mt-1">
                  {latest?.temp_air_out ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">°C</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">RH Out</span>
                <div className="text-lg font-bold text-blue-300 mt-1">
                  {latest?.rh_out ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">%</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Soil Raw</span>
                <div className="text-lg font-bold text-slate-200 mt-1 font-mono">
                  {latest?.soil_raw ?? "--"}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Delta Temp (In-Out)</span>
                <div className="text-base font-bold text-purple-300 mt-1">
                  {latest?.delta_temp ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">°C</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Delta RH</span>
                <div className="text-base font-bold text-purple-300 mt-1">
                  {latest?.delta_rh ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">%</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Temp Trend</span>
                <div className="text-base font-bold text-slate-200 mt-1 font-mono">
                  {latest?.temp_trend ?? "--"}
                </div>
              </div>
            </div>
          </section>

          {/* D. Latest Actuator Cards */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Latest Actuators & Controller State
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Heater Status</span>
                <div className="mt-1">
                  {latest?.heater_status === true ? (
                    <span className="inline-block px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-sm font-semibold">
                      ON
                    </span>
                  ) : latest?.heater_status === false ? (
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-sm font-semibold">
                      OFF
                    </span>
                  ) : (
                    <span className="text-slate-500">--</span>
                  )}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Heater Demand</span>
                <div className="text-lg font-bold text-rose-400 mt-1">
                  {latest?.heater_demand ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">%</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Safety State</span>
                <div className="mt-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      !latest?.safety_state || latest.safety_state === "normal"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    {latest?.safety_state || "normal"}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Intake Fan PWM</span>
                <div className="text-lg font-bold text-sky-400 mt-1 font-mono">
                  {latest?.fan_intake_pwm ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-500">/ 255</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Exhaust Fan PWM</span>
                <div className="text-lg font-bold text-sky-400 mt-1 font-mono">
                  {latest?.fan_exhaust_pwm ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-500">/ 255</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Sensor Errors</span>
                <div className="text-xs font-mono text-rose-400 mt-1.5 truncate">
                  {latest?.sensor_error_flags || "OK (None)"}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* E. DATA QUALITY SECTION */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Experiment Data Quality Assurance (Paper Validation)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Total Rows</span>
              <div className="text-base font-bold text-white mt-1">
                {quality.totalRows}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Logging Success</span>
              <div className="text-base font-bold text-emerald-400 mt-1">
                {quality.successPercent}%
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Expected (30s interval)</span>
              <div className="text-base font-bold text-slate-300 mt-1">
                {quality.expectedRows} rows
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Missing Rows Est.</span>
              <div className="text-base font-bold text-amber-400 mt-1">
                {quality.missingRows}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Missing Temp In/Out</span>
              <div className="text-sm font-semibold text-slate-300 mt-1">
                In: {quality.missingTempIn} | Out: {quality.missingTempOut}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Missing RH / Media</span>
              <div className="text-sm font-semibold text-slate-300 mt-1">
                RH: {quality.missingRhIn + quality.missingRhOut} | Med:{" "}
                {quality.missingTempMedia}
              </div>
            </div>
          </div>
        </section>

        {/* F. RECENT LOGS TABLE */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Recent Sensor Logs ({logs.length} loaded)
            </h2>
            {lastRefresh && (
              <span className="text-xs text-slate-500">
                Updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Elapsed (s)</th>
                  <th className="py-2.5 px-3">Phase / Mode</th>
                  <th className="py-2.5 px-3">Temp In</th>
                  <th className="py-2.5 px-3">RH In</th>
                  <th className="py-2.5 px-3">Temp Out</th>
                  <th className="py-2.5 px-3">RH Out</th>
                  <th className="py-2.5 px-3">Media</th>
                  <th className="py-2.5 px-3">Heater</th>
                  <th className="py-2.5 px-3">Demand</th>
                  <th className="py-2.5 px-3">Fan In/Out</th>
                  <th className="py-2.5 px-3">Safety</th>
                  <th className="py-2.5 px-3">RSSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-slate-500 font-sans">
                      Belum ada data sensor untuk sesi ini.
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-slate-300">
                        {new Date(row.recorded_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {row.elapsed_seconds ?? "-"}
                      </td>
                      <td className="py-2 px-3 text-emerald-400 font-sans">
                        {row.phase_name || row.mode || "-"}
                      </td>
                      <td className="py-2 px-3 text-emerald-300">
                        {row.temp_air_in ?? "-"}
                      </td>
                      <td className="py-2 px-3 text-blue-300">{row.rh_in ?? "-"}</td>
                      <td className="py-2 px-3 text-emerald-200">
                        {row.temp_air_out ?? "-"}
                      </td>
                      <td className="py-2 px-3 text-blue-200">{row.rh_out ?? "-"}</td>
                      <td className="py-2 px-3 text-amber-300">
                        {row.temp_media ?? "-"}
                      </td>
                      <td className="py-2 px-3">
                        {row.heater_status ? (
                          <span className="text-rose-400 font-bold">ON</span>
                        ) : (
                          <span className="text-slate-500">OFF</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-rose-300">
                        {row.heater_demand != null ? `${row.heater_demand}%` : "-"}
                      </td>
                      <td className="py-2 px-3 text-sky-400">
                        {row.fan_intake_pwm ?? "-"} / {row.fan_exhaust_pwm ?? "-"}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            !row.safety_state || row.safety_state === "normal"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/20 text-rose-400 font-bold"
                          }`}
                        >
                          {row.safety_state || "normal"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {row.wifi_rssi ? `${row.wifi_rssi} dBm` : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── MODAL: CREATE / PRESET SESSION ── */}
        {showSessionModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
                  Buat Sesi Eksperimen Baru / Preset Tahap 1–4
                </h3>
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="text-slate-400 hover:text-white text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* 1-Click Preset Selector */}
              <div className="mb-5 space-y-2">
                <label className="text-xs font-medium text-slate-300 block">
                  Pilih Preset Eksperimen Cepat:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(SESSION_PRESETS).map((key) => {
                    const preset = SESSION_PRESETS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyPreset(key)}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          selectedPresetKey === key
                            ? "border-emerald-500 bg-emerald-500/10 text-white"
                            : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="font-semibold text-emerald-400">
                          Tahap {preset.stage_number}: {preset.stage_name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {preset.controller_type} • {preset.duration_plan_hours}h
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Session Code (akan dikirimkan oleh ESP32):
                  </label>
                  <input
                    type="text"
                    value={customSessionCode}
                    onChange={(e) => setCustomSessionCode(e.target.value)}
                    className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Stage No
                    </label>
                    <input
                      type="number"
                      value={stageNum}
                      onChange={(e) => setStageNum(Number(e.target.value))}
                      className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Stage Name
                    </label>
                    <input
                      type="text"
                      value={stageName}
                      onChange={(e) => setStageName(e.target.value)}
                      className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Controller
                    </label>
                    <input
                      type="text"
                      value={ctrlType}
                      onChange={(e) => setCtrlType(e.target.value)}
                      className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Target Min (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={targetMin}
                      onChange={(e) => setTargetMin(Number(e.target.value))}
                      className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Target Max (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={targetMax}
                      onChange={(e) => setTargetMax(Number(e.target.value))}
                      className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Plan Durasi (J)
                    </label>
                    <input
                      type="number"
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Kondisi Chamber:
                  </label>
                  <input
                    type="text"
                    value={chamberCond}
                    onChange={(e) => setChamberCond(e.target.value)}
                    className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white"
                  />
                </div>

                {sessionFormMsg && (
                  <p className="text-xs text-rose-400">{sessionFormMsg}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowSessionModal(false)}
                    className="h-9 px-4 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    Simpan & Pilih Sesi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
