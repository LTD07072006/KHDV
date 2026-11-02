export type ShiftId = 'ca_ngay' | 'ca_dem'

export type EmployeeStatus =
  | 'Có thể nhận ca'
  | 'Có trong bản xem trước'
  | 'Đã xếp'
  | 'Nghỉ'
  | 'Chưa chọn ca'
  | 'Chưa xếp'
  | 'Sẵn sàng'

export type DemandRow = {
  time: string
  calls: number
  aht: number
  required: number
}

export type Employee = {
  id: string
  name: string
  skill?: string
  shift: string
  breakTime: string
  status: EmployeeStatus
  working: boolean
  allowedShifts: ShiftId[]
}

export type CoverageItem = DemandRow & {
  scheduled: number
  shortage: number
  overstaff: number
  onBreak: boolean
}

export type FixtureScenario = {
  id: 'normal' | 'peak' | 'understaffed' | 'invalid'
  label: string
  description: string
  demand: DemandRow[]
  employees: Employee[]
  invalidReason?: string
}

export type InputWarning = {
  code: 'MISSING_DEMAND_GAP' | 'WORKING_WITHOUT_SHIFT'
  message: string
}

export type SchedulingResult = {
  contract_version: '1.0.0'
  request_id: string
  timezone: string
  status: 'SUCCESS' | 'DEGRADED' | 'INVALID_INPUT' | 'ERROR'
  solver_status: 'OPTIMAL' | 'FEASIBLE' | 'UNKNOWN' | 'INFEASIBLE' | 'MODEL_INVALID' | 'NOT_RUN'
  solution_source: 'SOLVER' | 'BASELINE' | 'NONE'
  has_solution: boolean
  optimality_proven: boolean
  assignments: Array<{
    employee_id: string
    template_id: string
    skill_id: string
    start: string
    end: string
    breaks: Array<{ start: string; end: string }>
  }>
  coverage: Array<{
    slot_id: string
    skill_id: string
    required_agents: number
    scheduled_agents: number
    shortage_agents: number
    overstaff_agents: number
  }>
  metrics: {
    wall_time_seconds: number
    objective_value: number
    best_objective_bound: number | null
    relative_gap: number | null
    objective_components: { shortage: number; overstaff: number; assignment: number; preference: number; fairness: number }
    shortage_agent_slots: number
    overstaff_agent_slots: number
    total_assignments: number
    hard_constraint_violations: 0
  } | null
  diagnostics: Array<{ severity: 'INFO' | 'WARNING' | 'ERROR'; code: string; message: string; path: string | null }>
  carry_out: Array<{ employee_id: string; last_shift_end: string | null; previous_local_days: Array<{ date: string; worked: boolean }> }>
}
