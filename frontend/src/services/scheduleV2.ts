export type ScheduleV2Mode = 'planned_calls' | 'history'
export const solverStatuses = ['OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'UNKNOWN', 'MODEL_INVALID'] as const
export type SolverV2Status = typeof solverStatuses[number]
export type Group = { id: string; name: string }
export type TimeRange = { start: string; end: string }
export type Slot = { date: string; start: string }
export type Interval = Slot & TimeRange
export type Shift = Interval & { breaks: TimeRange[] }
export type CallsRow = Slot & { group_id: string; calls: number }
export type HistoryWindow = { start_date: string; end_date: string }
export type Aht = { group_id: string; aht_seconds: number; sample_count: number; cutoff_before: string }
export type Employee = {
  id: string
  skills: string[]
  available_slots: Slot[]
  unavailable_dates: string[]
  max_shift_minutes_per_week: number
  min_days_off_per_week?: number
}
export type ServiceTarget = { group_id: string; target_sla: number; waiting_seconds: number }
type ScheduleConfig = {
  week_start: string
  groups: Group[]
  operating_intervals: Interval[]
  employees: Employee[]
  shifts: Shift[]
  service_targets: ServiceTarget[]
  aht_by_group: (Aht | { group_id: string; aht_seconds: number; source: 'estimate' })[]
  allow_skill_fallback: boolean
  allow_understaffing?: boolean
  max_solve_seconds?: number
}
export type ScheduleV2Request = ScheduleConfig & (
  { mode: 'planned_calls'; planned_calls: CallsRow[] } |
  { mode: 'history'; history_window: HistoryWindow; history: CallsRow[] }
)
type ForecastRow = Omit<CallsRow, 'calls'> & { forecast_calls: number; sample_count: number }
type IntervalResult = CallsRow & {
  sample_count: number | null
  erlang: { required_staff: number; service_level: number | null }
  assigned_staff: number | null
}
type Assignment = Shift & { employee_id: string; groups_by_slot: { start: string; group_id: string }[] }

export type ScheduleV2Response = {
  mode: ScheduleV2Mode
  groups: Group[]
  forecast: { forecasts: ForecastRow[] } | null
  interval_results: IntervalResult[]
  schedule: {
    status: SolverV2Status
    assignments: Assignment[]
    skill_mismatch_slots: number | null
    total_shift_minutes: number | null
    overstaff_slots: number | null
    understaff_slots?: number | null
    stage_two_status: SolverV2Status | null
    warnings: string[]
    message: string
  }
}

export const hasSchedule = (status: SolverV2Status) => status === 'OPTIMAL' || status === 'FEASIBLE'
export const slotKey = ({ date, start }: Slot) => JSON.stringify([date, start])
export const callKey = ({ date, start, group_id }: Omit<CallsRow, 'calls'>) => JSON.stringify([date, start, group_id])
export const isSlotStart = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(value)
export const timeMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
export const timeText = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0')
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const exact = (value: unknown, fields: string): value is Record<string, unknown> =>
  isRecord(value) && Object.keys(value).length === fields.split(' ').length && fields.split(' ').every((field) => Object.hasOwn(value, field))
export const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
export const natural = (value: unknown): value is number => nonnegative(value) && Number.isSafeInteger(value)
export const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && [...value].length <= 100
export const validGroup = (value: unknown): value is Group =>
  exact(value, 'id name') && identifier(value.id) && identifier(value.name)
export const validAht = (value: unknown): value is Aht => exact(value, 'group_id aht_seconds sample_count cutoff_before') &&
  identifier(value.group_id) && nonnegative(value.aht_seconds) && value.aht_seconds > 0 &&
  natural(value.sample_count) && value.sample_count > 0 && isDate(value.cutoff_before)

export function rangeSlots({ start, end }: TimeRange): string[] {
  if (!isSlotStart(start) || !(isSlotStart(end) || end === '24:00') || start >= end) return []
  const first = timeMinutes(start)
  return Array.from({ length: (timeMinutes(end) - first) / 30 }, (_, index) => timeText(first + index * 30))
}

const isStatus = (value: unknown): value is SolverV2Status => solverStatuses.some((status) => status === value)
const validCallKey = (value: Record<string, unknown>) => isDate(value.date) && isSlotStart(value.start) && identifier(value.group_id)
export const validCallsRow = (value: unknown, mode: ScheduleV2Mode): value is CallsRow =>
  exact(value, 'date start group_id calls') && validCallKey(value) &&
  (mode === 'history' ? natural(value.calls) : nonnegative(value.calls))

function validAssignment(value: unknown): value is Assignment {
  if (!exact(value, 'employee_id date start end breaks groups_by_slot') || !identifier(value.employee_id) ||
      !isDate(value.date) || typeof value.start !== 'string' || typeof value.end !== 'string' ||
      !Array.isArray(value.breaks) || !Array.isArray(value.groups_by_slot)) return false
  const working = new Set(rangeSlots({ start: value.start, end: value.end }))
  for (const pause of value.breaks) {
    if (!exact(pause, 'start end') || typeof pause.start !== 'string' || typeof pause.end !== 'string') return false
    const slots = rangeSlots({ start: pause.start, end: pause.end })
    if (!slots.length || slots.some((start) => !working.delete(start))) return false
  }
  return working.size > 0 && value.groups_by_slot.length === working.size && value.groups_by_slot.every((slot: unknown) =>
    exact(slot, 'start group_id') && isSlotStart(slot.start) && identifier(slot.group_id) && working.delete(slot.start))
}

function validInterval(value: unknown, mode: ScheduleV2Mode, available: boolean, allowUnderstaffing: boolean): value is IntervalResult {
  return exact(value, 'date start group_id calls sample_count erlang assigned_staff') && validCallKey(value) &&
    nonnegative(value.calls) && (mode === 'planned_calls' ? value.sample_count === null : natural(value.sample_count) && value.sample_count >= 2) &&
    exact(value.erlang, 'required_staff service_level') && natural(value.erlang.required_staff) && value.erlang.required_staff <= 50 &&
    (value.calls === 0 ? value.erlang.required_staff === 0 && value.erlang.service_level === null :
      value.erlang.required_staff > 0 && nonnegative(value.erlang.service_level) && value.erlang.service_level <= 1) &&
    (available ? natural(value.assigned_staff) && value.assigned_staff <= 50 &&
      (allowUnderstaffing || value.assigned_staff >= value.erlang.required_staff) : value.assigned_staff === null)
}

function validForecast(value: unknown, rows: IntervalResult[], mode: ScheduleV2Mode) {
  if (mode === 'planned_calls') return value === null
  if (!exact(value, 'forecasts') || !Array.isArray(value.forecasts) || value.forecasts.length !== rows.length) return false
  const pending = new Map(rows.map((row) => [callKey(row), row]))
  return value.forecasts.every((point: unknown) => {
    if (!exact(point, 'date start group_id forecast_calls sample_count') || !isDate(point.date) ||
        !isSlotStart(point.start) || !identifier(point.group_id)) return false
    const key = callKey({ date: point.date, start: point.start, group_id: point.group_id })
    const row = pending.get(key)
    return !!row && row.calls === point.forecast_calls && row.sample_count === point.sample_count && pending.delete(key)
  })
}

export function isScheduleResponse(value: unknown, request: ScheduleV2Request): value is ScheduleV2Response {
  if (!exact(value, 'mode groups forecast interval_results schedule') || value.mode !== request.mode ||
      !Array.isArray(value.groups) || value.groups.length !== request.groups.length ||
      !Array.isArray(value.interval_results)) return false
  const names = new Map(request.groups.map((g) => [g.id, g.name]))
  if (!value.groups.every((group: unknown) => validGroup(group) && names.get(group.id) === group.name && names.delete(group.id))) return false
  const schedule = value.schedule
  const hasUnderstaffField = isRecord(schedule) && Object.hasOwn(schedule, 'understaff_slots')
  const scheduleFields = hasUnderstaffField
    ? 'status assignments skill_mismatch_slots total_shift_minutes overstaff_slots understaff_slots stage_two_status warnings message'
    : 'status assignments skill_mismatch_slots total_shift_minutes overstaff_slots stage_two_status warnings message'
  if (!exact(schedule, scheduleFields) ||
      !isStatus(schedule.status) || !(schedule.stage_two_status === null || isStatus(schedule.stage_two_status)) ||
      !Array.isArray(schedule.assignments) || !Array.isArray(schedule.warnings) ||
      !schedule.warnings.every((warning: unknown) => typeof warning === 'string') || typeof schedule.message !== 'string') return false

  const available = hasSchedule(schedule.status)
  const allowUnderstaffing = Boolean(request.allow_understaffing)
  if (schedule.status === 'OPTIMAL' && schedule.stage_two_status !== 'OPTIMAL') return false
  if (!available && (schedule.assignments.length || schedule.stage_two_status !== null || schedule.skill_mismatch_slots !== null ||
      schedule.total_shift_minutes !== null || schedule.overstaff_slots !== null ||
      (hasUnderstaffField && schedule.understaff_slots !== null))) return false

  const expected = new Set(request.operating_intervals.flatMap((interval) => rangeSlots(interval).flatMap((start) =>
    request.groups.map((group) => callKey({ date: interval.date, start, group_id: group.id })))))
  const planned = new Map(request.mode === 'planned_calls' ? request.planned_calls.map((row) => [callKey(row), row.calls]) : [])
  const rows = value.interval_results
  if (rows.length !== expected.size || !rows.every((row: unknown) => validInterval(row, request.mode, available, allowUnderstaffing) &&
      expected.delete(callKey(row)) && (request.mode === 'history' || planned.get(callKey(row)) === row.calls))) return false
  if (!validForecast(value.forecast, rows, request.mode)) return false
  if (!available) return true

  return validStaffing(schedule, request, rows)
}

function validStaffing(schedule: Record<string, unknown>, request: ScheduleV2Request, rows: IntervalResult[]) {
  const employees = new Map(request.employees.map((employee) => [employee.id, employee]))
  const shifts = new Set(request.shifts.map((shift) => shiftKey(shift)))
  const coverage = new Map(rows.map((row) => [callKey(row), 0]))
  const occupied = new Set<string>()
  const minutes = new Map<string, number>()
  const days = new Map<string, Set<string>>()
  let total = 0
  let mismatches = 0
  for (const assignment of schedule.assignments as unknown[]) {
    if (!validAssignment(assignment) || !shifts.has(shiftKey(assignment))) return false
    const employee = employees.get(assignment.employee_id)
    if (!employee || employee.unavailable_dates.includes(assignment.date)) return false
    const availability = new Set(employee.available_slots.map(slotKey))
    const worked = days.get(employee.id) ?? new Set<string>()
    worked.add(assignment.date)
    days.set(employee.id, worked)
    const duration = timeMinutes(assignment.end) - timeMinutes(assignment.start)
    total += duration
    const used = (minutes.get(employee.id) ?? 0) + duration
    if (used > employee.max_shift_minutes_per_week || worked.size > 7 - (employee.min_days_off_per_week ?? 0)) return false
    minutes.set(employee.id, used)
    for (const start of rangeSlots(assignment)) {
      const slot = { date: assignment.date, start }
      const key = JSON.stringify([employee.id, slot.date, start])
      if (occupied.has(key) || !availability.has(slotKey(slot))) return false
      occupied.add(key)
    }
    for (const slot of assignment.groups_by_slot) {
      const matched = employee.skills.includes(slot.group_id)
      if (!matched && !request.allow_skill_fallback) return false
      if (!matched) mismatches++
      const key = callKey({ date: assignment.date, ...slot })
      const count = coverage.get(key)
      if (count === undefined) return false
      coverage.set(key, count + 1)
    }
  }
  const overstaff = rows.reduce((sum, row) => sum + Math.max(0, (row.assigned_staff ?? 0) - row.erlang.required_staff), 0)
  const understaff = rows.reduce((sum, row) => sum + Math.max(0, row.erlang.required_staff - (row.assigned_staff ?? 0)), 0)
  const understaffOk = !Object.hasOwn(schedule, 'understaff_slots') || schedule.understaff_slots === understaff
  return total === schedule.total_shift_minutes && mismatches === schedule.skill_mismatch_slots &&
    rows.every((row) => coverage.get(callKey(row)) === row.assigned_staff) &&
    overstaff === schedule.overstaff_slots && understaffOk
}

export function shiftKey(shift: Shift) {
  const breaks = shift.breaks.map((pause) => [pause.start, pause.end]).sort((a, b) => a[0].localeCompare(b[0]))
  return JSON.stringify([shift.date, shift.start, shift.end, breaks])
}

export const apiMessages = {
  invalidSchedule: 'API từ chối cấu hình. Kiểm tra lưới giờ, nhu cầu, AHT và ràng buộc nhân viên.',
  modelTooLarge: 'Cấu hình vượt giới hạn xử lý của hệ thống. Giảm bớt số ca ứng viên hoặc tắt điều chuyển khác kỹ năng rồi thử lại.',
  invalidFile: 'API từ chối tệp. Kiểm tra cột, định dạng 30 phút, mã nhóm và khoảng lịch sử.',
  invalidExport: 'API từ chối xuất lịch. Hãy chạy lại và thử xuất kết quả mới.',
  tooLarge: 'Dữ liệu vượt giới hạn dung lượng của máy chủ. Hãy thu hẹp phạm vi và thử lại.',
  format: 'Định dạng tệp không được hỗ trợ.',
  busy: 'Dịch vụ đang xử lý yêu cầu khác. Thử lại sau ít nhất một giây.',
  network: 'Không kết nối được API. Kiểm tra backend rồi thử lại.',
  timeout: 'API phản hồi quá thời hạn. Hãy thử lại hoặc thu hẹp phạm vi.',
  cancelled: 'Đã hủy chạy xếp lịch.',
  server: 'API gặp lỗi. Hãy thử lại sau.',
  response: 'Phản hồi API không khớp contract lập lịch 30 phút.',
} as const

export async function post<T>(url: string, body: BodyInit, contentType: string, validationMessage: string,
  read: (response: Response) => Promise<T>, timeoutMs: number, externalSignal?: AbortSignal) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const signal = externalSignal ? AbortSignal.any([timeoutSignal, externalSignal]) : timeoutSignal
  let response: Response
  try {
    response = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': contentType }, signal })
  } catch {
    if (externalSignal?.aborted) throw new Error(apiMessages.cancelled)
    throw new Error(timeoutSignal.aborted ? apiMessages.timeout : apiMessages.network)
  }
  if (!response.ok) {
    if (response.status === 422) {
      try {
        const body: unknown = await response.json()
        if (isRecord(body) && typeof body.detail === 'string' && body.detail.includes('assignment-variable limit')) {
          throw new Error(apiMessages.modelTooLarge)
        }
      } catch (reason) {
        if (reason instanceof Error && reason.message === apiMessages.modelTooLarge) throw reason
      }
      throw new Error(validationMessage)
    }
    const messages: Record<number, string> = { 413: apiMessages.tooLarge, 415: apiMessages.format, 429: apiMessages.busy }
    throw new Error(messages[response.status] ?? apiMessages.server)
  }
  try {
    const data = await read(response)
    if (!signal.aborted) return data
  } catch {
    if (externalSignal?.aborted) throw new Error(apiMessages.cancelled)
    if (!timeoutSignal.aborted) throw new Error(apiMessages.response)
  }
  throw new Error(externalSignal?.aborted ? apiMessages.cancelled : apiMessages.timeout)
}

export function requestScheduleV2(request: ScheduleV2Request, signal?: AbortSignal) {
  return post('/api/schedule-v2', JSON.stringify(request), 'application/json', apiMessages.invalidSchedule, async (response) => {
    const payload: unknown = await response.json()
    if (!isScheduleResponse(payload, request)) throw new Error(apiMessages.response)
    return payload
  }, 40_000, signal)
}
