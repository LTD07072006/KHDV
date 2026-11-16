import { describe, expect, it } from 'vitest'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import { buildScheduleV2Request, callKey, draftFromRequest, emptyScheduleDraft, operatingHoursFor, operatingSlotsFor, validShiftStarts, weekDates } from './scheduleV2Form'

describe('dynamic schedule form mapping', () => {
  it('maps editable planned volume into the strict API request and converts percent SLA', () => {
    const draft = draftFromRequest(scheduleV2Samples.planned_calls)
    draft.groups_text = 'sales\nsupport'
    draft.planned_calls[callKey('2026-11-02', 8, 'support')] = '2.75'
    draft.planned_calls[callKey('2026-11-02', 9, 'support')] = '0'
    draft.employees = []
    draft.target_sla_percent = '82.5'

    const request = buildScheduleV2Request(draft)
    expect(request).toMatchObject({ mode: 'planned_calls', target_sla: 0.825, groups: ['sales', 'support'] })
    expect(request).toHaveProperty('planned_calls', expect.arrayContaining([
      { date: '2026-11-02', hour: 8, group_id: 'support', calls_per_hour: 2.75 },
      { date: '2026-11-02', hour: 9, group_id: 'support', calls_per_hour: 0 },
    ]))
    expect(request).not.toHaveProperty('history')
  })

  it('requires explicit planned zeros and preserves entered rows after grid changes', () => {
    const draft = draftFromRequest(scheduleV2Samples.planned_calls)
    delete draft.planned_calls[callKey('2026-11-02', 9, 'sales')]
    expect(() => buildScheduleV2Request(draft)).toThrow(/cuộc gọi 2026-11-02 9:00/)
    draft.planned_calls[callKey('2026-11-02', 9, 'sales')] = '0'
    draft.planned_calls[callKey('2026-11-02', 9, 'old-group')] = '4'
    expect(() => buildScheduleV2Request(draft)).toThrow(/ngoài tuần\/giờ\/nhóm/)
  })

  it('maps history without filling gaps and requires matching observations for every target', () => {
    const draft = draftFromRequest(scheduleV2Samples.history)
    const request = buildScheduleV2Request(draft)
    expect(request.mode).toBe('history')
    if (request.mode !== 'history') throw new Error('Expected history mode')
    expect(request.history).toHaveLength(4)
    expect(request.history[0]).toEqual({ date: '2026-10-19', hour: 8, group_id: 'sales', calls: 2 })
    draft.history = draft.history.slice(0, 3)
    expect(() => buildScheduleV2Request(draft)).toThrow(/ít nhất hai quan sát/)
    draft.history = [...draftFromRequest(scheduleV2Samples.history).history, {
      id: 'outside', date: '2026-10-20', hour: '22', group_id: 'sales', calls: '1',
    }]
    expect(() => buildScheduleV2Request(draft)).toThrow(/không thuộc lưới/)
  })

  it('rejects invalid week, missing grid cells, day-off conflict, and illegal shifts', () => {
    const planned = draftFromRequest(scheduleV2Samples.planned_calls)
    planned.week_start = '2026-11-03'
    expect(() => buildScheduleV2Request(planned)).toThrow(/thứ Hai/)
    planned.week_start = '2026-11-02'
    planned.employees[0].unavailable_dates = ['2026-11-02']
    expect(() => buildScheduleV2Request(planned)).toThrow(/đang xung đột/)
    planned.employees[0].unavailable_dates = []
    planned.shift_starts = [{ date: '2026-11-02', start: '09:30' }]
    expect(() => buildScheduleV2Request(planned)).toThrow(/ba khung 30 phút/)
  })

  it('converts daily opening and closing hours into full-hour and half-hour slot grids', () => {
    const draft = emptyScheduleDraft('planned_calls', '2026-11-02')
    draft.hours[0] = { start: '8', end: '10' }
    const hours = operatingHoursFor(draft)
    expect(hours).toEqual([{ date: '2026-11-02', hour: 8 }, { date: '2026-11-02', hour: 9 }])
    const slots = operatingSlotsFor(hours)
    expect(slots).toHaveLength(4)
    expect(validShiftStarts(slots)).toEqual([{ date: '2026-11-02', start: '08:00' }, { date: '2026-11-02', start: '08:30' }])
  })

  it('guards invalid calendar boundaries and unsafe history counts', () => {
    expect(weekDates('2026-11-03')).toBeNull()
    expect(weekDates('9999-12-27')).toBeNull()
    const draft = draftFromRequest(scheduleV2Samples.history)
    draft.history[0].calls = '9007199254740992'
    expect(() => buildScheduleV2Request(draft)).toThrow(/số nguyên an toàn/)
  })
})
