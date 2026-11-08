import type { SchedulingResult } from '@/types/scheduling'

export function employeeIdsOnDuty(assignments: SchedulingResult['assignments'], date: string, time: string) {
  // Planning dates and demand slots in this workspace use Vietnam local time.
  const instant = Date.parse(`${date}T${time.slice(0, 5)}:00+07:00`)
  const includesInstant = ({ start, end }: { start: string; end: string }) =>
    Date.parse(start) <= instant && instant < Date.parse(end)

  return [...new Set(assignments
    .filter((assignment) => includesInstant(assignment) && !assignment.breaks.some(includesInstant))
    .map((assignment) => assignment.employee_id))]
}
