import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import plannedResponse from '@/data/schedule-v2/pipeline-planned-calls-response.json'
import { draftFromRequest, emptyScheduleDraft } from './scheduleV2Form'
import { canExportScheduleResult, importCallsIntoScheduleDraft, markScheduleResultStale, prepareScheduleRequest } from './scheduleV2WorkspaceState'
import type { ScheduleV2Response } from './scheduleV2'

const result = { ...plannedResponse, mode: 'planned_calls' } as ScheduleV2Response

describe('schedule workspace state', () => {
  it('marks a prior response stale after an input edit and keeps it stale until rerun', () => {
    expect(markScheduleResultStale(true, false)).toBe(true)
    expect(markScheduleResultStale(false, true)).toBe(true)
    expect(markScheduleResultStale(false, false)).toBe(false)
  })

  it.each(['OPTIMAL', 'FEASIBLE'] as const)('allows export for a current %s response and blocks it after staleness', (status) => {
    const feasible = { ...result, schedule: { ...result.schedule, status } }
    expect(canExportScheduleResult(feasible, false, false)).toBe(true)
    expect(canExportScheduleResult(feasible, true, false)).toBe(false)
    expect(canExportScheduleResult(feasible, false, true)).toBe(false)
    expect(canExportScheduleResult(undefined, false, false)).toBe(false)
    for (const status of ['INFEASIBLE', 'UNKNOWN', 'MODEL_INVALID'] as const) {
      expect(canExportScheduleResult({ ...result, schedule: { ...result.schedule, status } }, false, false)).toBe(false)
    }
  })

  it('returns a form validation error instead of a request when required planned volume is blank', () => {
    const draft = draftFromRequest(scheduleV2Samples.planned_calls)
    delete draft.planned_calls[JSON.stringify(['2026-11-02', 9, 'sales'])]
    expect(prepareScheduleRequest(draft)).toEqual({ request: undefined, error: 'Nhập cuộc gọi 2026-11-02 9:00 / sales.' })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('workspace calls import', () => {
  it.each([
    { mode: 'planned_calls', format: 'csv' }, { mode: 'planned_calls', format: 'xlsx' },
    { mode: 'history', format: 'csv' }, { mode: 'history', format: 'xlsx' },
  ] as const)('imports $mode rows from $format into the editable form through the API importer', async ({ mode, format }) => {
    const file = format === 'csv' ? new File(['date,hour,group_id,calls'], 'calls.csv') : new File([new Uint8Array([0x50, 0x4b])], 'calls.xlsx')
    const row = mode === 'history'
      ? { date: '2026-10-19', hour: 8, group_id: 'sales', calls: 3 }
      : { date: '2026-11-02', hour: 8, group_id: 'sales', calls_per_hour: 2.5 }
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ mode, rows: [row] }))
    vi.stubGlobal('fetch', fetchMock)
    const draft = emptyScheduleDraft(mode, '2026-11-02')
    draft.groups_text = 'sales'

    const imported = await importCallsIntoScheduleDraft(file, format, draft, mode)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/calls/import?file_format=${format}&mode=${mode}&group_id=sales`)
    expect(imported.mode).toBe(mode)
    if (mode === 'history') {
      expect(imported.history).toEqual([{ id: 'import-1', date: '2026-10-19', hour: '8', group_id: 'sales', calls: '3' }])
    } else {
      expect(imported.planned_calls[JSON.stringify(['2026-11-02', 8, 'sales'])]).toBe('2.5')
    }
    expect(imported.employees).toEqual([])
  })
})
