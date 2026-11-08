import type { ComponentProps } from 'react'
import { DemandCoverageChart } from './DemandCoverageChart'
import { DemandTable } from './DemandTable'
import type { DemandViewMode } from './ScheduleWorkspace'

export function DemandCoverageView({ mode, ...table }: ComponentProps<typeof DemandTable> & { mode: DemandViewMode }) {
  return (
    <>
      {mode !== 'table' && (
        <div className="print:hidden">
          <DemandCoverageChart rows={table.rows} hasResult={table.hasResult} onInspectSlot={table.onInspectSlot} />
        </div>
      )}
      {mode === 'chart' ? (
        <div className="hidden print:block">
          <DemandTable rows={table.rows} hasResult={table.hasResult} />
        </div>
      ) : <DemandTable {...table} />}
    </>
  )
}
