import { afterEach, expect, it, vi } from 'vitest'
import sample from '@/data/schedule-v2/pipeline-planned-calls-response.json'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import { apiMessages, isScheduleResponse } from './scheduleV2'
import { exportScheduleCsv, importCalls } from './scheduleV2Files'

afterEach(() => vi.restoreAllMocks())

it.each(['csv', 'xlsx'] as const)('posts raw %s bytes for both modes', async (format) => {
  const file = new File(['stub'], `calls.${format}`)
  const fetch = vi.spyOn(globalThis, 'fetch')
  for (const mode of ['planned_calls', 'history'] as const) {
    const rows = [{ date: '2026-11-02', start: '23:30', group_id: 'sales', calls: 0 }]
    fetch.mockResolvedValueOnce(Response.json({ mode, rows }))
    await expect(importCalls(file, format, mode, ['sales'])).resolves.toEqual({ mode, rows })
    expect(fetch).toHaveBeenLastCalledWith(`/api/calls/import?file_format=${format}&mode=${mode}&group_id=sales`,
      expect.objectContaining({ body: file, method: 'POST' }))
  }
})

it('lets the server determine the upload ceiling and sanitizes file errors', async () => {
  const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'calls.csv')
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('internal sentinel', { status: 413 }))
  await expect(importCalls(file, 'csv', 'planned_calls', ['sales'])).rejects.toThrow(apiMessages.tooLarge)
  expect(fetch).toHaveBeenCalledOnce()
  fetch.mockResolvedValueOnce(new Response('internal sentinel', { status: 422 }))
  await expect(importCalls(file, 'csv', 'planned_calls', ['sales'])).rejects.toThrow(apiMessages.invalidFile)
})

it('rejects generic rows from the hourly contract and rejects extra provenance', async () => {
  const file = new File(['stub'], 'calls.csv')
  const fetch = vi.spyOn(globalThis, 'fetch')
  fetch.mockResolvedValueOnce(Response.json({ mode: 'history', rows: [{ date: '2026-09-01', hour: 8, group_id: 'sales', calls: 0 }] }))
  await expect(importCalls(file, 'csv', 'history', ['sales'])).rejects.toThrow(apiMessages.response)
  fetch.mockResolvedValueOnce(Response.json({ mode: 'history', rows: [], source: {} }))
  await expect(importCalls(file, 'csv', 'history', ['sales'])).rejects.toThrow(apiMessages.response)
})

it('posts exactly the displayed response and preserves the API CSV bytes', async () => {
  if (!isScheduleResponse(sample, scheduleV2Samples.planned_calls)) throw new Error('invalid fixture')
  const csv = new TextEncoder().encode("\uFEFFMã nhân viên\r\n'e01\r\n")
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="schedule-v2.csv"',
  } }))
  const result = await exportScheduleCsv(sample)
  expect(result.filename).toBe('schedule-v2.csv')
  expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(csv)
  expect(fetch).toHaveBeenCalledWith('/api/schedule-v2/export', expect.objectContaining({ body: JSON.stringify(sample) }))
  await expect(exportScheduleCsv({ ...sample, schedule: { ...sample.schedule, status: 'INFEASIBLE' } })).rejects.toThrow(apiMessages.invalidExport)
  expect(fetch).toHaveBeenCalledOnce()
})
