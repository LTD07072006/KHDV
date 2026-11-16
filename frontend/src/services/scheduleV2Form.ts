import type { ScheduleV2Mode, ScheduleV2Request } from './scheduleV2'

export type DayHours = { start: string; end: string }
export type HistoryDraftRow = { id: string; date: string; hour: string; group_id: string; calls: string }
export type EmployeeDraft = {
  id: string
  skills: string[]
  available_slots: { date: string; start: string }[]
  unavailable_dates: string[]
  max_work_minutes_per_week: string
  min_days_off_per_week: string
}
export type ScheduleV2Draft = {
  mode: ScheduleV2Mode
  week_start: string
  groups_text: string
  hours: DayHours[]
  planned_calls: Record<string, string>
  history: HistoryDraftRow[]
  employees: EmployeeDraft[]
  shift_starts: { date: string; start: string }[]
  aht_seconds: string
  target_sla_percent: string
  waiting_seconds: string
  allow_skill_fallback: boolean
}

export const dateKey = (date: string, start: string) => JSON.stringify([date, start])
export const callKey = (date: string, hour: number, group: string) => JSON.stringify([date, hour, group])

export function weekDates(weekStart: string): string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || Number(weekStart.slice(0, 4)) < 1) return null
  const day = new Date(`${weekStart}T00:00:00Z`)
  if (Number.isNaN(day.valueOf()) || day.toISOString().slice(0, 10) !== weekStart || day.getUTCDay() !== 1) return null
  const dates: string[] = []
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(day)
    date.setUTCDate(day.getUTCDate() + offset)
    if (Number.isNaN(date.valueOf())) return null
    const isoDate = date.toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
    dates.push(isoDate)
  }
  return dates
}

export function parseGroups(text: string): string[] {
  return text.split('\n').map((group) => group.trim()).filter(Boolean)
}

export function isValidSlaPercent(value: string) {
  if (!value.trim()) return false
  const percent = Number(value)
  return Number.isFinite(percent) && percent > 0 && percent < 100
}

export function operatingHoursFor(draft: ScheduleV2Draft, dates = weekDates(draft.week_start)) {
  if (!dates) return []
  const rows: { date: string; hour: number }[] = []
  draft.hours.forEach(({ start, end }, index) => {
    if (start === '' && end === '') return
    const from = Number(start)
    const to = Number(end)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 22 || to < 1 || to > 23 || from >= to) return
    for (let hour = from; hour < to; hour++) rows.push({ date: dates[index], hour })
  })
  return rows
}

export function operatingSlotsFor(hours: { date: string; hour: number }[]) {
  return hours.flatMap(({ date, hour }) => [
    { date, start: `${String(hour).padStart(2, '0')}:00` },
    { date, start: `${String(hour).padStart(2, '0')}:30` },
  ])
}

export function validShiftStarts(slots: { date: string; start: string }[]) {
  const available = new Set(slots.map(({ date, start }) => dateKey(date, start)))
  const output: { date: string; start: string }[] = []
  for (const slot of slots) {
    const [hour, minute] = slot.start.split(':').map(Number)
    const firstMinutes = hour * 60 + minute
    if ([0, 30, 60].every((offset) => {
      const time = firstMinutes + offset
      const nextStart = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`
      return available.has(dateKey(slot.date, nextStart))
    })) output.push(slot)
  }
  return output
}

function numeric(value: string, label: string, options: { integer?: boolean; min?: number; max?: number } = {}) {
  if (value.trim() === '') throw new Error(`Nhập ${label}.`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || (options.integer && !Number.isInteger(parsed)) ||
      (options.min !== undefined && parsed < options.min) || (options.max !== undefined && parsed > options.max)) {
    throw new Error(`Giá trị ${label} không hợp lệ.`)
  }
  return parsed
}

export function buildScheduleV2Request(draft: ScheduleV2Draft): ScheduleV2Request {
  const dates = weekDates(draft.week_start)
  if (!dates) throw new Error('Tuần bắt đầu phải là một ngày thứ Hai hợp lệ.')
  const groupLines = draft.groups_text.split('\n').filter((line) => line !== '')
  if (!groupLines.length || groupLines.length > 10 || groupLines.some((line) => !line.trim() || line !== line.trim())) {
    throw new Error('Nhập từ 1 đến 10 mã nhóm, mỗi mã một dòng; không để trống khoảng trắng đầu/cuối.')
  }
  const groups = groupLines
  if (groups.some((group) => group.length > 100) || new Set(groups).size !== groups.length) {
    throw new Error('Mã nhóm phải duy nhất và không dài quá 100 ký tự.')
  }
  if (draft.hours.length !== 7) throw new Error('Cần cấu hình giờ hoạt động cho đủ bảy ngày.')
  for (const { start, end } of draft.hours) {
    if ((start === '') !== (end === '')) throw new Error('Mỗi ngày cần nhập cả giờ mở và giờ đóng, hoặc để cả hai trống.')
    if (start === '' && end === '') continue
    const from = Number(start), to = Number(end)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 22 || to < 1 || to > 23 || from >= to) {
      throw new Error('Giờ hoạt động phải cùng ngày: giờ mở 00–22, giờ đóng 01–23 và đóng sau giờ mở.')
    }
  }
  const operating_hours = operatingHoursFor(draft, dates)
  if (!operating_hours.length) throw new Error('Cần ít nhất một giờ hoạt động trong tuần.')
  const operating_slots = operatingSlotsFor(operating_hours)
  const slotSet = new Set(operating_slots.map(({ date, start }) => dateKey(date, start)))
  const shift_starts = draft.shift_starts
  if (shift_starts.length > 200 || new Set(shift_starts.map(({ date, start }) => dateKey(date, start))).size !== shift_starts.length) {
    throw new Error('Giờ bắt đầu ca phải duy nhất và không quá 200 lựa chọn.')
  }
  const legalShifts = new Set(validShiftStarts(operating_slots).map(({ date, start }) => dateKey(date, start)))
  if (shift_starts.some(({ date, start }) => !legalShifts.has(dateKey(date, start)))) {
    throw new Error('Có ca không đủ ba khung 30 phút liên tiếp trong giờ hoạt động. Hãy bỏ ca đó hoặc chỉnh lưới.')
  }
  if (draft.employees.length > 50) throw new Error('Tối đa 50 nhân viên.')
  const employeeIds = new Set<string>()
  const employees = draft.employees.map((employee) => {
    const id = employee.id
    if (!id || id !== id.trim() || id.length > 100) throw new Error('Mã nhân viên cần có nội dung, tối đa 100 ký tự và không có khoảng trắng đầu/cuối.')
    if (employeeIds.has(id)) throw new Error(`Mã nhân viên bị trùng: ${id}.`)
    employeeIds.add(id)
    if (new Set(employee.skills).size !== employee.skills.length || employee.skills.some((skill) => !groups.includes(skill))) {
      throw new Error(`Kỹ năng của ${id} phải thuộc nhóm đã khai báo và không trùng.`)
    }
    if (new Set(employee.available_slots.map(({ date, start }) => dateKey(date, start))).size !== employee.available_slots.length ||
        employee.available_slots.some(({ date, start }) => !slotSet.has(dateKey(date, start)))) {
      throw new Error(`Lịch rảnh của ${id} có khung trùng hoặc nằm ngoài giờ hoạt động. Hãy chỉnh rõ các khung đó.`)
    }
    if (new Set(employee.unavailable_dates).size !== employee.unavailable_dates.length ||
        employee.unavailable_dates.some((date) => !dates.includes(date))) {
      throw new Error(`Ngày nghỉ của ${id} bị trùng hoặc nằm ngoài tuần hiện tại.`)
    }
    if (employee.available_slots.some(({ date }) => employee.unavailable_dates.includes(date))) {
      throw new Error(`Ngày nghỉ và khung rảnh của ${id} đang xung đột. Hãy chỉnh một trong hai.`)
    }
    const max_work_minutes_per_week = numeric(employee.max_work_minutes_per_week, `số phút tối đa/tuần của ${id}`, { integer: true, min: 0, max: 10080 })
    const min_days_off_per_week = employee.min_days_off_per_week === '' ? undefined :
      numeric(employee.min_days_off_per_week, `số ngày nghỉ tối thiểu/tuần của ${id}`, { integer: true, min: 0, max: 7 })
    return { id, skills: employee.skills, available_slots: employee.available_slots, unavailable_dates: employee.unavailable_dates,
      max_work_minutes_per_week, ...(min_days_off_per_week === undefined ? {} : { min_days_off_per_week }) }
  })
  const aht_seconds = numeric(draft.aht_seconds, 'AHT (giây)', { min: 0 })
  const waiting_seconds = numeric(draft.waiting_seconds, 'thời gian chờ (giây)', { min: 0 })
  const target_sla_percent = numeric(draft.target_sla_percent, 'SLA (%)', { min: 0 })
  if (!isValidSlaPercent(draft.target_sla_percent)) {
    throw new Error('SLA mục tiêu phải lớn hơn 0% và nhỏ hơn 100%.')
  }
  const target_sla = target_sla_percent / 100

  const base = { week_start: draft.week_start, groups, operating_hours, employees, shift_starts,
    allow_skill_fallback: draft.allow_skill_fallback, aht_seconds, target_sla, waiting_seconds }
  if (draft.mode === 'planned_calls') {
    const expected = new Set(operating_hours.flatMap(({ date, hour }) => groups.map((group) => callKey(date, hour, group))))
    for (const [key, value] of Object.entries(draft.planned_calls)) {
      if (value !== '' && !expected.has(key)) throw new Error('Bảng cuộc gọi còn dòng ngoài tuần/giờ/nhóm hiện tại. Hãy chỉnh hoặc xóa rõ dòng đó.')
    }
    const planned_calls = operating_hours.flatMap(({ date, hour }) => groups.map((group) => {
      const value = draft.planned_calls[callKey(date, hour, group)] ?? ''
      return { date, hour, group_id: group, calls_per_hour: numeric(value, `cuộc gọi ${date} ${hour}:00 / ${group}`, { min: 0 }) }
    }))
    if (planned_calls.some(({ calls_per_hour }) => calls_per_hour > 0) && aht_seconds <= 0) throw new Error('AHT phải lớn hơn 0 khi có cuộc gọi.')
    return { ...base, mode: 'planned_calls', planned_calls }
  }

  if (!draft.history.length) throw new Error('Thêm ít nhất hai quan sát lịch sử cho mỗi thứ/giờ/nhóm dự báo.')
  const seen = new Set<string>()
  const counts = new Map<string, number>()
  const targetKeys = new Set(operating_hours.flatMap(({ date, hour }) => {
    const weekday = String(new Date(`${date}T00:00:00Z`).getUTCDay())
    return groups.map((group) => callKey(weekday, hour, group))
  }))
  const history = draft.history.map((row) => {
    const date = row.date
    const parsedDate = new Date(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date || date >= draft.week_start) {
      throw new Error(`Ngày lịch sử ${date || '(trống)'} phải hợp lệ và nằm trước tuần bắt đầu.`)
    }
    const hour = numeric(row.hour, 'giờ lịch sử', { integer: true, min: 0, max: 22 })
    if (!groups.includes(row.group_id)) throw new Error(`Nhóm lịch sử “${row.group_id}” chưa được khai báo.`)
    const count = numeric(row.calls, `số cuộc gọi ngày ${date} / ${row.group_id}`, { integer: true, min: 0 })
    if (!Number.isSafeInteger(count)) throw new Error(`Số cuộc gọi ngày ${date} / ${row.group_id} vượt giới hạn số nguyên an toàn.`)
    const forecastKey = callKey(String(parsedDate.getUTCDay()), hour, row.group_id)
    if (!targetKeys.has(forecastKey)) throw new Error(`Quan sát ${date} ${hour}:00 / ${row.group_id} không thuộc lưới thứ/giờ/nhóm đang dự báo.`)
    const rowKey = callKey(date, hour, row.group_id)
    if (seen.has(rowKey)) throw new Error(`Quan sát lịch sử bị trùng: ${date}, ${hour}:00, ${row.group_id}.`)
    seen.add(rowKey)
    counts.set(forecastKey, (counts.get(forecastKey) ?? 0) + 1)
    return { date, hour, group_id: row.group_id, calls: count }
  })
  for (const { date, hour } of operating_hours) {
    const weekday = String(new Date(`${date}T00:00:00Z`).getUTCDay())
    for (const group of groups) {
      if ((counts.get(callKey(weekday, hour, group)) ?? 0) < 2) {
        throw new Error(`Cần ít nhất hai quan sát có cùng thứ/giờ/nhóm cho ${date} ${hour}:00 / ${group}.`)
      }
    }
  }
  if (aht_seconds <= 0 && history.some(({ calls }) => calls > 0)) throw new Error('AHT phải lớn hơn 0 khi lịch sử có cuộc gọi.')
  return { ...base, mode: 'history', history }
}

export function draftFromRequest(request: ScheduleV2Request): ScheduleV2Draft {
  const start = new Date(`${request.week_start}T00:00:00Z`)
  const dates = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + offset)
    return day.toISOString().slice(0, 10)
  })
  const hours = dates.map((date) => {
    const dayHours = request.operating_hours.filter((row) => row.date === date).map((row) => row.hour).sort((a, b) => a - b)
    return dayHours.length ? { start: String(dayHours[0]), end: String(dayHours[dayHours.length - 1] + 1) } : { start: '', end: '' }
  })
  const planned_calls: Record<string, string> = {}
  if (request.mode === 'planned_calls') request.planned_calls.forEach((row) => {
    planned_calls[callKey(row.date, row.hour, row.group_id)] = String(row.calls_per_hour)
  })
  return { mode: request.mode, week_start: request.week_start, groups_text: request.groups.join('\n'), hours,
    planned_calls, history: request.mode === 'history' ? request.history.map((row, index) => ({ ...row, id: `history-${index + 1}`, hour: String(row.hour), calls: String(row.calls) })) : [],
    employees: request.employees.map((employee) => ({ ...employee, max_work_minutes_per_week: String(employee.max_work_minutes_per_week), min_days_off_per_week: employee.min_days_off_per_week == null ? '' : String(employee.min_days_off_per_week) })),
    shift_starts: request.shift_starts.map(({ date, start }) => ({ date, start })), aht_seconds: String(request.aht_seconds),
    target_sla_percent: String(request.target_sla * 100), waiting_seconds: String(request.waiting_seconds), allow_skill_fallback: request.allow_skill_fallback ?? false }
}

export function emptyScheduleDraft(mode: ScheduleV2Mode, weekStart: string): ScheduleV2Draft {
  return { mode, week_start: weekStart, groups_text: '', hours: Array.from({ length: 7 }, () => ({ start: '', end: '' })),
    planned_calls: {}, history: [], employees: [], shift_starts: [], aht_seconds: '', target_sla_percent: '', waiting_seconds: '', allow_skill_fallback: false }
}
