import { describe, expect, it } from 'vitest'
import { createMockSchedule } from './mockSchedule'
import type { DemandRow, Employee } from '@/types/scheduling'

const demand: DemandRow[] = [
  { time: '08:00–08:30', calls: 10, aht: 6, required: 2 },
  { time: '12:00–12:30', calls: 10, aht: 6, required: 2 },
]
const employees: Employee[] = [
  { id: 'NV001', name: 'A', shift: '', breakTime: '', status: 'Có thể nhận ca', working: true, allowedShifts: ['ca_ngay'] },
]

describe('createMockSchedule', () => {
  it('creates a deterministic preview assignment', () => {
    const result = createMockSchedule('2026-11-02', demand, employees)
    expect(result.solution_source).toBe('BASELINE')
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].template_id).toBe('day_0800')
  })

  it('does not count day break as shortage', () => {
    const result = createMockSchedule('2026-11-02', demand, employees)
    expect(result.coverage[1].scheduled_agents).toBe(0)
    expect(result.coverage[1].shortage_agents).toBe(0)
  })

  it('keeps preview source explicit', () => {
    const result = createMockSchedule('2026-11-02', demand, employees)
    expect(result.solution_source).toBe('BASELINE')
    expect(result.diagnostics[0].code).toBe('LOCAL_PREVIEW')
  })
})
