/* ──────────────────────────────────────────────────────────
   CSV helper — semicolon-delimited, RFC-4180-ish escaping
   ────────────────────────────────────────────────────────── */

const DELIMITER = ";";

/**
 * Escape a single CSV value.
 * - null / undefined → empty string
 * - If the value contains the delimiter, a newline, or a double-quote it is
 *   wrapped in double-quotes and internal quotes are doubled.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const str = String(value);

  if (
    str.includes(DELIMITER) ||
    str.includes("\n") ||
    str.includes("\r") ||
    str.includes('"')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Build a full CSV string from a header array and rows of values.
 */
export function buildCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const headerLine = headers.map(escapeCsvValue).join(DELIMITER);
  const dataLines = rows.map((row) =>
    row.map(escapeCsvValue).join(DELIMITER)
  );
  return [headerLine, ...dataLines].join("\r\n") + "\r\n";
}
