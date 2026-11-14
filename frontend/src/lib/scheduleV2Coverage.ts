import { hasSchedule, type ScheduleV2Response } from '@/services/scheduleV2'

export const slotGroupKey = (date: string, start: string, group: string) =>
  JSON.stringify([date, start, group])

export function scheduleV2Coverage(result: ScheduleV2Response) {
  const available = hasSchedule(result.schedule.status)
  const employeesBySlot = new Map<string, Set<string>>()

  if (available) {
    for (const assignment of result.schedule.assignments) {
      for (const slot of assignment.groups_by_slot) {
        const key = slotGroupKey(assignment.date, slot.start, slot.group_id)
        const employees = employeesBySlot.get(key) ?? new Set<string>()
        employees.add(assignment.employee_id)
        employeesBySlot.set(key, employees)
      }
    }
  }

  return result.requirements.map((item) => {
    const key = slotGroupKey(item.date, item.start, item.group_id)
    return { ...item, key, assigned: available ? employeesBySlot.get(key)?.size ?? 0 : null }
  })
}
