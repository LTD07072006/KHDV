import type { ComponentProps } from 'react'
import { ScheduleGanttView } from './ScheduleGanttView'
import { ScheduleTable } from './ScheduleTable'
import type { ScheduleViewMode } from './ScheduleWorkspace'
import { SlotRoster } from './SlotRoster'

export function ShiftScheduleView({ mode, slotReview, ...schedule }: ComponentProps<typeof ScheduleTable> & {
  mode: ScheduleViewMode
  slotReview?: ComponentProps<typeof SlotRoster>
}) {
  if (slotReview) return (
    <>
      <SlotRoster {...slotReview} />
      <div className="hidden print:block"><ScheduleTable {...schedule} /></div>
    </>
  )
  if (mode === 'table') return <ScheduleTable {...schedule} />

  return (
    <>
      <div className="print:hidden"><ScheduleGanttView {...schedule} /></div>
      {schedule.hasResult && <div className="hidden print:block"><ScheduleTable {...schedule} /></div>}
    </>
  )
}
