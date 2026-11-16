import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScheduleV2Result, ScheduleV2Workspace } from '@/components/ScheduleV2Workspace'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import history from '@/data/schedule-v2/pipeline-history-response.json'
import planned from '@/data/schedule-v2/pipeline-planned-calls-response.json'
import { scheduleV2Coverage } from '@/lib/scheduleV2Coverage'
import { requestScheduleV2, scheduleV2Messages } from './scheduleV2'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mockResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body, { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('schedule-v2 prototype', () => {
  it('renders the editable configuration form without preloading a locked sample', () => {
    const markup = renderToStaticMarkup(<ScheduleV2Workspace onOpenDemo={() => undefined} />)
    expect(markup).toContain('Nguồn nhu cầu')
    expect(markup).toContain('Mã nhóm — mỗi nhóm một dòng')
    expect(markup).toContain('Giờ hoạt động theo ngày')
    expect(markup).toContain('Nhân viên và giờ rảnh')
    expect(markup).toContain('Nạp dữ liệu mẫu (tùy chọn)')
    expect(markup).not.toContain('e01')
    expect(markup).not.toContain('· 08:00 · sales')
  })

  it('rejects a response that assigns the same person to two groups in one slot', async () => {
    const shift = history.schedule.assignments[0]
    mockResponse({
      ...history,
      schedule: {
        ...history.schedule,
        assignments: [shift, { ...shift, groups_by_slot: [{ ...shift.groups_by_slot[0], group_id: 'fallback' }] }],
      },
    })
    await expect(requestScheduleV2(scheduleV2Samples.history)).rejects.toThrow(scheduleV2Messages.response)
  })

  it.each([
    { mode: 'history', fixture: history, forecastVisible: true },
    { mode: 'planned_calls', fixture: planned, forecastVisible: false },
  ] as const)('posts the committed $mode sample and renders the API result', async ({ mode, fixture, forecastVisible }) => {
    const fetchMock = mockResponse(fixture)
    const result = await requestScheduleV2(scheduleV2Samples[mode])

    expect(fetchMock).toHaveBeenCalledWith('/api/schedule-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleV2Samples[mode]),
      signal: expect.any(AbortSignal),
    })
    const markup = renderToStaticMarkup(<ScheduleV2Result result={result} />)
    expect(markup.includes('Dự báo từ lịch sử')).toBe(forecastVisible)
    expect(markup).toContain('Nhu cầu và Erlang C theo giờ')
    expect(markup).toContain('Lịch phân công theo ca 90 phút')
    expect(markup).toContain('09:00 · sales')
    expect(markup).toContain('Giai đoạn 2')
    expect(markup).toContain(fixture.schedule.message)
    expect(markup).toContain(fixture.schedule.warnings[0])
    expect(markup).toContain('<td>—</td>')
    expect(markup).not.toContain('<td>0%</td>')
  })

  it('joins coverage by date, time and group when requirements and assignment slots are ordered differently', async () => {
    const first = history.schedule.assignments[0]
    mockResponse({
      ...history,
      requirements: [
        { date: first.date, start: '09:30', group_id: 'sales', required_staff: 0 },
        { date: first.date, start: '08:00', group_id: 'support', required_staff: 2 },
        { date: '2026-11-03', start: '08:00', group_id: 'sales', required_staff: 3 },
        { date: first.date, start: '08:00', group_id: 'sales', required_staff: 1 },
        { date: first.date, start: '08:30', group_id: 'sales', required_staff: 1 },
      ],
      schedule: {
        ...history.schedule,
        assignments: [{ ...first, groups_by_slot: [...first.groups_by_slot].reverse() }],
      },
    })
    const result = await requestScheduleV2(scheduleV2Samples.history)
    expect(scheduleV2Coverage(result).map(({ assigned }) => assigned)).toEqual([0, 0, 0, 1, 1])
    const markup = renderToStaticMarkup(<ScheduleV2Result result={result} />)
    expect(markup).toContain('<td>02/11/2026</td><td>08:00</td><td>support</td><td>2</td><td>0</td>')
    expect(markup).toContain('<td>03/11/2026</td><td>08:00</td><td>sales</td><td>3</td><td>0</td>')
    expect(markup).toContain('<td>02/11/2026</td><td>08:00</td><td>sales</td><td>1</td><td>1</td>')
  })

  it('shows a feasible schedule without claiming optimality or inventing a phase status', async () => {
    mockResponse({ ...planned, schedule: { ...planned.schedule, status: 'FEASIBLE', stage_two_status: undefined, message: '' } })
    const result = await requestScheduleV2(scheduleV2Samples.planned_calls)
    const markup = renderToStaticMarkup(<ScheduleV2Result result={result} />)
    expect(markup).toContain('Có lịch khả thi, chưa chứng minh tối ưu')
    expect(markup).toContain('Lịch phân công theo ca 90 phút')
    expect(markup).not.toContain('Giai đoạn 2')
  })

  it.each(['INFEASIBLE', 'UNKNOWN', 'MODEL_INVALID'])('shows %s without displaying assignments as a solution', async (status) => {
    mockResponse({
      ...planned,
      schedule: { ...planned.schedule, status, assignments: [], message: 'Solver message', stage_two_status: null },
    })
    const result = await requestScheduleV2(scheduleV2Samples.planned_calls)
    const markup = renderToStaticMarkup(<ScheduleV2Result result={result} />)
    expect(markup).toContain(status)
    expect(markup).toContain('Solver message')
    expect(markup).toContain('Độ phủ theo khung 30 phút')
    expect(markup).not.toContain('Lịch phân công theo ca 90 phút')
    expect(markup).not.toContain('Giai đoạn 2')
    expect(scheduleV2Coverage(result).every(({ assigned }) => assigned === null)).toBe(true)
  })

  it.each([
    [422, { detail: [{ loc: ['body', 'history'], msg: 'private-value' }] }, scheduleV2Messages.validation],
    [422, { detail: 'private-domain-detail' }, scheduleV2Messages.validation],
    [500, { detail: 'private-server-detail' }, scheduleV2Messages.server],
    [200, { ...history, hourly_results: [{ ...history.hourly_results[0], erlang: null }] }, scheduleV2Messages.response],
    [200, planned, scheduleV2Messages.response],
  ] as const)('maps HTTP %s or malformed results to safe messages', async (status, body, message) => {
    mockResponse(body, status)
    await expect(requestScheduleV2(scheduleV2Samples.history)).rejects.toThrow(message)
  })

  it('maps network failures to a generic message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private-network-detail')))
    await expect(requestScheduleV2(scheduleV2Samples.history)).rejects.toThrow(scheduleV2Messages.network)
  })

  it.each(['headers', 'body'])('reports timeout when the server stalls before sending the %s', async (phase) => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    let markStalled!: () => void
    const stalled = new Promise<void>((resolve) => { markStalled = resolve })
    const waitForAbort = (signal: AbortSignal) => new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      markStalled()
    })
    vi.stubGlobal('fetch', vi.fn((_: string, options: RequestInit) => {
      const signal = options.signal!
      return phase === 'headers'
        ? waitForAbort(signal)
        : Promise.resolve({ ok: true, status: 200, json: () => waitForAbort(signal) })
    }))

    const request = requestScheduleV2(scheduleV2Samples.history)
    await stalled
    controller.abort(new DOMException('Network detail', 'TimeoutError'))
    await expect(request).rejects.toThrow(scheduleV2Messages.timeout)
    expect(timeout).toHaveBeenCalledWith(45_000)
  })
})
