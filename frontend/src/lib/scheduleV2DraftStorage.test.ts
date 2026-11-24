import { describe, expect, it } from 'vitest'
import { emptyDraft } from '@/services/scheduleV2Form'
import { clearSavedDraft, isValidDraft, loadSavedDraft, parseDraftJson, saveDraft } from './scheduleV2DraftStorage'

function memoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  }
}

describe('scheduleV2DraftStorage', () => {
  it('saves, restores, and clears a valid schedule draft', () => {
    const storage = memoryStorage()
    const draft = emptyDraft()
    draft.week = '2026-11-02'

    saveDraft(draft, storage)
    expect(loadSavedDraft(storage)).toEqual(draft)

    clearSavedDraft(storage)
    expect(loadSavedDraft(storage)).toBeNull()
  })

  it('returns null safely when stored JSON is corrupted or invalid', () => {
    const storage = memoryStorage()
    storage.setItem('khdv:schedule-v2-draft:v1', '{not json')
    expect(loadSavedDraft(storage)).toBeNull()

    storage.setItem('khdv:schedule-v2-draft:v1', JSON.stringify({ mode: 'invalid' }))
    expect(loadSavedDraft(storage)).toBeNull()
    expect(isValidDraft({ mode: 'planned_calls' })).toBe(false)
  })

  it('parses valid config JSON and rejects malformed or incompatible files', () => {
    const draft = emptyDraft()
    expect(parseDraftJson(JSON.stringify(draft))).toEqual(draft)
    expect(() => parseDraftJson('{broken')).toThrow('không phải định dạng JSON hợp lệ')
    expect(() => parseDraftJson(JSON.stringify({ hello: 'world' }))).toThrow('không đúng cấu trúc cấu hình')
  })
})
