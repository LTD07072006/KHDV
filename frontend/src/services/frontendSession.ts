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

function isSession(value: unknown): value is FrontendSession {
  return isRecord(value) && value.version === SESSION_VERSION && typeof value.savedAt === 'string' && typeof value.date === 'string' && typeof value.fileName === 'string' && typeof value.isFixtureMode === 'boolean' && typeof value.serviceTarget === 'number' && typeof value.answerWithinSeconds === 'number' && isDemandList(value.demandList) && isEmployeeList(value.employeeInputs) && typeof value.hasResult === 'boolean' && typeof value.previewReady === 'boolean' && typeof value.previewStale === 'boolean' && (value.activeTab === 'demand' || value.activeTab === 'schedule') && (value.demandViewMode === 'both' || value.demandViewMode === 'chart' || value.demandViewMode === 'table') && (value.scheduleViewMode === 'table' || value.scheduleViewMode === 'gantt')
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
