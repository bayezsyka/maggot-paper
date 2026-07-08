"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  SESSION_PRESETS,
  type TestSession,
  type QualitySummary,
} from "@/types/bsf";

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

const STAGE_CONFIGS = [
  {
    stage_number: 1,
    stage_name: "Validation",
    session_code: "stage1_validation_01",
    duration: "12 h",
    duration_hours: 12,
    controller: "validation_sequence",
    firmware_config: `#define TEST_STAGE 1\nconst char* SESSION_CODE = "stage1_validation_01";`,
  },
  {
    stage_number: 2,
    stage_name: "Characterization",
    session_code: "stage2_characterization_01",
    duration: "12 h",
    duration_hours: 12,
    controller: "characterization_sequence",
    firmware_config: `#define TEST_STAGE 2\nconst char* SESSION_CODE = "stage2_characterization_01";`,
  },
  {
    stage_number: 3,
    stage_name: "Threshold Control",
    session_code: "stage3_threshold_01",
    duration: "24 h",
    duration_hours: 24,
    controller: "threshold",
    firmware_config: `#define TEST_STAGE 3\nconst char* SESSION_CODE = "stage3_threshold_01";`,
  },
  {
    stage_number: 4,
    stage_name: "Fuzzy Differential Control",
    session_code: "stage4_fuzzy_01",
    duration: "24 h",
    duration_hours: 24,
    controller: "fuzzy_differential",
    firmware_config: `#define TEST_STAGE 4\nconst char* SESSION_CODE = "stage4_fuzzy_01";`,
  },
];

export default function DashboardPage() {
  /* ── Passcode Auth State ── */
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

  /* ── Core State ── */
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [selectedSessionCode, setSelectedSessionCode] = useState<string>(
    "stage1_validation_01"
  );
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Delete modal state
  const [deleteTargetSession, setDeleteTargetSession] =
    useState<TestSession | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>("");
  const [deleteWithLogs, setDeleteWithLogs] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Status updating state
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  /* ── Load Sessions ── */
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (data.ok && data.sessions) {
        setSessions(data.sessions);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadSessions();
  }, [authed, loadSessions]);

  /* ── Fetch Logs for Selected Session ── */
  const fetchLogs = useCallback(async () => {
    if (!selectedSessionCode) {
      setLogs([]);
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
        setLogs([]);
      } else {
        setLogs(data.logs || []);
        setLastRefresh(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed loading logs");
    } finally {
      setLoading(false);
    }
  }, [selectedSessionCode]);

  /* ── Refresh Both Sessions & Logs ── */
  const refreshAll = useCallback(async () => {
    await Promise.all([loadSessions(), fetchLogs()]);
  }, [loadSessions, fetchLogs]);

  useEffect(() => {
    if (!authed || !selectedSessionCode) return;
    refreshAll();
    if (!autoRefresh) return;
    const iv = setInterval(refreshAll, REFRESH_MS);
    return () => clearInterval(iv);
  }, [authed, refreshAll, selectedSessionCode, autoRefresh]);

  /* ── Find selected session object from list ── */
  const selectedSession = useMemo(() => {
    return (
      sessions.find((s) => s.session_code === selectedSessionCode) || null
    );
  }, [sessions, selectedSessionCode]);

  /* ── Create Single Stage Session ── */
  const handleCreateStageSession = async (
    code: string,
    stageNum: number,
    stageName: string,
    controller: string,
    durationHours: number
  ) => {
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_code: code,
          stage_number: stageNum,
          stage_name: stageName,
          controller_type: controller,
          target_temp_min: 28,
          target_temp_max: 30,
          duration_plan_hours: durationHours,
          status: "planned",
        }),
      });
      await loadSessions();
      setSelectedSessionCode(code);
    } catch {
      /* silent */
    }
  };

  /* ── Create All 4 Preset Sessions ── */
  const handleCreateAllPresets = async () => {
    setLoading(true);
    try {
      for (const cfg of STAGE_CONFIGS) {
        const exists = sessions.some((s) => s.session_code === cfg.session_code);
        if (!exists) {
          await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_code: cfg.session_code,
              stage_number: cfg.stage_number,
              stage_name: cfg.stage_name,
              controller_type: cfg.controller,
              target_temp_min: 28,
              target_temp_max: 30,
              duration_plan_hours: cfg.duration_hours,
              status: "planned",
            }),
          });
        }
      }
      await loadSessions();
    } finally {
      setLoading(false);
    }
  };

  /* ── Update Session Status ── */
  const handleUpdateStatus = async (
    sessionCode: string,
    newStatus: string
  ) => {
    setUpdatingStatus(true);
    const target = sessions.find((s) => s.session_code === sessionCode);
    try {
      const payload: Record<string, unknown> = {
        session_code: sessionCode,
        status: newStatus,
      };
      if (newStatus === "running" && !target?.started_at) {
        payload.started_at = new Date().toISOString();
      }
      if (newStatus === "completed" && !target?.ended_at) {
        payload.ended_at = new Date().toISOString();
      }
      await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadSessions();
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* ── Delete Session Handler ── */
  const openDeleteModal = (session: TestSession) => {
    setDeleteTargetSession(session);
    setDeleteConfirmInput("");
    setDeleteWithLogs((session.row_count || 0) > 0);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetSession) return;
    if (deleteConfirmInput !== deleteTargetSession.session_code) {
      setDeleteError("Typed session_code does not match confirmation.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/sessions?session_code=${encodeURIComponent(
          deleteTargetSession.session_code
        )}&delete_logs=${deleteWithLogs ? "true" : "false"}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.ok) {
        setDeleteError(data.error);
      } else {
        setDeleteTargetSession(null);
        await loadSessions();
        if (selectedSessionCode === deleteTargetSession.session_code) {
          setSelectedSessionCode("");
          setLogs([]);
        }
      }
    } catch {
      setDeleteError("Failed deleting session");
    } finally {
      setDeleting(false);
    }
  };

  /* ── Copy to Clipboard ── */
  const copyFirmwareConfig = (configText: string, sessionCode: string) => {
    navigator.clipboard.writeText(configText);
    setCopiedCode(sessionCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const latest = logs[0] ?? null;

  /* ── VIEW: Clean White Passcode Screen ── */
  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-900">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 shadow-sm"
        >
          <div className="mb-5">
            <h1 className="text-base font-semibold text-slate-900">
              BSF Microclimate Experiment
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Please enter access passcode to open dashboard.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Access passcode..."
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-slate-500"
              autoFocus
            />
            {passcodeError && (
              <p className="text-xs text-red-600">Incorrect passcode.</p>
            )}
            <button
              type="submit"
              className="w-full h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Unlock Dashboard
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ── VIEW: Clean White Minimal Dashboard ── */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* ── A. Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              BSF Microclimate Experiment
            </h1>
            <p className="text-xs text-slate-500">
              ESP32 data acquisition dashboard for stage 1–4 testing
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                loadSessions();
                fetchLogs();
              }}
              disabled={loading}
              className="h-8 px-3 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`h-8 px-3 rounded border text-xs font-medium transition-colors cursor-pointer ${
                autoRefresh
                  ? "border-slate-300 bg-slate-100 text-slate-900"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              Auto refresh: {autoRefresh ? "30s ON" : "OFF"}
            </button>

            <button
              onClick={handleLogout}
              className="h-8 px-3 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-600 transition-colors cursor-pointer"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
            {error}
          </div>
        )}

        {/* ── B. Experiment Setup Section ── */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Experiment Setup — Stage 1 to 4
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Data masuk ke session berdasarkan SESSION_CODE di firmware
                ESP32. Memilih session di dashboard hanya mengubah tampilan,
                tidak mengubah firmware.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateAllPresets}
                disabled={loading}
                className="h-8 px-3 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                Create All Preset Sessions
              </button>
              <button
                onClick={loadSessions}
                className="h-8 px-3 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 transition-colors cursor-pointer"
              >
                Refresh Sessions
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STAGE_CONFIGS.map((cfg) => {
              const sessionObj = sessions.find(
                (s) => s.session_code === cfg.session_code
              );
              const status = sessionObj ? sessionObj.status || "Planned" : "Missing";
              const rowCount = sessionObj ? sessionObj.row_count || 0 : 0;
              const isSelected = selectedSessionCode === cfg.session_code;

              return (
                <div
                  key={cfg.stage_number}
                  className={`border rounded-lg p-4 flex flex-col justify-between transition-colors ${
                    isSelected
                      ? "border-slate-400 bg-slate-50/70"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-500">
                          Stage {cfg.stage_number}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {cfg.stage_name}
                        </h3>
                      </div>

                      {/* Status badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          status === "completed" || status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : status === "running" || status === "Running"
                              ? "bg-amber-100 text-amber-800"
                              : status === "invalid" || status === "Invalid"
                                ? "bg-red-100 text-red-800"
                                : status === "Missing"
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <div>
                        <span className="text-slate-500">Code:</span>{" "}
                        <span className="font-mono text-slate-800">
                          {cfg.session_code}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Duration:</span>{" "}
                        {cfg.duration} |{" "}
                        <span className="text-slate-500">Ctrl:</span>{" "}
                        {cfg.controller}
                      </div>
                      <div>
                        <span className="text-slate-500">Rows:</span>{" "}
                        {rowCount.toLocaleString()}
                      </div>
                      {sessionObj?.first_log_at && (
                        <div className="text-[11px] text-slate-500 truncate">
                          First:{" "}
                          {new Date(sessionObj.first_log_at).toLocaleString()}
                        </div>
                      )}
                      {sessionObj?.last_log_at && (
                        <div className="text-[11px] text-slate-500 truncate">
                          Last:{" "}
                          {new Date(sessionObj.last_log_at).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[11px] font-mono text-slate-700">
                      <div>#define TEST_STAGE {cfg.stage_number}</div>
                      <div>
                        const char* SESSION_CODE = &quot;{cfg.session_code}&quot;;
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      {!sessionObj ? (
                        <button
                          onClick={() =>
                            handleCreateStageSession(
                              cfg.session_code,
                              cfg.stage_number,
                              cfg.stage_name,
                              cfg.controller,
                              cfg.duration_hours
                            )
                          }
                          className="h-8 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          Create
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedSessionCode(cfg.session_code)}
                          className={`h-8 rounded text-xs font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                          }`}
                        >
                          {isSelected ? "Viewing" : "View"}
                        </button>
                      )}

                      <button
                        onClick={() =>
                          copyFirmwareConfig(
                            cfg.firmware_config,
                            cfg.session_code
                          )
                        }
                        className="h-8 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 transition-colors cursor-pointer"
                      >
                        {copiedCode === cfg.session_code
                          ? "Copied"
                          : "Copy Config"}
                      </button>
                    </div>

                    {sessionObj && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() =>
                            handleUpdateStatus(cfg.session_code, "running")
                          }
                          disabled={updatingStatus}
                          className="h-7 px-2 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 transition-colors cursor-pointer"
                        >
                          Start
                        </button>
                        <button
                          onClick={() =>
                            handleUpdateStatus(cfg.session_code, "completed")
                          }
                          disabled={updatingStatus}
                          className="h-7 px-2 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 transition-colors cursor-pointer"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() =>
                            handleUpdateStatus(cfg.session_code, "invalid")
                          }
                          disabled={updatingStatus}
                          className="h-7 px-2 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 transition-colors cursor-pointer"
                        >
                          Mark Invalid
                        </button>
                        <button
                          onClick={() => openDeleteModal(sessionObj)}
                          className="h-7 px-2 rounded border border-red-200 bg-white hover:bg-red-50 text-[11px] text-red-600 transition-colors cursor-pointer ml-auto"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── C. Active Session Summary ── */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs uppercase font-semibold text-slate-500">
                Active Session Summary
              </span>
              <h2 className="text-sm font-semibold text-slate-900">
                {selectedSessionCode || "No session selected"}
              </h2>
            </div>

            {selectedSessionCode && (
              <a
                href={`/api/export?session_code=${encodeURIComponent(
                  selectedSessionCode
                )}`}
                download
                className="h-8 px-4 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center transition-colors"
              >
                Export CSV
              </a>
            )}
          </div>

          {selectedSession ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Session Code</span>
                <span className="font-mono font-medium text-slate-900 mt-0.5 block">
                  {selectedSession.session_code}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Stage</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  Stage {selectedSession.stage_number || "-"}:{" "}
                  {selectedSession.stage_name || "-"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Controller</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {selectedSession.controller_type || "-"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Status</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {selectedSession.status || "planned"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Target Temp</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  28–30 °C
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Planned Duration</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {selectedSession.duration_plan_hours || "-"} h
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Rows</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {selectedSession.row_count || 0}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Time Span</span>
                <span className="font-mono text-slate-900 mt-0.5 block truncate">
                  {selectedSession.first_log_at
                    ? new Date(selectedSession.first_log_at).toLocaleTimeString()
                    : "-"}{" "}
                  —{" "}
                  {selectedSession.last_log_at
                    ? new Date(selectedSession.last_log_at).toLocaleTimeString()
                    : "-"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Select a stage card above to view active session summary.
            </p>
          )}
        </section>

        {/* ── D. Latest Readings & E. Actuator State ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* D. Latest Readings */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs uppercase font-semibold text-slate-500 mb-4">
              Latest Sensor Readings
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">T_in</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5">
                  {latest?.temp_air_in ?? "--"} °C
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">RH_in</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5">
                  {latest?.rh_in ?? "--"} %
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">T_media</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5">
                  {latest?.temp_media ?? "--"} °C
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">T_out</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5">
                  {latest?.temp_air_out ?? "--"} °C
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">RH_out</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5">
                  {latest?.rh_out ?? "--"} %
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">Soil raw</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5 font-mono">
                  {latest?.soil_raw ?? "--"}
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">ΔT (In - Out)</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5">
                  {latest?.delta_temp ?? "--"} °C
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">ΔRH (In - Out)</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5">
                  {latest?.delta_rh ?? "--"} %
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">temp_trend</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5 font-mono">
                  {latest?.temp_trend ?? "--"}
                </div>
              </div>
            </div>
          </section>

          {/* E. Actuator State */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs uppercase font-semibold text-slate-500 mb-4">
              Actuator State & Safety
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">Heater Status</span>
                <div className="mt-1">
                  {latest?.heater_status === true ? (
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-xs font-semibold">
                      ON
                    </span>
                  ) : latest?.heater_status === false ? (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                      OFF
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">--</span>
                  )}
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">Heater Demand</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5">
                  {latest?.heater_demand ?? "--"} %
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">Safety State</span>
                <div className="mt-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      !latest?.safety_state ||
                      latest.safety_state === "normal"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800 font-semibold"
                    }`}
                  >
                    {latest?.safety_state || "normal"}
                  </span>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">Intake PWM</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5 font-mono">
                  {latest?.fan_intake_pwm ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">/ 255</span>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">Exhaust PWM</span>
                <div className="text-base font-semibold text-slate-900 mt-0.5 font-mono">
                  {latest?.fan_exhaust_pwm ?? "--"}{" "}
                  <span className="text-xs font-normal text-slate-400">/ 255</span>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500">Sensor Errors</span>
                <div className="text-xs font-mono text-slate-800 mt-1 truncate">
                  {latest?.sensor_error_flags || "None"}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── F. Data Quality (Entire Session Summary) ── */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xs uppercase font-semibold text-slate-500">
              Data Quality Assurance (Entire Session Data)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Metrics calculated across all recorded logs of session{" "}
              <span className="font-mono text-slate-800">
                {selectedSessionCode || "-"}
              </span>
            </p>
          </div>

          {selectedSession?.quality_summary ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-slate-500 block">Total Rows</span>
                <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                  {selectedSession.quality_summary.total_rows}
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-slate-500 block">Est. Duration</span>
                <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                  {Math.round(
                    selectedSession.quality_summary.duration_seconds / 3600
                  )}
                  h{" "}
                  {Math.round(
                    (selectedSession.quality_summary.duration_seconds % 3600) /
                      60
                  )}
                  m
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-slate-500 block">Expected (30s)</span>
                <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                  {selectedSession.quality_summary.expected_rows} rows
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-slate-500 block">Missing Rows Est.</span>
                <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                  {selectedSession.quality_summary.missing_rows}
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-slate-500 block">Logging Success</span>
                <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                  {selectedSession.quality_summary.logging_success_percent}%
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-slate-500 block">Error Flag Count</span>
                <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                  {selectedSession.quality_summary.error_flag_count}
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 col-span-2">
                <span className="text-slate-500 block">
                  Missing Temp (In / Out)
                </span>
                <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                  In: {selectedSession.quality_summary.missing_temp_air_in} |
                  Out: {selectedSession.quality_summary.missing_temp_air_out}
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 col-span-2">
                <span className="text-slate-500 block">
                  Missing RH / Media Temp
                </span>
                <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                  RH In: {selectedSession.quality_summary.missing_rh_in} | RH Out:{" "}
                  {selectedSession.quality_summary.missing_rh_out} | Media:{" "}
                  {selectedSession.quality_summary.missing_temp_media}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No quality summary available for selected session.
            </p>
          )}
        </section>

        {/* ── G. Recent Logs Table (Preview 100-500 rows) ── */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs uppercase font-semibold text-slate-500">
              Recent Sensor Logs Preview ({logs.length} rows loaded)
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
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Elapsed (s)</th>
                  <th className="py-2.5 px-3">Phase / Mode</th>
                  <th className="py-2.5 px-3">T_in</th>
                  <th className="py-2.5 px-3">RH_in</th>
                  <th className="py-2.5 px-3">T_out</th>
                  <th className="py-2.5 px-3">RH_out</th>
                  <th className="py-2.5 px-3">Media</th>
                  <th className="py-2.5 px-3">Heater</th>
                  <th className="py-2.5 px-3">Demand</th>
                  <th className="py-2.5 px-3">PWM In/Out</th>
                  <th className="py-2.5 px-3">Safety</th>
                  <th className="py-2.5 px-3">RSSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={13}
                      className="py-8 text-center text-slate-500 font-sans"
                    >
                      No log data recorded for this session yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-700">
                        {new Date(row.recorded_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {row.elapsed_seconds ?? "-"}
                      </td>
                      <td className="py-2 px-3 text-slate-900 font-sans">
                        {row.phase_name || row.mode || "-"}
                      </td>
                      <td className="py-2 px-3">{row.temp_air_in ?? "-"}</td>
                      <td className="py-2 px-3">{row.rh_in ?? "-"}</td>
                      <td className="py-2 px-3">{row.temp_air_out ?? "-"}</td>
                      <td className="py-2 px-3">{row.rh_out ?? "-"}</td>
                      <td className="py-2 px-3">{row.temp_media ?? "-"}</td>
                      <td className="py-2 px-3">
                        {row.heater_status ? (
                          <span className="text-slate-900 font-bold">ON</span>
                        ) : (
                          <span className="text-slate-500">OFF</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {row.heater_demand != null ? `${row.heater_demand}%` : "-"}
                      </td>
                      <td className="py-2 px-3">
                        {row.fan_intake_pwm ?? "-"} / {row.fan_exhaust_pwm ?? "-"}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            !row.safety_state || row.safety_state === "normal"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800 font-semibold"
                          }`}
                        >
                          {row.safety_state || "normal"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {row.wifi_rssi ? `${row.wifi_rssi} dBm` : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Delete Confirmation Modal ── */}
        {deleteTargetSession && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-lg space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Confirm Delete Session
              </h3>
              <p className="text-xs text-slate-600">
                You are about to delete session{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {deleteTargetSession.session_code}
                </span>{" "}
                ({deleteTargetSession.row_count || 0} rows recorded).
              </p>

              {(deleteTargetSession.row_count || 0) > 0 && (
                <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteWithLogs}
                    onChange={(e) => setDeleteWithLogs(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Delete session and all {deleteTargetSession.row_count} logs</span>
                </label>
              )}

              <div>
                <label className="text-xs text-slate-600 block mb-1">
                  Type session code to confirm:
                </label>
                <input
                  type="text"
                  placeholder={deleteTargetSession.session_code}
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 px-3 text-xs font-mono focus:outline-none focus:border-slate-500"
                />
              </div>

              {deleteError && (
                <p className="text-xs text-red-600">{deleteError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetSession(null)}
                  className="h-8 px-3 rounded border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="h-8 px-3 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  {deleting ? "Deleting..." : "Delete Session"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
