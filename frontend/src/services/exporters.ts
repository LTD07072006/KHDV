export type ExportValue = string | number | boolean | null | undefined

export function escapeCsvCell(value: ExportValue): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export function buildCsv(headers: ExportValue[], rows: ExportValue[][]): string {
  return `\ufeff${[headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')}`
}

export function buildAuditJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2)
}
