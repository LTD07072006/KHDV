import type { CoverageItem } from '@/types/scheduling'

export const coverageOutcomes = [
  { id: 'shortage', symbol: '−', label: 'Thiếu người' },
  { id: 'covered', symbol: '=', label: 'Đủ người' },
  { id: 'surplus', symbol: '+', label: 'Dư người' },
] as const

export function coverageOutcome(row: CoverageItem, hasResult: boolean) {
  if (!hasResult || row.onBreak) return undefined
  if (row.shortage > 0) return coverageOutcomes[0]
  if (row.overstaff > 0) return coverageOutcomes[2]
  return coverageOutcomes[1]
}

export function displayCoverageStatus(row: CoverageItem, hasResult: boolean) {
  if (row.onBreak) return 'Giờ nghỉ'
  const outcome = coverageOutcome(row, hasResult)
  if (!outcome) return 'Chưa tạo'
  if (outcome.id === 'shortage') return `Thiếu ${row.shortage} người`
  if (outcome.id === 'surplus') return `Dư ${row.overstaff} người`
  return outcome.label
}

export function summarizeCoverage(rows: CoverageItem[]) {
  const activeRows = rows.filter((row) => !row.onBreak)
  const worst = activeRows.reduce<CoverageItem | null>(
    (peak, row) => row.shortage > (peak?.shortage ?? 0) ? row : peak,
    null,
  )
  return {
    shortage: activeRows.reduce((sum, row) => sum + row.shortage, 0),
    uncoveredSlots: activeRows.filter((row) => row.shortage > 0).length,
    worst,
    coveredSlots: activeRows.filter((row) => row.shortage === 0).length,
    totalSlots: activeRows.length,
  }
}

export type CoverageSummary = ReturnType<typeof summarizeCoverage>
