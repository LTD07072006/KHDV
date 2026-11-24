import { isRecord } from '@/services/scheduleV2'
import type { ScheduleDraft } from '@/services/scheduleV2Form'

const STORAGE_KEY = 'khdv:schedule-v2-draft:v1'

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string')
}

export function isValidDraft(value: unknown): value is ScheduleDraft {
  if (!isRecord(value)) return false
  if (value.mode !== 'planned_calls' && value.mode !== 'history') return false
  if (typeof value.week !== 'string' || typeof value.fallback !== 'boolean' || typeof value.solve !== 'string') return false
  if (!isRecord(value.window) || typeof value.window.start_date !== 'string' || typeof value.window.end_date !== 'string') return false
  if (!Array.isArray(value.groups) || !Array.isArray(value.operating) || !Array.isArray(value.history) ||
      !Array.isArray(value.employees) || !Array.isArray(value.shifts)) return false
  if (!isStringRecord(value.planned)) return false
  return true
}

export function loadSavedDraft(storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): ScheduleDraft | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isValidDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveDraft(
  draft: ScheduleDraft,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Ignore quota or privacy-mode storage errors cleanly.
  }
}

export function clearSavedDraft(
  storage: Pick<Storage, 'removeItem'> | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
): void {
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors cleanly.
  }
}

export function serializeDraftJson(draft: ScheduleDraft): Blob {
  return new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseDraftJson(text: string): ScheduleDraft {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Tệp cấu hình không phải định dạng JSON hợp lệ.')
  }
  if (!isValidDraft(parsed)) {
    throw new Error('Tệp JSON không đúng cấu trúc cấu hình xếp lịch tuần.')
  }
  return parsed
}
