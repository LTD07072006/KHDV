import { describe, expect, it } from 'vitest'
import type { Employee } from '@/types/scheduling'
import { clearFrontendSession, FRONTEND_SESSION_KEY, loadFrontendSession, saveFrontendSession } from './frontendSession'

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage
}

const employees: Employee[] = [{ id: 'NV001', name: 'Nguyễn Văn A', shift: '', breakTime: '', status: 'Có thể nhận ca', working: true, allowedShifts: ['ca_ngay'] }]

const session = {
  date: '2026-11-02',
  fileName: 'mau_xep_lich.xlsx',
  isFixtureMode: true,
  serviceTarget: 0.8,
  answerWithinSeconds: 20,
  demandList: [{ time: '08:00–08:30', calls: 10, aht: 6, required: 2 }],
  employeeInputs: employees,
  hasResult: false,
  rawResult: null,
  previewReady: true,
  previewStale: false,
  activeTab: 'demand' as const,
  demandViewMode: 'both' as const,
  scheduleViewMode: 'table' as const,
  demandFilter: 'all' as const,
  inputWarnings: [],
}

describe('frontend session storage', () => {
  it('round-trips the frontend session without a workbook binary', () => {
    const store = storage()
    const saved = saveFrontendSession(session, store)
    expect(saved?.version).toBe(1)
    expect(loadFrontendSession(store)?.employeeInputs).toEqual(employees)
    expect(store.getItem(FRONTEND_SESSION_KEY)).not.toContain('arrayBuffer')
  })

  it('ignores malformed or incompatible sessions', () => {
    const store = storage()
    store.setItem(FRONTEND_SESSION_KEY, JSON.stringify({ version: 99, demandList: [] }))
    expect(loadFrontendSession(store)).toBeNull()
  })

  it('ignores sessions with malformed warning data', () => {
    const store = storage()
    store.setItem(FRONTEND_SESSION_KEY, JSON.stringify({ ...session, version: 1, inputWarnings: { message: 'bad' } }))
    expect(loadFrontendSession(store)).toBeNull()
  })

  it('ignores sessions with a malformed saved result', () => {
    const store = storage()
    store.setItem(FRONTEND_SESSION_KEY, JSON.stringify({ ...session, version: 1, rawResult: { coverage: 'bad' } }))
    expect(loadFrontendSession(store)).toBeNull()
  })

  it('clears a saved session', () => {
    const store = storage()
    saveFrontendSession(session, store)
    clearFrontendSession(store)
    expect(loadFrontendSession(store)).toBeNull()
  })
})
