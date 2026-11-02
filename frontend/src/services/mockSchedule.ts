import type { DemandRow, Employee, ShiftId, SchedulingResult } from '@/types/scheduling'

const shiftDetails: Record<ShiftId, { template: string; start: string; end: string; breakStart: string; breakEnd: string }> = {
  ca_ngay: { template: 'day_0800', start: '08:00', end: '20:00', breakStart: '12:00', breakEnd: '13:00' },
  ca_dem: { template: 'night_2000', start: '20:00', end: '08:00', breakStart: '00:00', breakEnd: '01:00' },
}

function slotMinutes(time: string) {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number)
  return hour * 60 + minute
}

function isCoveredByShift(time: string, shift: ShiftId) {
  const minutes = slotMinutes(time)
  if (shift === 'ca_ngay') return minutes >= 8 * 60 && minutes < 20 * 60 && !(minutes >= 12 * 60 && minutes < 13 * 60)
  return (minutes >= 20 * 60 || minutes < 8 * 60) && !(minutes < 60)
}

export function isBreakSlot(time: string) {
  const minutes = slotMinutes(time)
  return (minutes >= 12 * 60 && minutes < 13 * 60) || minutes < 60
}

/** Deterministic frontend-only preview. It intentionally reports BASELINE/FEASIBLE. */
export function createMockSchedule(
  planningDate: string,
  demand: DemandRow[],
  employees: Employee[],
): SchedulingResult {
  const working = employees.filter((employee) => employee.working && employee.allowedShifts.length > 0)
  const assignments = working.map((employee, index) => {
    const shift = employee.allowedShifts[index % employee.allowedShifts.length]
    const details = shiftDetails[shift]
    return {
      employee_id: employee.id,
      template_id: details.template,
      skill_id: 'general_support',
      start: `${planningDate}T${details.start}:00+07:00`,
      end: `${planningDate}T${details.end}:00+07:00`,
      breaks: [{ start: `${planningDate}T${details.breakStart}:00+07:00`, end: `${planningDate}T${details.breakEnd}:00+07:00` }],
    }
  })

  const assignmentsByShift = new Map<ShiftId, number>()
  assignments.forEach((assignment) => {
    const shift: ShiftId = assignment.template_id === 'night_2000' ? 'ca_dem' : 'ca_ngay'
    assignmentsByShift.set(shift, (assignmentsByShift.get(shift) ?? 0) + 1)
  })

  const coverage = demand.map((row, index) => {
    const scheduled = (['ca_ngay', 'ca_dem'] as ShiftId[]).reduce(
      (sum, shift) => sum + (isCoveredByShift(row.time, shift) ? assignmentsByShift.get(shift) ?? 0 : 0),
      0,
    )
    const onBreak = isBreakSlot(row.time)
    return {
      slot_id: `slot_${String(index + 1).padStart(2, '0')}`,
      skill_id: 'general_support',
      required_agents: onBreak ? 0 : row.required,
      scheduled_agents: onBreak ? 0 : scheduled,
      shortage_agents: onBreak ? 0 : Math.max(0, row.required - scheduled),
      overstaff_agents: onBreak ? 0 : Math.max(0, scheduled - row.required),
    }
  })
  const shortage = coverage.reduce((sum, row) => sum + row.shortage_agents, 0)
  const overstaff = coverage.reduce((sum, row) => sum + row.overstaff_agents, 0)

  return {
    contract_version: '1.0.0',
    request_id: `mock-${Date.now()}`,
    timezone: 'Asia/Ho_Chi_Minh',
    status: shortage ? 'DEGRADED' : 'SUCCESS',
    solver_status: 'FEASIBLE',
    solution_source: 'BASELINE',
    has_solution: true,
    optimality_proven: false,
    assignments,
    coverage,
    metrics: {
      wall_time_seconds: 0.001,
      objective_value: shortage + overstaff,
      best_objective_bound: null,
      relative_gap: null,
      objective_components: { shortage, overstaff, assignment: assignments.length, preference: 0, fairness: 0 },
      shortage_agent_slots: shortage,
      overstaff_agent_slots: overstaff,
      total_assignments: assignments.length,
      hard_constraint_violations: 0,
    },
    diagnostics: [{ severity: 'INFO', code: 'LOCAL_PREVIEW', message: 'Kết quả được tính bằng bộ mô phỏng frontend; chưa gửi lên backend.', path: null }],
    carry_out: [],
  }
}
