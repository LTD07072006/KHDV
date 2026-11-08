import './WorkspaceTables.css'

export type ScheduleFilter = 'all' | 'ca_ngay' | 'ca_dem' | 'off'

const filters = [
  ['all', 'Tất cả'],
  ['ca_ngay', 'Ca ngày'],
  ['ca_dem', 'Ca đêm'],
  ['off', 'Nghỉ'],
] as const

export function ScheduleFilters({ filter, onFilter, count, total }: {
  filter: ScheduleFilter
  onFilter: (value: ScheduleFilter) => void
  count: number
  total: number
}) {
  return (
    <div className="roster-table-toolbar">
      <div className="roster-view-options print:hidden" role="group" aria-label="Lọc lịch theo ca">
        {filters.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => onFilter(id)}>{label}</button>
        ))}
      </div>
      <p className="roster-table-count">{count}/{total} nhân viên</p>
    </div>
  )
}
