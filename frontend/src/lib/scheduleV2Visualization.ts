import { rangeSlots, timeMinutes, timeText, type ScheduleV2Response } from '@/services/scheduleV2'

export type CoverageState = 'exact' | 'over' | 'under' | 'unavailable'
export type IntervalRow = ScheduleV2Response['interval_results'][number]
export type AssignmentRow = ScheduleV2Response['schedule']['assignments'][number]
export type EmployeeSkillsMap = Record<string, string[]>

export type CoverageSummary = Record<CoverageState, number> & { total: number }

export type AssignmentFilter = {
  date: string
  group: string
  employee: string
  mismatchOnly?: boolean
}

export type TimelineSegment = {
  kind: 'group' | 'break'
  start: string
  end: string
  groupId?: string
  groupIndex?: number
  skillMismatch?: boolean
  leftPct: number
  widthPct: number
}

export type GanttShift = {
  assignment: AssignmentRow
  leftPct: number
  widthPct: number
  segments: TimelineSegment[]
  workMinutes: number
  hasSkillMismatch: boolean
  mismatchSlotCount: number
}

export type GanttRow = {
  employeeId: string
  shiftCount: number
  totalWorkMinutes: number
  cells: Record<string, GanttShift[]>
}

export type WeeklyGanttModel = {
  dates: string[]
  employees: string[]
  rows: GanttRow[]
  minMinute: number
  maxMinute: number
  ticks: { minute: number; label: string; leftPct: number }[]
  hasBreaks: boolean
  hasAnySkillMismatch: boolean
}

export function isSlotSkillMismatch(
  employeeId: string,
  groupId: string,
  employeeSkills?: EmployeeSkillsMap,
): boolean {
  const skills = employeeSkills?.[employeeId]
  return Boolean(skills && !skills.includes(groupId))
}

export function coverageState(required: number, assigned: number | null): CoverageState {
  if (assigned === null) return 'unavailable'
  if (assigned < required) return 'under'
  if (assigned > required) return 'over'
  return 'exact'
}

export function coverageDeltaLabel(required: number, assigned: number | null): string {
  const state = coverageState(required, assigned)
  if (state === 'unavailable') return 'Chưa có lịch'
  if (state === 'exact') return 'Đủ'
  const diff = (assigned ?? 0) - required
  return state === 'over' ? `Thừa +${diff}` : `Thiếu ${-diff}`
}

export function summarizeCoverage(rows: IntervalRow[]): CoverageSummary {
  const summary: CoverageSummary = { exact: 0, over: 0, under: 0, unavailable: 0, total: rows.length }
  for (const row of rows) {
    summary[coverageState(row.erlang.required_staff, row.assigned_staff)] += 1
  }
  return summary
}

export function filterAssignments(
  assignments: AssignmentRow[],
  filter: AssignmentFilter,
  employeeSkills?: EmployeeSkillsMap,
): AssignmentRow[] {
  return assignments
    .filter((shift) => {
      if (filter.date && shift.date !== filter.date) return false
      if (filter.employee && shift.employee_id !== filter.employee) return false
      if (filter.group && !shift.groups_by_slot.some((slot) => slot.group_id === filter.group)) return false
      if (filter.mismatchOnly && !shift.groups_by_slot.some((slot) => isSlotSkillMismatch(shift.employee_id, slot.group_id, employeeSkills))) {
        return false
      }
      return true
    })
    .sort((a, b) =>
      a.employee_id.localeCompare(b.employee_id) ||
      a.date.localeCompare(b.date) ||
      a.start.localeCompare(b.start))
}

function buildShiftSegments(
  shift: AssignmentRow,
  groupIndices: Map<string, number>,
  employeeSkills?: EmployeeSkillsMap,
): TimelineSegment[] {
  const shiftStart = timeMinutes(shift.start)
  const shiftEnd = timeMinutes(shift.end)
  const span = Math.max(30, shiftEnd - shiftStart)
  const toPct = (minute: number) => ((minute - shiftStart) / span) * 100

  const segments: TimelineSegment[] = []

  const sortedSlots = [...shift.groups_by_slot].sort((a, b) => a.start.localeCompare(b.start))
  for (const slot of sortedSlots) {
    const startMin = timeMinutes(slot.start)
    const endMin = startMin + 30
    const mismatch = isSlotSkillMismatch(shift.employee_id, slot.group_id, employeeSkills)
    const prev = segments[segments.length - 1]
    if (prev && prev.kind === 'group' && prev.groupId === slot.group_id && prev.skillMismatch === mismatch && prev.end === slot.start) {
      prev.end = timeText(endMin)
      prev.widthPct = ((endMin - timeMinutes(prev.start)) / span) * 100
    } else {
      segments.push({
        kind: 'group',
        start: slot.start,
        end: timeText(endMin),
        groupId: slot.group_id,
        groupIndex: groupIndices.get(slot.group_id) ?? 0,
        skillMismatch: mismatch,
        leftPct: toPct(startMin),
        widthPct: (30 / span) * 100,
      })
    }
  }

  for (const pause of shift.breaks) {
    const startMin = timeMinutes(pause.start)
    const endMin = timeMinutes(pause.end)
    if (endMin <= startMin) continue
    segments.push({
      kind: 'break',
      start: pause.start,
      end: pause.end,
      leftPct: toPct(startMin),
      widthPct: ((endMin - startMin) / span) * 100,
    })
  }

  return segments.sort((a, b) => a.start.localeCompare(b.start))
}

export function buildWeeklyGantt(
  result: ScheduleV2Response,
  filter: AssignmentFilter,
  employeeSkills?: EmployeeSkillsMap,
): WeeklyGanttModel {
  const allDates = [...new Set([
    ...result.interval_results.map((row) => row.date),
    ...result.schedule.assignments.map((shift) => shift.date),
  ])].sort()

  const dates = filter.date ? allDates.filter((d) => d === filter.date) : allDates
  const filtered = filterAssignments(result.schedule.assignments, filter, employeeSkills)
  const employees = [...new Set(filtered.map((shift) => shift.employee_id))].sort()

  const groupIndices = new Map(result.groups.map((g, index) => [g.id, index % 6]))

  const minutePoints: number[] = []
  for (const row of result.interval_results) {
    if (filter.date && row.date !== filter.date) continue
    const start = timeMinutes(row.start)
    minutePoints.push(start, start + 30)
  }
  for (const shift of filtered) {
    minutePoints.push(timeMinutes(shift.start), timeMinutes(shift.end))
  }

  const rawMin = minutePoints.length ? Math.min(...minutePoints) : 8 * 60
  const rawMax = minutePoints.length ? Math.max(...minutePoints) : 17 * 60
  const minMinute = Math.floor(rawMin / 60) * 60
  const maxMinute = Math.max(minMinute + 60, Math.ceil(rawMax / 60) * 60)
  const totalSpan = maxMinute - minMinute

  const step = totalSpan > 12 * 60 ? 180 : totalSpan > 6 * 60 ? 120 : 60
  const ticks: WeeklyGanttModel['ticks'] = []
  for (let minute = minMinute; minute <= maxMinute; minute += step) {
    ticks.push({
      minute,
      label: timeText(minute),
      leftPct: ((minute - minMinute) / totalSpan) * 100,
    })
  }
  if (ticks[ticks.length - 1]?.minute !== maxMinute) {
    ticks.push({ minute: maxMinute, label: timeText(maxMinute), leftPct: 100 })
  }

  let hasBreaks = false
  let hasAnySkillMismatch = false
  const rows: GanttRow[] = employees.map((employeeId) => {
    const cells: Record<string, GanttShift[]> = {}
    for (const date of dates) cells[date] = []

    const empShifts = filtered.filter((shift) => shift.employee_id === employeeId)
    let totalWorkMinutes = 0

    for (const shift of empShifts) {
      if (shift.breaks.length > 0) hasBreaks = true
      const startMin = timeMinutes(shift.start)
      const endMin = timeMinutes(shift.end)
      const workSlots = shift.groups_by_slot.length || rangeSlots({ start: shift.start, end: shift.end }).length
      const workMinutes = workSlots * 30
      totalWorkMinutes += workMinutes

      const mismatchSlotCount = shift.groups_by_slot.filter((slot) =>
        isSlotSkillMismatch(shift.employee_id, slot.group_id, employeeSkills)).length
      const hasSkillMismatch = mismatchSlotCount > 0
      if (hasSkillMismatch) hasAnySkillMismatch = true

      const ganttShift: GanttShift = {
        assignment: shift,
        leftPct: ((startMin - minMinute) / totalSpan) * 100,
        widthPct: ((endMin - startMin) / totalSpan) * 100,
        segments: buildShiftSegments(shift, groupIndices, employeeSkills),
        workMinutes,
        hasSkillMismatch,
        mismatchSlotCount,
      }
      if (!cells[shift.date]) cells[shift.date] = []
      cells[shift.date].push(ganttShift)
    }

    return {
      employeeId,
      shiftCount: empShifts.length,
      totalWorkMinutes,
      cells,
    }
  })

  return { dates, employees, rows, minMinute, maxMinute, ticks, hasBreaks, hasAnySkillMismatch }
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} phút`
  if (mins === 0) return `${hours} giờ`
  return `${hours}g ${mins}p`
}
