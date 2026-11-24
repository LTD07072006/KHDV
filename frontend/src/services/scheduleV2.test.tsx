import { afterEach, describe, expect, it, vi } from 'vitest'
import sample from '@/data/schedule-v2/pipeline-planned-calls-response.json'
import historySample from '@/data/schedule-v2/pipeline-history-response.json'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import { apiMessages, isScheduleResponse, requestScheduleV2 } from './scheduleV2'

const request = scheduleV2Samples.planned_calls
afterEach(() => vi.restoreAllMocks())

describe('schedule API', () => {
  it('validates the published planned and historic responses', () => {
    expect(isScheduleResponse(sample, request)).toBe(true)
    expect(isScheduleResponse(historySample, scheduleV2Samples.history)).toBe(true)
  })

  it.each(['INFEASIBLE', 'UNKNOWN', 'MODEL_INVALID'])('accepts %s with null coverage and costs only', (status) => {
    const result = {
      ...sample, interval_results: sample.interval_results.map((row) => ({ ...row, assigned_staff: null })),
      schedule: { status, assignments: [], skill_mismatch_slots: null, total_shift_minutes: null, overstaff_slots: null,
        stage_two_status: null, warnings: [], message: 'Không có lịch' },
    }
    expect(isScheduleResponse(result, request)).toBe(true)
    result.schedule = { ...result.schedule, assignments: sample.schedule.assignments as never[] }
    expect(isScheduleResponse(result, request)).toBe(false)
  })

  it('accepts FEASIBLE, rejects unknown status and old shape', () => {
    const result = { ...sample, schedule: { ...sample.schedule, status: 'FEASIBLE', stage_two_status: 'UNKNOWN' } }
    expect(isScheduleResponse(result, request)).toBe(true)
    expect(isScheduleResponse({ ...result, schedule: { ...result.schedule, status: 'ok' } }, request)).toBe(false)
    expect(isScheduleResponse({ ...result, hourly_results: [] }, request)).toBe(false)
  })

  it('rejects incorrect coverage, elapsed cost, or a claimed assignment during a break', () => {
    const result = structuredClone(sample)
    result.schedule.total_shift_minutes = 30
    expect(isScheduleResponse(result, request)).toBe(false)
    result.schedule.total_shift_minutes = 60
    result.interval_results[0].assigned_staff = 2
    expect(isScheduleResponse(result, request)).toBe(false)
    result.interval_results[0].assigned_staff = 1
    const breaks = [{ start: '08:30', end: '09:00' }]
    const changedRequest = { ...request, shifts: request.shifts.map((shift) => ({ ...shift, breaks })) }
    const changedResult = { ...result, schedule: { ...result.schedule, assignments: result.schedule.assignments.map((shift) => ({ ...shift, breaks })) } }
    expect(isScheduleResponse(changedResult, changedRequest)).toBe(false)
  })

  it.each([[422, apiMessages.invalidSchedule], [413, apiMessages.tooLarge], [500, apiMessages.server]])('sanitizes HTTP %s', async (status, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('internal sentinel', { status }))
    await expect(requestScheduleV2(request)).rejects.toThrow(message)
  })

  it('reports network error separately from timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('internal sentinel'))
    await expect(requestScheduleV2(request)).rejects.toThrow(apiMessages.network)
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort())
    await expect(requestScheduleV2(request)).rejects.toThrow(apiMessages.timeout)
  })

  it('accepts understaffed response only when allow_understaffing is enabled', () => {
    const softRequest = { ...request, allow_understaffing: true }
    const understaffed = {
      ...sample,
      interval_results: sample.interval_results.map((row) => ({ ...row, assigned_staff: 0 })),
      schedule: {
        ...sample.schedule,
        assignments: [],
        total_shift_minutes: 0,
        overstaff_slots: 0,
        understaff_slots: 2,
        warnings: ['Thiếu nhân sự: 2 person-slots chưa đạt nhu cầu Erlang C.'],
      },
    }
    expect(isScheduleResponse(understaffed, request)).toBe(false)
    expect(isScheduleResponse(understaffed, softRequest)).toBe(true)
  })

  it('maps backend assignment-variable limit 422 to modelTooLarge message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'The schedule exceeds the prototype assignment-variable limit.' }), { status: 422 }),
    )
    await expect(requestScheduleV2(request)).rejects.toThrow(apiMessages.modelTooLarge)
  })
})
