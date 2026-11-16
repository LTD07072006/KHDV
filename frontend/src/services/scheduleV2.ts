export type ScheduleV2Mode = 'history' | 'planned_calls'

type DateHour = { date: string; hour: number }
type DateSlot = { date: string; start: string }
type GroupHour = DateHour & { group_id: string }
export type SlotRequirement = DateSlot & { group_id: string; required_staff: number }

type ScheduleV2Input = {
  week_start: string
  groups: string[]
  operating_hours: DateHour[]
  employees: {
    id: string
    skills: string[]
    available_slots: DateSlot[]
    unavailable_dates: string[]
    max_work_minutes_per_week: number
    min_days_off_per_week?: number | null
  }[]
  shift_starts: DateSlot[]
  allow_skill_fallback?: boolean
  max_solve_seconds?: number
  aht_seconds: number
  target_sla: number
  waiting_seconds: number
  max_agents?: number
}

export type ScheduleV2Request = ScheduleV2Input & (
  | { mode: 'history'; history: (GroupHour & { calls: number })[]; planned_calls?: never }
  | { mode: 'planned_calls'; planned_calls: (GroupHour & { calls_per_hour: number })[]; history?: never }
)

const statuses = ['OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'UNKNOWN', 'MODEL_INVALID'] as const
export type SolverV2Status = typeof statuses[number]
export type ShiftAssignment = DateSlot & {
  employee_id: string
  end: string
  groups_by_slot: { start: string; group_id: string }[]
}

type Forecast = GroupHour & { forecast_calls: number; sample_count: number }
type HourlyResult = GroupHour & {
  calls_per_hour: number
  sample_count: number | null
  erlang: { required_staff: number; service_level: number | null }
}

export type ScheduleV2Response = {
  mode: ScheduleV2Mode
  forecast: { forecasts: Forecast[] } | null
  hourly_results: HourlyResult[]
  requirements: SlotRequirement[]
  schedule: {
    status: SolverV2Status
    assignments: ShiftAssignment[]
    stage_two_status?: SolverV2Status | null
    warnings?: string[]
    message?: string
  }
}

export const hasSchedule = (status: SolverV2Status) => status === 'OPTIMAL' || status === 'FEASIBLE'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const isCount = (value: unknown) => isNumber(value) && Number.isInteger(value)
const isDate = (value: unknown) => isText(value) && /^\d{4}-\d{2}-\d{2}$/.test(value)
const isTime = (value: unknown) => isText(value) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
const isList = (value: unknown, check: (item: unknown) => boolean) =>
  Array.isArray(value) && value.every(check)
const isStatus = (value: unknown) => statuses.some((status) => status === value)
const isGroupHour = (value: Record<string, unknown>) =>
  isDate(value.date) && isCount(value.hour) && Number(value.hour) < 24 && isText(value.group_id)
const isGroupSlot = (value: unknown) =>
  isRecord(value) && isTime(value.start) && isText(value.group_id)

function isScheduleV2Response(value: unknown, mode: ScheduleV2Mode): value is ScheduleV2Response {
  if (!isRecord(value) || value.mode !== mode || !isRecord(value.schedule)) return false
  const { forecast, schedule } = value

  return (mode === 'planned_calls' ? forecast === null :
    isRecord(forecast) && isList(forecast.forecasts, (row) =>
      isRecord(row) && isGroupHour(row) && isNumber(row.forecast_calls) && isCount(row.sample_count))) &&
    isList(value.hourly_results, (row) =>
      isRecord(row) && isGroupHour(row) && isNumber(row.calls_per_hour) &&
      (row.sample_count === null || isCount(row.sample_count)) &&
      isRecord(row.erlang) && isCount(row.erlang.required_staff) &&
      (row.erlang.service_level === null || (isNumber(row.erlang.service_level) && row.erlang.service_level <= 1))) &&
    isList(value.requirements, (row) =>
      isRecord(row) && isDate(row.date) && isGroupSlot(row) && isCount(row.required_staff)) &&
    isStatus(schedule.status) &&
    (schedule.stage_two_status == null || isStatus(schedule.stage_two_status)) &&
    (schedule.message === undefined || isText(schedule.message)) &&
    (schedule.warnings === undefined || isList(schedule.warnings, isText)) &&
    isList(schedule.assignments, (row) =>
      isRecord(row) && isText(row.employee_id) && isDate(row.date) && isTime(row.start) &&
      isTime(row.end) && isList(row.groups_by_slot, isGroupSlot))
}

function hasUniqueEmployeeSlots(result: ScheduleV2Response) {
  const { assignments, status } = result.schedule
  if (!hasSchedule(status)) return assignments.length === 0
  const seen = new Set<string>()
  for (const shift of assignments) {
    for (const slot of shift.groups_by_slot) {
      const key = JSON.stringify([shift.employee_id, shift.date, slot.start])
      if (seen.has(key)) return false
      seen.add(key)
    }
  }
  return true
}

export const scheduleV2Messages = {
  validation: 'Dữ liệu không hợp lệ hoặc không đáp ứng điều kiện lập lịch.',
  server: 'Không thể lấy kết quả xếp lịch. Vui lòng thử lại.',
  network: 'Không kết nối được dịch vụ xếp lịch. Vui lòng thử lại.',
  timeout: 'Dịch vụ xếp lịch phản hồi quá lâu. Vui lòng thử lại.',
  response: 'Dịch vụ trả về kết quả không đọc được. Vui lòng thử lại.',
} as const

export async function requestScheduleV2(request: ScheduleV2Request): Promise<ScheduleV2Response> {
  // Solver v2 can run for up to 30 seconds. Allow extra time for request processing.
  const signal = AbortSignal.timeout(45_000)
  let response: Response
  try {
    response = await fetch('/api/schedule-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch {
    throw new Error(signal.aborted ? scheduleV2Messages.timeout : scheduleV2Messages.network)
  }

  if (response.status === 422) throw new Error(scheduleV2Messages.validation)
  if (!response.ok) throw new Error(scheduleV2Messages.server)

  const result: unknown = await response.json().catch(() => null)
  if (signal.aborted) throw new Error(scheduleV2Messages.timeout)
  if (!isScheduleV2Response(result, request.mode) || !hasUniqueEmployeeSlots(result)) {
    throw new Error(scheduleV2Messages.response)
  }
  return result
}
