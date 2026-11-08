import { describe, expect, it } from 'vitest'
import type { Employee } from '@/types/scheduling'
import { clearFrontendSession, FRONTEND_SESSION_KEY, loadFrontendSession, saveFrontendSession } from './frontendSession'
import { createMockSchedule } from './mockSchedule'

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

  it('rejects a saved preview with incomplete metrics', () => {
    const store = storage()
    const rawResult = createMockSchedule(session.date, session.demandList, employees)
    const saved = saveFrontendSession({ ...session, hasResult: true, rawResult }, store)
    store.setItem(FRONTEND_SESSION_KEY, JSON.stringify({ ...saved, rawResult: { ...rawResult, metrics: {} } }))
    expect(loadFrontendSession(store)).toBeNull()
  })

  it('rejects malformed diagnostic entries before telemetry renders', () => {
    const store = storage()
    const result = createMockSchedule(session.date, session.demandList, employees)
    const saved = saveFrontendSession({ ...session, hasResult: true, rawResult: result }, store)
    store.setItem(FRONTEND_SESSION_KEY, JSON.stringify({
      ...saved, rawResult: { ...result, diagnostics: [null] },
    }))
    expect(loadFrontendSession(store)).toBeNull()
  })

  it.each([{ shift: 42 }, { breakTime: { start: '12:00' } }, { allowedShifts: ['invalid'] }])(
    'rejects saved employee data the workspace cannot display: %j',
    (patch) => {
      const store = storage()
      const saved = saveFrontendSession(session, store)
      store.setItem(FRONTEND_SESSION_KEY, JSON.stringify({
        ...saved,
        employeeInputs: [{ ...employees[0], ...patch }],
      }))
      expect(loadFrontendSession(store)).toBeNull()
    },
  )

  it('loads older employee records without display metadata', () => {
    const store = storage()
    const saved = saveFrontendSession(session, store)
    const employee = { id: 'NV001', name: 'Nguyễn Văn A', working: true, allowedShifts: ['ca_ngay'] }
    store.setItem(FRONTEND_SESSION_KEY, JSON.stringify({ ...saved, employeeInputs: [employee] }))
    expect(loadFrontendSession(store)?.employeeInputs).toEqual([employee])
  })

  it('keeps input data but clears preview state when a saved result is missing', () => {
    const store = storage()
    saveFrontendSession({ ...session, hasResult: true }, store)
    const restored = loadFrontendSession(store)
    expect(restored?.hasResult).toBe(false)
    expect(restored?.rawResult).toBeNull()
    expect(restored?.demandList).toEqual(session.demandList)
    expect(restored?.employeeInputs).toEqual(employees)
  })

  it('restores overnight timestamps from old previews without changing the result identity', () => {
    const store = storage()
    const rawResult = createMockSchedule(session.date, session.demandList, [{ ...employees[0], allowedShifts: ['ca_dem'] }])
    rawResult.assignments[0].end = '2026-11-02T08:00:00+07:00'
    rawResult.assignments[0].breaks = [{ start: '2026-11-02T00:00:00+07:00', end: '2026-11-02T01:00:00+07:00' }]
    saveFrontendSession({ ...session, hasResult: true, rawResult, sourceDemand: session.demandList }, store)
    const restored = loadFrontendSession(store)
    expect(restored?.sourceDemand).toEqual(session.demandList)
    expect(restored?.rawResult?.request_id).toBe(rawResult.request_id)
    expect(restored?.rawResult?.assignments[0].end).toBe('2026-11-03T08:00:00+07:00')
    expect(restored?.rawResult?.assignments[0].breaks[0].start).toBe('2026-11-03T00:00:00+07:00')
  })

  it('clears a saved session', () => {
    const store = storage()
    saveFrontendSession(session, store)
    clearFrontendSession(store)
    expect(loadFrontendSession(store)).toBeNull()
  })
})
