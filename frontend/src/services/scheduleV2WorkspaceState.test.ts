import { describe, expect, it } from 'vitest'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import plannedResponse from '@/data/schedule-v2/pipeline-planned-calls-response.json'
import { draftFromRequest } from './scheduleV2Form'
import { canExportScheduleResult, markScheduleResultStale, prepareScheduleRequest } from './scheduleV2WorkspaceState'
import type { ScheduleV2Response } from './scheduleV2'

const result = { ...plannedResponse, mode: 'planned_calls' } as ScheduleV2Response

describe('schedule workspace state', () => {
  it('marks a prior response stale after an input edit and keeps it stale until rerun', () => {
    expect(markScheduleResultStale(true, false)).toBe(true)
    expect(markScheduleResultStale(false, true)).toBe(true)
    expect(markScheduleResultStale(false, false)).toBe(false)
  })

  it('allows export only for a current, feasible response while idle', () => {
    expect(canExportScheduleResult(result, false, false)).toBe(true)
    expect(canExportScheduleResult(result, true, false)).toBe(false)
    expect(canExportScheduleResult(result, false, true)).toBe(false)
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
