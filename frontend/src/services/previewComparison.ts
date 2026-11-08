import { isBreakSlot } from './mockSchedule'
import type { DemandRow, SchedulingResult } from '@/types/scheduling'

export type PreviewRun = {
  date: string
  rows: Array<{ time: string; required: number; shortage: number }>
}

export function summarizePreview(date: string, demand: DemandRow[], result: SchedulingResult): PreviewRun {
  return {
    date,
    rows: demand.flatMap((row, index) => {
      const coverage = result.coverage[index]
      if (!coverage || isBreakSlot(row.time)) return []
      return [{ time: row.time, required: coverage.required_agents, shortage: coverage.shortage_agents }]
    }),
  }
}

export function isPreviewRun(value: unknown): value is PreviewRun {
  if (!value || typeof value !== 'object') return false
  const run = value as Partial<PreviewRun>
  return typeof run.date === 'string' &&
    Array.isArray(run.rows) && run.rows.every((row) => row && typeof row.time === 'string' &&
      Number.isFinite(row.required) && Number.isFinite(row.shortage))
}

export function comparePreviews(previous: PreviewRun, current: PreviewRun) {
  const previousByTime = new Map(previous.rows.map((row) => [row.time, row]))
  if (previous.date !== current.date || previousByTime.size !== previous.rows.length ||
    previousByTime.size !== current.rows.length ||
    !current.rows.every((row) => previousByTime.has(row.time)) ||
    new Set(current.rows.map((row) => row.time)).size !== current.rows.length) return null

  const totals = (run: PreviewRun) => run.rows.reduce((sum, row) => ({
    required: sum.required + row.required,
    shortage: sum.shortage + row.shortage,
    shortSlots: sum.shortSlots + Number(row.shortage > 0),
  }), { required: 0, shortage: 0, shortSlots: 0 })

  const changed = current.rows.flatMap((row) => {
    const before = previousByTime.get(row.time)
    if (!before || before.shortage === row.shortage) return []
    return [{ time: row.time, before: before.shortage, after: row.shortage }]
  })

  return { before: totals(previous), after: totals(current), changed }
}
