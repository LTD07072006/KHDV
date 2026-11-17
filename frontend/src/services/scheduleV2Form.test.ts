import { describe, expect, it } from 'vitest'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import { callKey, rangeSlots } from './scheduleV2'
import { buildScheduleV2Request, draftFromRequest, operatingSlots } from './scheduleV2Form'

const planned = () => draftFromRequest(scheduleV2Samples.planned_calls)
const history = () => draftFromRequest(scheduleV2Samples.history)

describe('interval request construction', () => {
  it.each(Object.values(scheduleV2Samples))('round trips the published $mode sample', (sample) => {
    const { max_solve_seconds: _budget, ...body } = sample
    expect(buildScheduleV2Request(draftFromRequest(sample))).toEqual(body)
  })

  it('retains split ranges and treats breaks as part of a variable-length shift', () => {
    const draft = planned()
    draft.operating.push({ date: draft.week, start: '09:00', end: '09:30' },
      { date: draft.week, start: '23:30', end: '24:00' })
    draft.shifts[0] = { date: draft.week, start: '08:00', end: '09:30', breaks: [{ start: '08:30', end: '09:00' }] }
    const slots = operatingSlots(draft.operating)
    draft.employees[0].available_slots = slots
    for (const slot of slots) draft.planned[callKey({ ...slot, group_id: 'sales' })] = '0'
    expect(buildScheduleV2Request(draft)).toMatchObject({
      operating_intervals: draft.operating, shifts: draft.shifts,
      employees: [{ available_slots: slots, max_shift_minutes_per_week: 600 }],
      planned_calls: [{ calls: 0 }, { calls: 0 }, { calls: 0 }, { start: '23:30', calls: 0 }],
    })
    expect(rangeSlots({ start: '23:30', end: '24:00' })).toEqual(['23:30'])
  })

  it('rejects off-grid shifts and availability and overlapping operating ranges', () => {
    const draft = planned()
    draft.shifts[0].end = '09:30'
    expect(() => buildScheduleV2Request(draft)).toThrow(/Ca 1/)
    draft.shifts[0].end = '09:00'
    draft.employees[0].available_slots.push({ date: draft.week, start: '09:15' })
    expect(() => buildScheduleV2Request(draft)).toThrow(/ngoài giờ hoạt động/)
    draft.employees[0].available_slots.pop()
    draft.operating.push({ date: draft.week, start: '08:30', end: '09:30' })
    expect(() => buildScheduleV2Request(draft)).toThrow(/chồng lấn/)
  })

  it('rejects break overlap or an entirely nonworking shift', () => {
    const draft = planned()
    draft.shifts[0].breaks = [{ start: '08:00', end: '09:00' }]
    expect(() => buildScheduleV2Request(draft)).toThrow(/ít nhất một/)
    draft.shifts[0].breaks.push({ start: '08:30', end: '09:00' })
    expect(() => buildScheduleV2Request(draft)).toThrow(/chồng lấn/)
  })

  it('distinguishes a missing count from explicit zero and checks extra cells', () => {
    const draft = planned()
    const key = callKey({ date: draft.week, start: '08:30', group_id: 'sales' })
    delete draft.planned[key]
    expect(() => buildScheduleV2Request(draft)).toThrow(/Nhập 0/)
    draft.planned[key] = '0'
    expect(buildScheduleV2Request(draft)).toMatchObject({ planned_calls: [{ calls: .5 }, { calls: 0 }] })
    draft.planned[callKey({ date: draft.week, start: '09:00', group_id: 'sales' })] = '0'
    expect(() => buildScheduleV2Request(draft)).toThrow(/ngoài lưới/)
  })

  it('needs AHT only for groups with positive demand', () => {
    const draft = planned()
    Object.assign(draft.groups[0], { aht: '', samples: '', cutoff: '' })
    expect(() => buildScheduleV2Request(draft)).toThrow(/cần thông tin AHT/)
    draft.planned = Object.fromEntries(Object.keys(draft.planned).map((key) => [key, '0']))
    expect(buildScheduleV2Request(draft).aht_by_group).toEqual([])
  })

  it('checks the historic date bounds, duplicates and two separate observations without filling gaps', () => {
    const draft = history()
    const row = draft.history.pop()!
    expect(() => buildScheduleV2Request(draft)).toThrow(/hai ngày lịch sử/)
    draft.history.push({ ...row, date: draft.window.end_date })
    expect(() => buildScheduleV2Request(draft)).toThrow(/ngày trong khoảng/)
    draft.history.pop()
    draft.history.push({ ...draft.history[0] })
    expect(() => buildScheduleV2Request(draft)).toThrow(/trùng/)
  })

  it('preserves removed skills for explicit correction and rejects availability on a day off', () => {
    const draft = planned()
    draft.employees[0].skills.push('old')
    expect(() => buildScheduleV2Request(draft)).toThrow(/kỹ năng/)
    draft.employees[0].skills.pop()
    draft.employees[0].unavailable_dates.push(draft.week)
    expect(() => buildScheduleV2Request(draft)).toThrow(/trùng với ngày nghỉ/)
  })

  it('accepts 99.9% and rejects 100%, 0%, and blanks', () => {
    const draft = planned()
    draft.groups[0].sla = '99.9'
    expect(buildScheduleV2Request(draft).service_targets[0].target_sla).toBeCloseTo(.999)
    for (const sla of ['', '0', '100']) {
      draft.groups[0].sla = sla
      expect(() => buildScheduleV2Request(draft)).toThrow(/SLA/)
    }
  })
})
