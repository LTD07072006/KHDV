import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRef } from 'react'
import { ScheduleV2Result } from '@/components/ScheduleV2Result'
import type { ScheduleV2Response } from '@/services/scheduleV2'
import {
  buildCoverageSlotStateMap, buildWeeklyGantt, classifyShiftCoverage, coverageDeltaLabel, coverageState,
  filterAssignments, filterCoverageRows, formatDuration, summarizeCoverage,
} from './scheduleV2Visualization'

const multiDayResult: ScheduleV2Response = {
  mode: 'planned_calls',
  groups: [
    { id: 'sales', name: 'Bán hàng' },
    { id: 'support', name: 'Hỗ trợ' },
  ],
  forecast: null,
  interval_results: [
    { date: '2026-11-02', start: '08:00', group_id: 'sales', calls: 10, sample_count: null, erlang: { required_staff: 2, service_level: 0.9 }, assigned_staff: 2 },
    { date: '2026-11-02', start: '08:30', group_id: 'sales', calls: 12, sample_count: null, erlang: { required_staff: 2, service_level: 0.85 }, assigned_staff: 3 },
    { date: '2026-11-02', start: '09:00', group_id: 'sales', calls: 15, sample_count: null, erlang: { required_staff: 3, service_level: 0.82 }, assigned_staff: 2 },
    { date: '2026-11-02', start: '08:00', group_id: 'support', calls: 6, sample_count: null, erlang: { required_staff: 1, service_level: 0.92 }, assigned_staff: 1 },
    { date: '2026-11-03', start: '08:00', group_id: 'sales', calls: 8, sample_count: null, erlang: { required_staff: 1, service_level: 0.95 }, assigned_staff: 1 },
    { date: '2026-11-03', start: '08:30', group_id: 'support', calls: 8, sample_count: null, erlang: { required_staff: 1, service_level: 0.91 }, assigned_staff: 1 },
  ],
  schedule: {
    status: 'OPTIMAL',
    stage_two_status: 'OPTIMAL',
    skill_mismatch_slots: 0,
    total_shift_minutes: 360,
    overstaff_slots: 1,
    warnings: [],
    message: 'Đã chứng minh tối ưu.',
    assignments: [
      {
        employee_id: 'nv01',
        date: '2026-11-02',
        start: '08:00',
        end: '10:00',
        breaks: [{ start: '09:00', end: '09:30' }],
        groups_by_slot: [
          { start: '08:00', group_id: 'sales' },
          { start: '08:30', group_id: 'sales' },
          { start: '09:30', group_id: 'support' },
        ],
      },
      {
        employee_id: 'nv02',
        date: '2026-11-02',
        start: '08:00',
        end: '09:30',
        breaks: [],
        groups_by_slot: [
          { start: '08:00', group_id: 'support' },
          { start: '08:30', group_id: 'sales' },
          { start: '09:00', group_id: 'sales' },
        ],
      },
      {
        employee_id: 'nv01',
        date: '2026-11-03',
        start: '08:00',
        end: '09:30',
        breaks: [],
        groups_by_slot: [
          { start: '08:00', group_id: 'sales' },
          { start: '08:30', group_id: 'support' },
          { start: '09:00', group_id: 'support' },
        ],
      },
    ],
  },
}

describe('scheduleV2Visualization', () => {
  it('classifies exact, over, under, and unavailable coverage states', () => {
    expect(coverageState(2, 2)).toBe('exact')
    expect(coverageState(2, 3)).toBe('over')
    expect(coverageState(3, 2)).toBe('under')
    expect(coverageState(2, null)).toBe('unavailable')

    expect(coverageDeltaLabel(2, 2)).toBe('Đủ')
    expect(coverageDeltaLabel(2, 4)).toBe('Thừa +2')
    expect(coverageDeltaLabel(3, 1)).toBe('Thiếu 2')
    expect(coverageDeltaLabel(57, 1)).toBe('Thiếu 56')
    expect(coverageDeltaLabel(1, null)).toBe('Chưa có lịch')
  })

  it('summarizes coverage counts for a day and group', () => {
    const daySales = multiDayResult.interval_results.filter((r) => r.date === '2026-11-02' && r.group_id === 'sales')
    expect(summarizeCoverage(daySales)).toEqual({ exact: 1, over: 1, under: 1, unavailable: 0, total: 3 })
  })

  it('filters assignments by date, group, and employee', () => {
    const all = multiDayResult.schedule.assignments
    expect(filterAssignments(all, { date: '', group: '', employee: '' })).toHaveLength(3)
    expect(filterAssignments(all, { date: '2026-11-03', group: '', employee: '' })).toHaveLength(1)
    expect(filterAssignments(all, { date: '', group: 'support', employee: '' })).toHaveLength(3)
    expect(filterAssignments(all, { date: '2026-11-02', group: 'sales', employee: 'nv02' })).toHaveLength(1)
    expect(filterAssignments(all, { date: '2026-11-03', group: 'sales', employee: 'nv02' })).toHaveLength(0)
  })

  it('builds a multi-day Employee x Date Gantt grid with merged segments and breaks', () => {
    const gantt = buildWeeklyGantt(multiDayResult, { date: '', group: '', employee: '' })
    expect(gantt.dates).toEqual(['2026-11-02', '2026-11-03'])
    expect(gantt.employees).toEqual(['nv01', 'nv02'])
    expect(gantt.hasBreaks).toBe(true)
    expect(gantt.minMinute).toBe(8 * 60)
    expect(gantt.maxMinute).toBe(10 * 60)

    const nv01 = gantt.rows.find((r) => r.employeeId === 'nv01')!
    expect(nv01.shiftCount).toBe(2)
    expect(nv01.totalWorkMinutes).toBe(180)

    const monShift = nv01.cells['2026-11-02'][0]
    expect(monShift.leftPct).toBe(0)
    expect(monShift.widthPct).toBe(100)
    // 08:00-08:30 & 08:30-09:00 merged into 1 sales segment, 09:00-09:30 break, 09:30-10:00 support
    expect(monShift.segments.map((s) => `${s.kind}:${s.groupId ?? 'break'}:${s.start}-${s.end}`)).toEqual([
      'group:sales:08:00-09:00',
      'break:break:09:00-09:30',
      'group:support:09:30-10:00',
    ])
  })

  it('formats durations cleanly in Vietnamese', () => {
    expect(formatDuration(30)).toBe('30 phút')
    expect(formatDuration(120)).toBe('2 giờ')
    expect(formatDuration(90)).toBe('1g 30p')
  })

  it('renders coverage chart statuses and weekly Gantt grid in ScheduleV2Result', () => {
    const html = renderToStaticMarkup(<ScheduleV2Result result={multiDayResult} headingRef={createRef()} />)
    expect(html).toContain('Biểu đồ độ phủ theo khung 30 phút')
    expect(html).toContain('Tất cả các ngày')
    expect(html).toContain('Tất cả các nhóm')
    expect(html).toContain('Tất cả: 6')
    expect(html).toContain('Đủ: 4')
    expect(html).toContain('Thừa: 1')
    expect(html).toContain('Thiếu: 1')
    expect(html).toContain('data-state="exact"')
    expect(html).toContain('data-state="over"')
    expect(html).toContain('data-state="under"')
    expect(html).toContain('Lịch phân công tuần')
    expect(html).toContain('Lưới lịch tuần (Gantt)')
    expect(html).toContain('Lọc theo ngày')
    expect(html).toContain('Lọc theo nhóm')
    expect(html).toContain('Lọc theo nhân viên')
    expect(html).toContain('Lọc theo độ phủ ca')
    expect(html).toContain('Nghỉ giữa ca')
    expect(html).toContain('nv01')
    expect(html).toContain('nv02')
  })

  it('filters coverage interval rows and shift assignments by exact, over, and under states', () => {
    expect(filterCoverageRows(multiDayResult.interval_results, 'all')).toHaveLength(6)
    expect(filterCoverageRows(multiDayResult.interval_results, 'exact')).toHaveLength(4)
    expect(filterCoverageRows(multiDayResult.interval_results, 'over')).toHaveLength(1)
    expect(filterCoverageRows(multiDayResult.interval_results, 'under')).toHaveLength(1)

    const slotStates = buildCoverageSlotStateMap(multiDayResult.interval_results)
    const nv01Day1 = multiDayResult.schedule.assignments[0]
    const nv02Day1 = multiDayResult.schedule.assignments[1]
    const nv01Day2 = multiDayResult.schedule.assignments[2]
    expect(classifyShiftCoverage(nv01Day1, slotStates)).toBe('over')
    expect(classifyShiftCoverage(nv02Day1, slotStates)).toBe('mixed')
    expect(classifyShiftCoverage(nv01Day2, slotStates)).toBe('exact')

    expect(filterAssignments(multiDayResult.schedule.assignments, { date: '', group: '', employee: '', coverage: 'under' }, undefined, slotStates)).toHaveLength(1)
    expect(filterAssignments(multiDayResult.schedule.assignments, { date: '', group: '', employee: '', coverage: 'over' }, undefined, slotStates)).toHaveLength(2)
    expect(filterAssignments(multiDayResult.schedule.assignments, { date: '', group: '', employee: '', coverage: 'exact' }, undefined, slotStates)).toHaveLength(1)
  })

  it('hides weekly Gantt grid when status is INFEASIBLE', () => {
    const infeasible: ScheduleV2Response = {
      ...multiDayResult,
      interval_results: multiDayResult.interval_results.map((r) => ({ ...r, assigned_staff: null })),
      schedule: {
        status: 'INFEASIBLE',
        stage_two_status: null,
        skill_mismatch_slots: null,
        total_shift_minutes: null,
        overstaff_slots: null,
        warnings: [],
        message: 'Không có lịch.',
        assignments: [],
      },
    }
    const html = renderToStaticMarkup(<ScheduleV2Result result={infeasible} headingRef={createRef()} />)
    expect(html).toContain('Chưa có lịch')
    expect(html).toContain('Cách xử lý')
    expect(html).not.toContain('Lưới lịch tuần (Gantt)')
  })

  it('highlights skill-mismatched slots on Gantt and filters mismatch-only shifts', () => {
    const skills = { nv01: ['sales'], nv02: ['sales', 'support'] }
    const mismatchResult: ScheduleV2Response = {
      ...multiDayResult,
      schedule: { ...multiDayResult.schedule, skill_mismatch_slots: 3 },
    }
    const onlyMismatch = filterAssignments(mismatchResult.schedule.assignments, { date: '', group: '', employee: '', mismatchOnly: true }, skills)
    expect(onlyMismatch.every((shift) => shift.employee_id === 'nv01')).toBe(true)

    const gantt = buildWeeklyGantt(mismatchResult, { date: '', group: '', employee: '' }, skills)
    expect(gantt.hasAnySkillMismatch).toBe(true)
    expect(gantt.rows.find((r) => r.employeeId === 'nv01')?.cells['2026-11-02'][0].hasSkillMismatch).toBe(true)
    expect(gantt.rows.find((r) => r.employeeId === 'nv02')?.cells['2026-11-02'][0].hasSkillMismatch).toBe(false)

    const html = renderToStaticMarkup(
      <ScheduleV2Result result={mismatchResult} headingRef={createRef()} employeeSkills={skills} />,
    )
    expect(html).toContain('Điều chuyển trái kỹ năng')
    expect(html).toContain('Chỉ hiện ca lệch kỹ năng')
    expect(html).toContain('Lệch kỹ năng (1)')
  })

  it('renders time-budget retry guidance for FEASIBLE and UNKNOWN statuses', () => {
    const feasible: ScheduleV2Response = {
      ...multiDayResult,
      schedule: { ...multiDayResult.schedule, status: 'FEASIBLE', stage_two_status: 'UNKNOWN' },
    }
    const html = renderToStaticMarkup(
      <ScheduleV2Result result={feasible} headingRef={createRef()} solveSeconds={10} onRetryLonger={() => {}} />,
    )
    expect(html).toContain('Thử lại với giới hạn 30 giây')
  })
})
