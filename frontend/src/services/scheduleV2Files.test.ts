import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import plannedResult from '@/data/schedule-v2/pipeline-planned-calls-response.json'
import { exportScheduleCsv, fileMessages, importScheduleCalls } from './scheduleV2Files'
import type { ScheduleV2Response } from './scheduleV2'

const history = scheduleV2Samples.history
const planned = scheduleV2Samples.planned_calls
if (history.mode !== 'history' || planned.mode !== 'planned_calls') throw new Error('Invalid test samples')
const csv = new File(['date,hour,group_id,calls'], 'calls.csv')
const xlsx = new File([new Uint8Array([0x50, 0x4b])], 'calls.xlsx')
const exportFixture = {
  ...plannedResult,
  mode: 'planned_calls',
  schedule: { ...plannedResult.schedule, status: 'OPTIMAL', stage_two_status: 'OPTIMAL' },
} satisfies ScheduleV2Response

function returnsJson(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body, { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function csvResponse(bom = true) {
  return new Response(bom ? '\ufeffemployee_id,group_id\ne01,sales\n' : 'employee_id,group_id\ne01,sales\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lich-lam-viec.csv"',
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('calls import', () => {
  it.each([
    ['csv', csv, 'text/csv'],
    ['xlsx', xlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ] as const)('posts raw %s bytes and replaces only history rows', async (format, file, contentType) => {
    const rows = history.history.map((row) => ({ ...row, calls: row.hour === 8 ? 3 : 0 }))
    const fetchMock = returnsJson({ mode: 'history', rows })
    expect(await importScheduleCalls(file, format, history)).toEqual({ ...history, history: rows })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/calls/import?file_format=' + format + '&mode=history&group_id=sales', {
      method: 'POST', headers: { 'Content-Type': contentType }, body: file, signal: expect.any(AbortSignal),
    })
  })

  it.each([
    ['csv', csv],
    ['xlsx', xlsx],
  ] as const)('retains planned zero and fractional volume in %s', async (format, file) => {
    const rows = planned.planned_calls.map((row) => ({ ...row, calls_per_hour: row.hour === 8 ? 2.5 : 0 }))
    returnsJson({ mode: 'planned_calls', rows })
    expect(await importScheduleCalls(file, format, planned)).toEqual({ ...planned, planned_calls: rows })
  })

  it('encodes and repeats each group in the import query', async () => {
    const group = 'CSKH & bán hàng'
    const request = { ...planned, groups: ['sales', group] }
    const rows = planned.planned_calls.flatMap((row) => [row, { ...row, group_id: group }])
    const fetchMock = returnsJson({ mode: 'planned_calls', rows })
    await importScheduleCalls(csv, 'csv', request)
    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost')
    expect(url.searchParams.getAll('group_id')).toEqual(['sales', group])
  })

  it.each([
    ['missing row', planned.planned_calls.slice(0, 1), fileMessages.planned],
    ['duplicate row', [planned.planned_calls[0], planned.planned_calls[0]], fileMessages.planned],
    ['wrong group', [{ ...planned.planned_calls[0], group_id: 'support' }, planned.planned_calls[1]], fileMessages.planned],
    ['wrong hour', [{ ...planned.planned_calls[0], hour: 10 }, planned.planned_calls[1]], fileMessages.planned],
    ['wrong date', [{ ...planned.planned_calls[0], date: '2026-11-03' }, planned.planned_calls[1]], fileMessages.planned],
    ['blank calls', [{ ...planned.planned_calls[0], calls_per_hour: '' }, planned.planned_calls[1]], fileMessages.invalid],
  ])('rejects a planned file with %s', async (_, rows, message) => {
    returnsJson({ mode: 'planned_calls', rows })
    await expect(importScheduleCalls(csv, 'csv', planned)).rejects.toThrow(message)
  })

  it.each([
    ['too few observations', history.history.slice(0, 3), fileMessages.history],
    ['future date', [...history.history, { ...history.history[0], date: '2026-11-02' }], fileMessages.historyKeys],
    ['duplicate', [...history.history, history.history[0]], fileMessages.historyKeys],
    ['unmatched weekday', [...history.history, { ...history.history[0], date: '2026-10-20' }], fileMessages.historyKeys],
    ['unmatched group', [...history.history, { ...history.history[0], group_id: 'support' }], fileMessages.historyKeys],
    ['unmatched hour', [...history.history, { ...history.history[0], hour: 10 }], fileMessages.historyKeys],
  ])('rejects history with %s', async (_, rows, message) => {
    returnsJson({ mode: 'history', rows })
    await expect(importScheduleCalls(csv, 'csv', history)).rejects.toThrow(message)
  })

  it.each([
    [new File([], 'empty.csv'), fileMessages.empty],
    [new File(['test'], 'calls.txt'), fileMessages.format],
    [new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.csv'), fileMessages.size],
  ])('checks unsuitable files before requesting the API', async (file, message) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(importScheduleCalls(file, 'csv', planned)).rejects.toThrow(message)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [429, fileMessages.busy],
    [413, fileMessages.size],
    [415, fileMessages.format],
    [422, fileMessages.invalid],
    [500, fileMessages.import],
  ])('maps HTTP %s to a safe message', async (status, message) => {
    const fetchMock = returnsJson({ detail: 'private-server-detail' }, status)
    await expect(importScheduleCalls(csv, 'csv', planned)).rejects.toThrow(message)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('private network error')))
    await expect(importScheduleCalls(csv, 'csv', planned)).rejects.toThrow(fileMessages.network)
  })

  it.each(['headers', 'body'])('reports timeout while waiting for %s', async (phase) => {
    const controller = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    let markStalled!: () => void
    const stalled = new Promise<void>((resolve) => { markStalled = resolve })
    const wait = () => new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true })
      markStalled()
    })
    vi.stubGlobal('fetch', vi.fn(() => phase === 'headers' ? wait() : Promise.resolve({ ok: true, json: wait })))
    const pending = importScheduleCalls(csv, 'csv', planned)
    await stalled
    controller.abort()
    await expect(pending).rejects.toThrow(fileMessages.timeout)
  })
})

describe('schedule export', () => {
  it.each(['OPTIMAL', 'FEASIBLE'] as const)('sends the full %s response and keeps filename and BOM', async (status) => {
    const raw = { ...exportFixture, schedule: { ...exportFixture.schedule, status } }
    const fetchMock = vi.fn().mockResolvedValue(csvResponse())
    vi.stubGlobal('fetch', fetchMock)
    const { filename, blob } = await exportScheduleCsv(raw)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/schedule-v2/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(raw), signal: expect.any(AbortSignal),
    })
    expect(filename).toBe('lich-lam-viec.csv')
    expect([...new Uint8Array(await blob.slice(0, 3).arrayBuffer())]).toEqual([0xef, 0xbb, 0xbf])
  })

  it.each(['INFEASIBLE', 'UNKNOWN', 'MODEL_INVALID'] as const)('refuses to export %s before calling the API', async (status) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(exportScheduleCsv({ ...exportFixture, schedule: { ...exportFixture.schedule, status } }))
      .rejects.toThrow(fileMessages.noSchedule)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a CSV response without the required BOM', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(csvResponse(false)))
    await expect(exportScheduleCsv(exportFixture)).rejects.toThrow(fileMessages.export)
  })
})
