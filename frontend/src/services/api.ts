import type { SchedulingResult } from '@/types/scheduling'
export type { SchedulingResult } from '@/types/scheduling'

/** API client for the active workbook -> SchedulingResult v1.0.0 flow. */

export type GenerateSchedulePayload = {
  planningDate: string
  workbook: File
  serviceTarget?: number
  answerWithinSeconds?: number
  employeeOverrides?: Array<{ employee_id: string; working: boolean; allowed_shifts: string[] }>
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

export function isSchedulingResult(value: unknown): value is SchedulingResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<SchedulingResult>
  return result.contract_version === '1.0.0'
    && typeof result.request_id === 'string'
    && typeof result.timezone === 'string'
    && typeof result.status === 'string'
    && typeof result.solver_status === 'string'
    && typeof result.solution_source === 'string'
    && typeof result.has_solution === 'boolean'
    && typeof result.optimality_proven === 'boolean'
    && Array.isArray(result.assignments)
    && Array.isArray(result.coverage)
    && Array.isArray(result.diagnostics)
    && Array.isArray(result.carry_out)
    && (result.metrics === null || typeof result.metrics === 'object')
}

async function readJson<T>(response: Response, fallback: string, guard: (value: unknown) => value is T): Promise<T> {
  const value: unknown = await response.json().catch(() => null)
  if (!guard(value)) throw new Error(fallback)
  return value
}

export async function checkBackendHealth(): Promise<boolean> {
  try { return (await fetch('/health')).ok } catch { return false }
}

export async function previewWorkbook(payload: {
  planningDate: string
  workbook: File
  serviceTarget?: number
  answerWithinSeconds?: number
}): Promise<WorkbookPreview> {
  const form = new FormData()
  form.append('file', payload.workbook)
  form.append('planning_date', payload.planningDate)
  if (payload.serviceTarget !== undefined) form.append('service_target', String(payload.serviceTarget))
  if (payload.answerWithinSeconds !== undefined) form.append('answer_within_seconds', String(payload.answerWithinSeconds))
  const response = await fetch('/api/preview-workbook', { method: 'POST', body: form })
  if (!response.ok) throw await readError(response, 'Không thể đọc workbook.')
  return readJson(response, 'Workbook trả về dữ liệu không đúng định dạng.', (value): value is WorkbookPreview => {
    if (!value || typeof value !== 'object') return false
    const preview = value as Partial<WorkbookPreview>
    return preview.contract_version === '1.0.0' && typeof preview.filename === 'string' && typeof preview.request_id === 'string' && Array.isArray(preview.demand) && Array.isArray(preview.employees) && Array.isArray(preview.warnings)
  })
}

export async function generateSchedule(payload: GenerateSchedulePayload): Promise<SchedulingResult> {
  const form = new FormData(); form.append('file', payload.workbook); form.append('planning_date', payload.planningDate); form.append('service_target', String(payload.serviceTarget ?? 0.8)); form.append('answer_within_seconds', String(payload.answerWithinSeconds ?? 20))
  if (payload.employeeOverrides) form.append('employee_overrides', JSON.stringify(payload.employeeOverrides))
  const response = await fetch('/api/schedule', { method: 'POST', body: form })
  if (!response.ok) throw await readError(response, 'Không thể tạo lịch từ workbook.')
  return readJson(response, 'Kết quả xếp lịch không đúng contract v1.0.0.', isSchedulingResult)
}
