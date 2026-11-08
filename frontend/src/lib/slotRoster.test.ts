import { describe, expect, it } from 'vitest'
import { employeeIdsOnDuty } from './slotRoster'

const day = {
  employee_id: 'NV01', template_id: 'day_0800', skill_id: 'general_support',
  start: '2026-11-02T08:00:00+07:00', end: '2026-11-02T20:00:00+07:00',
  breaks: [{ start: '2026-11-02T12:00:00+07:00', end: '2026-11-02T13:00:00+07:00' }],
}
const night = {
  employee_id: 'NV02', template_id: 'night_2000', skill_id: 'general_support',
  start: '2026-11-02T20:00:00+07:00', end: '2026-11-03T08:00:00+07:00',
  breaks: [{ start: '2026-11-03T00:00:00+07:00', end: '2026-11-03T01:00:00+07:00' }],
}

describe('employeeIdsOnDuty', () => {
  it('checks at the start of the selected slot and excludes people on break', () => {
    expect(employeeIdsOnDuty([day, night], '2026-11-02', '11:45–12:15')).toEqual(['NV01'])
    expect(employeeIdsOnDuty([day, night], '2026-11-02', '12:00–12:30')).toEqual([])
    expect(employeeIdsOnDuty([day, night], '2026-11-02', '13:00–13:30')).toEqual(['NV01'])
  })

  it('handles the end of a shift, the overnight date and the overnight break', () => {
    expect(employeeIdsOnDuty([day, night], '2026-11-02', '20:00–20:30')).toEqual(['NV02'])
    expect(employeeIdsOnDuty([day, night], '2026-11-03', '00:00–00:30')).toEqual([])
    expect(employeeIdsOnDuty([day, night], '2026-11-03', '07:30–08:00')).toEqual(['NV02'])
  })
})
