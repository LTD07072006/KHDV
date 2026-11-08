import { decodeFrontendSession, getFrontendStorage, type FrontendSession } from './frontendSession'

export const SAVED_SCHEDULE_PREFIX = 'khdv.schedule.v1:'
export type SavedScheduleKind = 'draft' | 'final'
export type SavedSchedule = { kind: SavedScheduleKind; session: FrontendSession }

function scheduleKey(date: string, kind: SavedScheduleKind) {
  return `${SAVED_SCHEDULE_PREFIX}${date}:${kind}`
}

function readSchedule(storage: Storage, key: string): FrontendSession | null {
  try {
    const session: unknown = JSON.parse(storage.getItem(key) ?? 'null')
    return decodeFrontendSession(session)
  } catch {
    return null
  }
}

export function loadSavedSchedules(storage = getFrontendStorage()): SavedSchedule[] {
  if (!storage) return []
  const schedules: SavedSchedule[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (!key?.startsWith(SAVED_SCHEDULE_PREFIX)) continue
    const kind = key.endsWith(':final') ? 'final' : 'draft'
    const session = readSchedule(storage, key)
    if (session && key === scheduleKey(session.date, kind)) schedules.push({ kind, session })
  }
  return schedules.sort((a, b) => b.session.date.localeCompare(a.session.date) || a.kind.localeCompare(b.kind))
}

export function saveSchedule(
  session: Omit<FrontendSession, 'version' | 'savedAt'>,
  kind: SavedScheduleKind,
  expectedFinalSavedAt?: string,
  storage = getFrontendStorage(),
): 'saved' | 'conflict' | 'unavailable' {
  if (!storage || !session.date || session.workbookInvalid ||
    (kind === 'final' && (!session.hasResult || !session.rawResult?.has_solution))) return 'unavailable'
  try {
    const key = scheduleKey(session.date, kind)
    if (kind === 'final' && readSchedule(storage, key)?.savedAt !== expectedFinalSavedAt) return 'conflict'
    const record: FrontendSession = { ...session, version: 1, savedAt: new Date().toISOString() }
    storage.setItem(key, JSON.stringify(record))
    return 'saved'
  } catch {
    return 'unavailable'
  }
}
