"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Types (client-safe, no Supabase imports) ──────────── */
interface SessionInfo {
  id: string;
  session_code: string;
  test_name?: string;
  test_type?: string;
  started_at?: string;
  ended_at?: string;
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
  esp32_uptime_ms?: number;
}

const REFRESH_INTERVAL = 30_000; // 30 seconds

export default function DashboardPage() {
  const [sessionCode, setSessionCode] = useState("empty_chamber_test_01");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/logs?session_code=${encodeURIComponent(sessionCode)}&limit=200`
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to fetch logs");
        setSession(null);
        setLogs([]);
      } else {
        setSession(data.session);
        setLogs(data.logs);
        setLastRefresh(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [sessionCode]);

  // Initial load + auto-refresh
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const latest = logs[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪰</span>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              BSF Microclimate Logger
            </h1>
          </div>
          <div className="flex flex-1 items-center gap-2 sm:ml-6">
            <input
              id="session-code-input"
              type="text"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
              placeholder="session_code"
              className="rounded-md bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-64"
            />
            <button
              id="btn-load-logs"
              onClick={fetchLogs}
              disabled={loading}
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-white transition-colors"
            >
              {loading ? "Loading…" : "Load Logs"}
            </button>
            <a
              id="btn-download-csv"
              href={`/api/export?session_code=${encodeURIComponent(sessionCode)}`}
              className="rounded-md bg-gray-700 hover:bg-gray-600 px-4 py-1.5 text-sm font-medium text-gray-200 transition-colors"
            >
              ⬇ CSV
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* ── Error ────────────────────────────────────── */}
        {error && (
          <div className="rounded-md bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* ── Session info ─────────────────────────────── */}
        {session && (
          <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Session: <strong className="text-gray-300">{session.session_code}</strong>
            </span>
            {session.test_name && (
              <span>
                Test: <strong className="text-gray-300">{session.test_name}</strong>
              </span>
            )}
            {session.test_type && (
              <span>
                Type: <strong className="text-gray-300">{session.test_type}</strong>
              </span>
            )}
            {lastRefresh && (
              <span>
                Updated:{" "}
                <strong className="text-gray-300">
                  {lastRefresh.toLocaleTimeString()}
                </strong>
              </span>
            )}
            <span className="text-gray-600">
              Auto-refresh every {REFRESH_INTERVAL / 1000}s
            </span>
          </div>
        )}

        {/* ── Latest Reading Card ──────────────────────── */}
        {latest && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <h2 className="text-sm font-medium text-gray-400 mb-3">
              Latest Reading
              <span className="ml-2 text-gray-600 font-normal">
                {formatTimestamp(latest.recorded_at)}
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <MetricCard label="Mode" value={latest.mode ?? "—"} />
              <MetricCard
                label="Temp In"
                value={fmtNum(latest.temp_air_in)}
                unit="°C"
                color="text-orange-400"
              />
              <MetricCard
                label="RH In"
                value={fmtNum(latest.rh_in)}
                unit="%"
                color="text-sky-400"
              />
              <MetricCard
                label="Temp Out"
                value={fmtNum(latest.temp_air_out)}
                unit="°C"
                color="text-orange-300"
              />
              <MetricCard
                label="RH Out"
                value={fmtNum(latest.rh_out)}
                unit="%"
                color="text-sky-300"
              />
              <MetricCard
                label="Temp Media"
                value={fmtNum(latest.temp_media)}
                unit="°C"
                color="text-amber-400"
              />
              <MetricCard
                label="Soil Raw"
                value={fmtNum(latest.soil_raw)}
                color="text-lime-400"
              />
              <MetricCard
                label="Heater"
                value={
                  latest.heater_status === true
                    ? "ON"
                    : latest.heater_status === false
                      ? "OFF"
                      : "—"
                }
                color={
                  latest.heater_status === true
                    ? "text-red-400"
                    : "text-gray-400"
                }
              />
              <MetricCard
                label="Fan Intake"
                value={fmtNum(latest.fan_intake_pwm)}
                unit="PWM"
                color="text-cyan-400"
              />
              <MetricCard
                label="Fan Exhaust"
                value={fmtNum(latest.fan_exhaust_pwm)}
                unit="PWM"
                color="text-cyan-300"
              />
            </div>
          </div>
        )}

        {/* ── Logs Table ───────────────────────────────── */}
        {logs.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h2 className="text-sm font-medium text-gray-400">
                Recent Logs
                <span className="ml-2 text-gray-600 font-normal">
                  ({logs.length} rows)
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-wider bg-gray-900/80">
                    <th className="px-3 py-2 whitespace-nowrap">No</th>
                    <th className="px-3 py-2 whitespace-nowrap">Timestamp</th>
                    <th className="px-3 py-2 whitespace-nowrap">Elapsed (min)</th>
                    <th className="px-3 py-2 whitespace-nowrap">Mode</th>
                    <th className="px-3 py-2 whitespace-nowrap">Temp In</th>
                    <th className="px-3 py-2 whitespace-nowrap">RH In</th>
                    <th className="px-3 py-2 whitespace-nowrap">Temp Out</th>
                    <th className="px-3 py-2 whitespace-nowrap">RH Out</th>
                    <th className="px-3 py-2 whitespace-nowrap">Temp Media</th>
                    <th className="px-3 py-2 whitespace-nowrap">Soil Raw</th>
                    <th className="px-3 py-2 whitespace-nowrap">Heater</th>
                    <th className="px-3 py-2 whitespace-nowrap">Intake PWM</th>
                    <th className="px-3 py-2 whitespace-nowrap">Exhaust PWM</th>
                    <th className="px-3 py-2 whitespace-nowrap">WiFi RSSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {logs.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-800/40 transition-colors"
                    >
                      <td className="px-3 py-2 text-gray-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-300 tabular-nums">
                        {formatTimestamp(row.recorded_at)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.elapsed_seconds != null
                          ? (row.elapsed_seconds / 60).toFixed(1)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{row.mode ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums text-orange-400">
                        {fmtNum(row.temp_air_in)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-sky-400">
                        {fmtNum(row.rh_in)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-orange-300">
                        {fmtNum(row.temp_air_out)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-sky-300">
                        {fmtNum(row.rh_out)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-amber-400">
                        {fmtNum(row.temp_media)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-lime-400">
                        {fmtNum(row.soil_raw)}
                      </td>
                      <td className="px-3 py-2">
                        {row.heater_status === true ? (
                          <span className="text-red-400 font-medium">ON</span>
                        ) : row.heater_status === false ? (
                          <span className="text-gray-500">OFF</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-cyan-400">
                        {fmtNum(row.fan_intake_pwm)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-cyan-300">
                        {fmtNum(row.fan_exhaust_pwm)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-gray-400">
                        {fmtNum(row.wifi_rssi)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Empty state ──────────────────────────────── */}
        {!loading && logs.length === 0 && !error && (
          <div className="text-center text-gray-600 py-16">
            No logs yet. Waiting for ESP32 data…
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */
function fmtNum(v: number | undefined | null): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

/* ── Metric Card Component ─────────────────────────────── */
function MetricCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-gray-800/60 border border-gray-700/50 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </div>
      <div className={`text-lg font-semibold tabular-nums ${color ?? "text-gray-200"}`}>
        {value}
        {unit && (
          <span className="text-xs font-normal text-gray-500 ml-1">{unit}</span>
        )}
      </div>
    </div>
  );
}
