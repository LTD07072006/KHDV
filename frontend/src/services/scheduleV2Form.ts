import {
  callKey, identifier, isDate, isSlotStart, rangeSlots, shiftKey, slotKey,
  type CallsRow, type Group, type HistoryWindow, type Interval, type ScheduleV2Mode,
  type ScheduleV2Request, type Shift, type Slot,
} from './scheduleV2'

export type GroupDraft = Group & { sla: string; wait: string; aht: string; samples: string; cutoff: string }
export type EmployeeDraft = { id: string; skills: string[]; available_slots: Slot[]; unavailable_dates: string[]; cap: string; daysOff: string; allAvailable?: boolean }
export type HistoryDraft = Omit<CallsRow, 'calls'> & { calls: string }
export type ScheduleDraft = {
  mode: ScheduleV2Mode; week: string; groups: GroupDraft[]; operating: Interval[]; employees: EmployeeDraft[]
  shifts: Shift[]; planned: Record<string, string>; history: HistoryDraft[]; window: HistoryWindow; fallback: boolean; allowUnderstaffing?: boolean; solve: string
}
export const defaultSolveSeconds = '10'
export const blankGroup = (): GroupDraft => ({ id: '', name: '', sla: '80', wait: '20', aht: '300', samples: '', cutoff: '' })
export const blankEmployee = (): EmployeeDraft => ({ id: '', skills: [], available_slots: [], unavailable_dates: [], cap: '', daysOff: '' })

const asDate = (date: string) => new Date(date + 'T00:00:00Z')
export function weekDates(week: string): string[] {
  if (!isDate(week) || asDate(week).getUTCDay() !== 1) return []
  return Array.from({ length: 7 }, (_, index) => {
    const day = asDate(week)
    day.setUTCDate(day.getUTCDate() + index)
    return day.toISOString().split('T')[0] ?? ''
  }).filter(isDate)
}

export function emptyDraft(): ScheduleDraft {
  const date = new Date()
  date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  const week = [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  return {
    mode: 'planned_calls', week, groups: [], operating: [], employees: [], shifts: [], planned: {},
    history: [], window: { start_date: '', end_date: '' }, fallback: false, allowUnderstaffing: true, solve: defaultSolveSeconds,
  }
}

export function draftFromRequest(request: ScheduleV2Request): ScheduleDraft {
  return {
    mode: request.mode, week: request.week_start, operating: structuredClone(request.operating_intervals),
    shifts: structuredClone(request.shifts), fallback: request.allow_skill_fallback, allowUnderstaffing: Boolean(request.allow_understaffing), solve: String(request.max_solve_seconds ?? defaultSolveSeconds),
    groups: request.groups.map((group) => {
      const target = request.service_targets.find((item) => item.group_id === group.id)
      const aht = request.aht_by_group.find((item) => item.group_id === group.id)
      return {
        ...group, sla: target ? String(target.target_sla * 100) : '', wait: target ? String(target.waiting_seconds) : '',
        aht: aht ? String(aht.aht_seconds) : '',
        samples: aht && 'sample_count' in aht ? String(aht.sample_count) : '', cutoff: aht && 'cutoff_before' in aht ? aht.cutoff_before : '',
      }
    }),
    employees: request.employees.map((item) => ({
      id: item.id, skills: [...item.skills], available_slots: structuredClone(item.available_slots),
      unavailable_dates: [...item.unavailable_dates], cap: String(item.max_shift_minutes_per_week),
      daysOff: item.min_days_off_per_week === undefined ? '' : String(item.min_days_off_per_week),
    })),
    planned: request.mode === 'planned_calls' ? plannedFromRows(request.planned_calls) : {},
    history: request.mode === 'history' ? historyFromRows(request.history) : [],
    window: request.mode === 'history' ? { ...request.history_window } : { start_date: '', end_date: '' },
  }
}

export const plannedFromRows = (rows: CallsRow[]) => Object.fromEntries(rows.map((row) => [callKey(row), String(row.calls)]))
export const historyFromRows = (rows: CallsRow[]): HistoryDraft[] => rows.map((row) => ({ ...row, calls: String(row.calls) }))
export const operatingSlots = (intervals: Interval[]) => [...new Map(intervals.flatMap((interval) =>
  rangeSlots(interval).map((start) => {
    const item = { date: interval.date, start }
    return [slotKey(item), item] as const
  }))).values()].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
export const validWindow = (window: HistoryWindow, week: string) =>
  isDate(window.start_date) && isDate(window.end_date) && window.start_date < window.end_date && window.end_date <= week

function number(value: string, label: string, { integer = false, min = 0, max = Infinity } = {}) {
  const parsed = Number(value)
  if (!value.trim() || !Number.isFinite(parsed) || (integer && !Number.isSafeInteger(parsed)) || parsed < min || parsed > max) {
    throw new Error(`Kiểm tra giá trị ${label}.`)
  }
  return parsed
}

export function numericError(value: string, min: number, max = Infinity, integer = false) {
  if (!value.trim()) return 'Điền số vào ô này.'
  const n = Number(value)
  if (!Number.isFinite(n) || (integer && !Number.isSafeInteger(n)) || n < min || n > max) {
    return `Nhập ${integer ? 'số nguyên' : 'số'} ${max === Infinity ? `từ ${min} trở lên` : `từ ${min} đến ${max}`}.`
  }
}

function unique<T>(items: T[]) {
  return new Set(items).size === items.length
}

function validatedShifts(shifts: Shift[], dates: string[], grid: Set<string>) {
  if (shifts.length > 200 || !unique(shifts.map(shiftKey))) throw new Error('Khai báo tối đa 200 ca và tránh ca trùng nhau.')
  return shifts.map((shift, index) => {
    const envelope = rangeSlots(shift)
    if (!dates.includes(shift.date) || !envelope.length || !envelope.every((start) => grid.has(slotKey({ date: shift.date, start })))) {
      throw new Error(`Ca ${index + 1} phải nằm trọn trong giờ hoạt động, kể cả giờ nghỉ.`)
    }
    const working = new Set(envelope)
    const breaks = [...shift.breaks].sort((a, b) => a.start.localeCompare(b.start))
    for (const pause of breaks) {
      const slots = rangeSlots(pause)
      if (!slots.length || !slots.every((slot) => working.delete(slot))) {
        throw new Error(`Giờ nghỉ của ca ${index + 1} phải nằm trong ca và không chồng lấn.`)
      }
    }
    if (!working.size) throw new Error(`Ca ${index + 1} cần ít nhất một khung làm việc 30 phút.`)
    return { ...shift, breaks }
  })
}

export function buildScheduleV2Request(draft: ScheduleDraft): ScheduleV2Request {
  const dates = weekDates(draft.week)
  if (dates.length !== 7) throw new Error('Tuần lập lịch phải bắt đầu vào thứ Hai hợp lệ.')
  const groups = draft.groups.map(({ id, name }) => ({ id: id.trim(), name: name.trim() }))
  const groupIds = new Set(groups.map(({ id }) => id))
  if (!groups.length || groups.length > 10 || groups.length !== groupIds.size ||
      !groups.every(({ id, name }) => identifier(id) && identifier(name))) {
    throw new Error('Nhập từ 1 đến 10 nhóm có tên và mã duy nhất, dài tối đa 100 ký tự.')
  }
  const operating = [...draft.operating].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  if (!operating.length) throw new Error('Thêm ít nhất một khoảng hoạt động.')
  for (const [index, interval] of operating.entries()) {
    const previous = operating[index - 1]
    if (!dates.includes(interval.date) || !rangeSlots(interval).length) {
      throw new Error('Khoảng hoạt động phải nằm trong tuần, theo mốc 30 phút và có giờ kết thúc sau giờ bắt đầu.')
    }
    if (previous?.date === interval.date && previous.end > interval.start) throw new Error('Các khoảng hoạt động cùng ngày không được chồng lấn.')
  }
  const slots = operatingSlots(operating)
  const grid = new Set(slots.map(slotKey))
  const shifts = validatedShifts(draft.shifts, dates, grid)
  if (draft.employees.length > 50 || !unique(draft.employees.map((employee) => employee.id.trim()))) {
    throw new Error('Khai báo tối đa 50 nhân viên với mã khác nhau.')
  }
  const employees = draft.employees.map((employee, index) => {
    const id = employee.id.trim()
    if (!identifier(id)) throw new Error(`Nhập mã hợp lệ cho nhân viên ${index + 1}.`)
    if (!unique(employee.skills) || employee.skills.some((group) => !groupIds.has(group))) throw new Error(`Kiểm tra nhóm kỹ năng của ${id}.`)
    if (!unique(employee.unavailable_dates) || employee.unavailable_dates.some((date) => !dates.includes(date))) {
      throw new Error(`Ngày nghỉ của ${id} nằm ngoài tuần hoặc bị trùng.`)
    }
    if (!unique(employee.available_slots.map(slotKey)) || employee.available_slots.some((slot) => !grid.has(slotKey(slot)))) {
      throw new Error(`Giờ rảnh của ${id} nằm ngoài giờ hoạt động hoặc bị trùng.`)
    }
    if (employee.available_slots.some(({ date }) => employee.unavailable_dates.includes(date))) {
      throw new Error(`Giờ rảnh của ${id} trùng với ngày nghỉ.`)
    }
    return {
      id, skills: employee.skills, available_slots: employee.available_slots, unavailable_dates: employee.unavailable_dates,
      max_shift_minutes_per_week: number(employee.cap, `phút ca tối đa của ${id}`, { integer: true, max: 10080 }),
      ...(employee.daysOff === '' ? {} : { min_days_off_per_week: number(employee.daysOff, `ngày nghỉ tối thiểu của ${id}`, { integer: true, max: 7 }) }),
    }
  })
  const targets = draft.groups.map(({ id, sla, wait }) => {
    const percent = number(sla, `SLA của ${id}`)
    if (!isValidSlaPercent(sla)) {
      throw new Error(`SLA của ${id} phải lớn hơn 0% và nhỏ hơn 100%.`)
    }
    return { group_id: id.trim(), target_sla: percent / 100, waiting_seconds: number(wait, `ngưỡng chờ của ${id}`) }
  })
  const aht = draft.groups.flatMap<ScheduleV2Request['aht_by_group'][number]>((group) => {
    if (!group.aht && !group.samples && !group.cutoff) return []
    const aht_seconds = number(group.aht, `AHT của ${group.id}`)
    if (aht_seconds > 0 && !group.samples && !group.cutoff) {
      return [{ group_id: group.id.trim(), aht_seconds, source: 'estimate' }]
    }
    if (aht_seconds <= 0 || !isDate(group.cutoff) || group.cutoff > draft.week) {
      throw new Error(`Nhóm ${group.id} cần AHT dương và ngày chốt mẫu không sau ngày đầu tuần.`)
    }
    return [{
      group_id: group.id.trim(), aht_seconds, cutoff_before: group.cutoff,
      sample_count: number(group.samples, `số mẫu AHT của ${group.id}`, { integer: true, min: 1 }),
    }]
  })
  const base = {
    week_start: draft.week, groups, operating_intervals: operating, shifts, employees,
    service_targets: targets, aht_by_group: aht, allow_skill_fallback: draft.fallback,
    ...(draft.allowUnderstaffing ? { allow_understaffing: true } : {}),
    max_solve_seconds: number(draft.solve, 'thời gian tìm lịch', { integer: true, min: 1, max: 30 }),
  }
  const targetsBySlot = slots.flatMap((slot) => groups.map(({ id }) => ({ ...slot, group_id: id })))
  const ahtGroups = new Set(aht.map(({ group_id }) => group_id))
  const requireAht = (group: string) => {
    if (!ahtGroups.has(group)) throw new Error(`Nhóm ${group} có cuộc gọi và cần thông tin AHT.`)
  }
  if (draft.mode === 'planned_calls') {
    const keys = new Set(targetsBySlot.map(callKey))
    if (Object.entries(draft.planned).some(([key, value]) => value !== '' && !keys.has(key))) {
      throw new Error('Cuộc gọi dự kiến còn dòng ngoài lưới. Kiểm tra và xóa các dòng đó.')
    }
    const planned_calls = targetsBySlot.map((target) => {
      const calls = number(draft.planned[callKey(target)] ?? '', `cuộc gọi ${target.date} ${target.start} · ${target.group_id}. Nhập 0 nếu đã xác nhận không có cuộc gọi`)
      if (calls > 0) requireAht(target.group_id)
      return { ...target, calls }
    })
    return { ...base, mode: 'planned_calls', planned_calls }
  }

  if (!validWindow(draft.window, draft.week)) {
    throw new Error('Khoảng lịch sử phải có ngày bắt đầu trước ngày kết thúc. Ngày kết thúc không được sau tuần lập lịch.')
  }
  if (draft.history.length > 100_000) throw new Error('Lịch sử vượt số dòng cho phép.')
  const history = draft.history.map((row, index) => {
    if (!isDate(row.date) || row.date < draft.window.start_date || row.date >= draft.window.end_date ||
        !isSlotStart(row.start) || !groupIds.has(row.group_id)) {
      throw new Error(`Dòng lịch sử ${index + 1} cần ngày trong khoảng lịch sử, mốc 30 phút và mã nhóm đã khai báo.`)
    }
    return { ...row, calls: number(row.calls, `cuộc gọi tại dòng lịch sử ${index + 1}`, { integer: true }) }
  })
  if (!unique(history.map(callKey))) throw new Error('Dữ liệu lịch sử có dòng trùng ngày, giờ bắt đầu và nhóm.')
  const forecastKey = ({ date, start, group_id }: Omit<CallsRow, 'calls'>) => JSON.stringify([asDate(date).getUTCDay(), start, group_id])
  const samples = new Map<string, { count: number; positive: boolean }>()
  for (const row of history) {
    const key = forecastKey(row)
    const current = samples.get(key)
    samples.set(key, { count: (current?.count ?? 0) + 1, positive: !!current?.positive || row.calls > 0 })
  }
  for (const target of targetsBySlot) {
    const sample = samples.get(forecastKey(target))
    if (!sample || sample.count < 2) throw new Error(`Cần ít nhất hai ngày lịch sử cùng thứ cho ${target.date} ${target.start} · ${target.group_id}.`)
    if (sample.positive) requireAht(target.group_id)
  }
  return { ...base, mode: 'history', history_window: draft.window, history }
}
export function isValidSlaPercent(value: string) {
  const fraction = Number(value) / 100
  return value.trim() !== '' && fraction > 0 && fraction < 1
}

export const displayDate = (date: string) => date.split('-').reverse().join('/')

export function syncWildcardEmployees(employees: EmployeeDraft[], slots: Slot[]): EmployeeDraft[] {
  if (!employees.some((employee) => employee.allAvailable)) return employees
  return employees.map((employee) => {
    if (!employee.allAvailable) return employee
    const off = new Set(employee.unavailable_dates)
    return {
      ...employee,
      available_slots: slots.filter((slot) => !off.has(slot.date)),
    }
  })
}

export const MAX_ASSIGNMENT_VARIABLES = 300_000

export function estimateAssignmentVariables(draft: ScheduleDraft): number {
  const validGroups = [...new Set(draft.groups.map((group) => group.id.trim()).filter(Boolean))]
  const groupSet = new Set(validGroups)
  if (!validGroups.length || !draft.employees.length || !draft.shifts.length) return 0

  const shiftMeta = draft.shifts.map((shift) => {
    const envelope = rangeSlots(shift)
    const breakSet = new Set(shift.breaks.flatMap((pause) => rangeSlots(pause)))
    const workingCount = envelope.filter((start) => !breakSet.has(start)).length
    return { date: shift.date, envelopeKeys: envelope.map((start) => slotKey({ date: shift.date, start })), workingCount }
  })

  let total = 0
  for (const employee of draft.employees) {
    const eligibleGroupsCount = draft.fallback
      ? validGroups.length
      : employee.skills.filter((skill) => groupSet.has(skill)).length
    if (!eligibleGroupsCount) continue
    const available = new Set(employee.available_slots.map(slotKey))
    const off = new Set(employee.unavailable_dates)
    for (const shift of shiftMeta) {
      if (!shift.workingCount || off.has(shift.date)) continue
      if (!shift.envelopeKeys.every((key) => available.has(key))) continue
      total += shift.workingCount * eligibleGroupsCount
    }
  }
  return total
}
