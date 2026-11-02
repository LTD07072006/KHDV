import type { DemandRow, Employee, SchedulingResult } from '@/types/scheduling'

export const FRONTEND_SESSION_KEY = 'khdv.frontend.session.v1'
const SESSION_VERSION = 1

export type FrontendSession = {
  version: 1
  savedAt: string
  date: string
  fileName: string
  isFixtureMode: boolean
  serviceTarget: number
  answerWithinSeconds: number
  demandList: DemandRow[]
  employeeInputs: Employee[]
  hasResult: boolean
  rawResult: SchedulingResult | null
  previewReady: boolean
  previewStale: boolean
  activeTab: 'demand' | 'schedule'
  demandViewMode: 'both' | 'chart' | 'table'
  scheduleViewMode: 'table' | 'gantt'
  demandFilter?: 'all' | 'covered' | 'shortage' | 'break'
  inputWarnings?: string[]
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDemandList(value: unknown): value is DemandRow[] {
  return Array.isArray(value) && value.every((row) => isRecord(row) && typeof row.time === 'string' && typeof row.calls === 'number' && typeof row.aht === 'number' && typeof row.required === 'number')
}

function isEmployeeList(value: unknown): value is Employee[] {
  return Array.isArray(value) && value.every((employee) => isRecord(employee) && typeof employee.id === 'string' && typeof employee.name === 'string' && typeof employee.working === 'boolean' && Array.isArray(employee.allowedShifts))
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRawResult(value: unknown): value is SchedulingResult | null {
  if (value === null) return true
  if (!isRecord(value) || value.contract_version !== '1.0.0' || typeof value.request_id !== 'string' || typeof value.timezone !== 'string' || !['SUCCESS', 'DEGRADED', 'INVALID_INPUT', 'ERROR'].includes(String(value.status)) || !['OPTIMAL', 'FEASIBLE', 'UNKNOWN', 'INFEASIBLE', 'MODEL_INVALID', 'NOT_RUN'].includes(String(value.solver_status)) || !['SOLVER', 'BASELINE', 'NONE'].includes(String(value.solution_source)) || typeof value.has_solution !== 'boolean' || typeof value.optimality_proven !== 'boolean' || !Array.isArray(value.assignments) || !Array.isArray(value.coverage) || !Array.isArray(value.diagnostics) || !Array.isArray(value.carry_out)) return false
  if (value.metrics !== null && !isRecord(value.metrics)) return false
  return value.assignments.every((assignment) => isRecord(assignment) && typeof assignment.employee_id === 'string' && typeof assignment.template_id === 'string' && typeof assignment.skill_id === 'string' && typeof assignment.start === 'string' && typeof assignment.end === 'string' && Array.isArray(assignment.breaks)) && value.coverage.every((item) => isRecord(item) && typeof item.slot_id === 'string' && typeof item.skill_id === 'string' && typeof item.required_agents === 'number' && typeof item.scheduled_agents === 'number' && typeof item.shortage_agents === 'number' && typeof item.overstaff_agents === 'number')
}

function isSession(value: unknown): value is FrontendSession {
  return isRecord(value) && value.version === SESSION_VERSION && typeof value.savedAt === 'string' && typeof value.date === 'string' && typeof value.fileName === 'string' && typeof value.isFixtureMode === 'boolean' && typeof value.serviceTarget === 'number' && typeof value.answerWithinSeconds === 'number' && isDemandList(value.demandList) && isEmployeeList(value.employeeInputs) && typeof value.hasResult === 'boolean' && isRawResult(value.rawResult) && typeof value.previewReady === 'boolean' && typeof value.previewStale === 'boolean' && (value.activeTab === 'demand' || value.activeTab === 'schedule') && (value.demandViewMode === 'both' || value.demandViewMode === 'chart' || value.demandViewMode === 'table') && (value.scheduleViewMode === 'table' || value.scheduleViewMode === 'gantt') && (value.demandFilter === undefined || value.demandFilter === 'all' || value.demandFilter === 'covered' || value.demandFilter === 'shortage' || value.demandFilter === 'break') && (value.inputWarnings === undefined || isStringList(value.inputWarnings))
}

export function loadFrontendSession(storage: Storage | null = getStorage()): FrontendSession | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(FRONTEND_SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveFrontendSession(session: Omit<FrontendSession, 'version' | 'savedAt'>, storage: Storage | null = getStorage()): FrontendSession | null {
  if (!storage) return null
  const persisted: FrontendSession = { ...session, version: SESSION_VERSION, savedAt: new Date().toISOString() }
  try {
    storage.setItem(FRONTEND_SESSION_KEY, JSON.stringify(persisted))
    return persisted
  } catch {
    return null
  }
}

export function clearFrontendSession(storage: Storage | null = getStorage()): void {
  try {
    storage?.removeItem(FRONTEND_SESSION_KEY)
  } catch {
    // Storage can be unavailable or quota restricted. The UI can continue locally.
  }
}
