/** API client connecting React frontend with FastAPI backend (Erlang C + OR-Tools CP-SAT). */

export type PreviewResponse = {
  filename: string
  summary: {
    total_slots: number
    total_calls: number
    max_required: number
    total_employees: number
    working_employees: number
  }
  demand: Array<{
    slot_id: string
    time: string
    time_start: string
    time_end: string
    calls: number
    aht: number
    required: number
    required_agents: number
  }>
  employees: Array<{
    id: string
    employee_id: string
    name: string
    working: boolean
    allowedShifts: Array<'ca_ngay' | 'ca_dem'>
    allowed_shifts: Array<'ca_ngay' | 'ca_dem'>
    shift: string
    breakTime: string
    status: string
  }>
  warnings: string[]
}

export type CreateSchedulePayload = {
  planning_date: string
  slots: Array<{
    slot_id: string
    time_start: string
    time_end: string
    calls: number
    aht: number
    required_agents: number
  }>
  employees: Array<{
    employee_id: string
    name: string
    working: boolean
    allowed_shifts: string[]
  }>
}

export type ScheduleResult = {
  status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN'
  has_solution: boolean
  solution_source: string
  planning_date: string
  assignments: Array<{
    employee_id: string
    employee_name: string
    template_id: string
    shift: string
    shift_start: string
    shift_end: string
    break_start: string
    break_end: string
    date: string
  }>
  coverage: Array<{
    slot_id: string
    time_start: string
    time_end: string
    required_agents: number
    scheduled_agents: number
    shortage_agents: number
    overstaff_agents: number
  }>
  metrics: {
    objective_value: number
    total_shortage: number
    total_overstaff: number
    assigned_shifts: number
  }
  diagnostics: string[]
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/health')
    return res.ok
  } catch {
    return false
  }
}

export async function previewWorkbook(file: File): Promise<PreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/preview-workbook', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Không thể đọc file workbook' }))
    throw new Error(errorData.detail || 'Lỗi đọc file Excel từ máy chủ.')
  }

  return res.json()
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<ScheduleResult> {
  const res = await fetch('/api/create-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Không thể tạo lịch' }))
    throw new Error(errorData.detail || 'Lỗi khi gọi solver CP-SAT trên backend.')
  }

  return res.json()
}
