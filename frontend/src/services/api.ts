/** API client for the active workbook -> SchedulingResult v1.0.0 flow. */

export type GenerateSchedulePayload = {
  planningDate: string
  workbook: File
  serviceTarget?: number
  answerWithinSeconds?: number
  employeeOverrides?: Array<{ employee_id: string; working: boolean; allowed_shifts: string[] }>
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
  assignments: Array<{ employee_id: string; template_id: string; skill_id: string; start: string; end: string; breaks: Array<{ start: string; end: string }> }>
  coverage: Array<{ slot_id: string; skill_id: string; required_agents: number; scheduled_agents: number; shortage_agents: number; overstaff_agents: number }>
  metrics: { wall_time_seconds: number; objective_value: number; best_objective_bound: number | null; relative_gap: number | null; objective_components: { shortage: number; overstaff: number; assignment: number; preference: number; fairness: number }; shortage_agent_slots: number; overstaff_agent_slots: number; total_assignments: number; hard_constraint_violations: 0 } | null
  diagnostics: Array<{ severity: 'INFO' | 'WARNING' | 'ERROR'; code: string; message: string; path: string | null }>
  carry_out: Array<{ employee_id: string; last_shift_end: string | null; previous_local_days: Array<{ date: string; worked: boolean }> }>
}

export type WorkbookPreview = {
  contract_version: '1.0.0'
  filename: string
  request_id: string
  summary: { total_slots: number; total_calls: number; max_required: number; total_employees: number; working_employees: number }
  demand: Array<{ slot_id: string; time: string; time_start: string; time_end: string; calls: number; aht: number; required: number; required_agents: number }>
  employees: Array<{ id: string; employee_id: string; name: string; working: boolean; allowedShifts: Array<'ca_ngay' | 'ca_dem'>; allowed_shifts: Array<'ca_ngay' | 'ca_dem'>; shift: string; breakTime: string; status: string }>
  warnings: string[]
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null) as { detail?: string } | null
  return new Error(body?.detail || fallback)
}

export async function checkBackendHealth(): Promise<boolean> {
  try { return (await fetch('/health')).ok } catch { return false }
}

export async function previewWorkbook(payload: Pick<GenerateSchedulePayload, 'planningDate' | 'workbook'>): Promise<WorkbookPreview> {
  const form = new FormData(); form.append('file', payload.workbook); form.append('planning_date', payload.planningDate)
  const response = await fetch('/api/preview-workbook', { method: 'POST', body: form })
  if (!response.ok) throw await readError(response, 'Không thể đọc workbook.')
  return response.json() as Promise<WorkbookPreview>
}

export async function generateSchedule(payload: GenerateSchedulePayload): Promise<SchedulingResult> {
  const form = new FormData(); form.append('file', payload.workbook); form.append('planning_date', payload.planningDate); form.append('service_target', String(payload.serviceTarget ?? 0.8)); form.append('answer_within_seconds', String(payload.answerWithinSeconds ?? 20))
  if (payload.employeeOverrides) form.append('employee_overrides', JSON.stringify(payload.employeeOverrides))
  const response = await fetch('/api/schedule', { method: 'POST', body: form })
  if (!response.ok) throw await readError(response, 'Không thể tạo lịch từ workbook.')
  return response.json() as Promise<SchedulingResult>
}
