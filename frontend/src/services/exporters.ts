import type { CoverageItem, Employee } from '@/types/scheduling'
import { displayCoverageStatus } from '@/lib/coverageDisplay'
import { displayShift, displayStatus, isEmployeeAssigned } from '@/lib/employeeDisplay'

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
export function buildScheduleCsv(date: string, employees: Employee[], hasResult: boolean) {
  const headers = [
    'employee_id', 'employee_name', 'skill', 'date', 'shift',
    'shift_start', 'shift_end', 'break_start', 'break_end', 'status',
  ]
  const rows = employees.map((employee) => {
    const assigned = isEmployeeAssigned(employee, hasResult)
    const shift = displayShift(employee, hasResult)
    const [breakStart, breakEnd] = shift.breakTime.split(/[–-]/).map((time) => time.trim())
    return [
      employee.id,
      employee.name,
      employee.skill || 'Hỗ trợ chung',
      date,
      assigned ? (shift.type === 'ca_dem' ? 'Ca đêm' : 'Ca ngày') : '—',
      assigned ? shift.start : '—',
      assigned ? shift.end : '—',
      assigned ? breakStart : '—',
      assigned ? breakEnd ?? '—' : '—',
      displayStatus(employee, hasResult),
    ]
  })
  return buildCsv(headers, rows)
}

export function buildCoverageCsv(rows: CoverageItem[], hasResult: boolean) {
  const headers = ['Khung_gio', 'Cuoc_goi', 'AHT_phut', 'Can_ErlangC', 'Da_xep', 'Thieu', 'Thua', 'Trang_thai']
  return buildCsv(headers, rows.map((row) => [
    row.time, row.calls, row.aht, row.required,
    hasResult ? row.scheduled : '—',
    hasResult ? row.shortage : '—',
    hasResult ? row.overstaff : '—',
    displayCoverageStatus(row, hasResult),
  ]))
}
