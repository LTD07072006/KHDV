import { expect, it } from 'vitest'
import type { CoverageItem } from '@/types/scheduling'
import { groupShortagePeriods } from './coverageDisplay'

it('groups adjacent shortages without crossing a break, covered slot or data gap', () => {
  const slot = (time: string, shortage: number, onBreak = false): CoverageItem => ({
    time, shortage, onBreak, calls: 20, aht: 6, required: 8,
    scheduled: 8 - shortage, overstaff: 0,
  })

  const peak = slot('08:30–09:00', 4)
  const afterBreak = slot('09:30–10:00', 2)
  const afterGap = slot('10:30–11:00', 1)
  const afterCovered = slot('11:30–12:00', 3)
  expect(groupShortagePeriods([
    slot('08:00–08:30', 2), peak, slot('09:00–09:30', 8, true),
    afterBreak, afterGap, slot('11:00–11:30', 0), afterCovered,
  ])).toEqual([
    { start: '08:00', end: '09:00', peak, total: 6 },
    { start: '09:30', end: '10:00', peak: afterBreak, total: 2 },
    { start: '10:30', end: '11:00', peak: afterGap, total: 1 },
    { start: '11:30', end: '12:00', peak: afterCovered, total: 3 },
  ])
})
