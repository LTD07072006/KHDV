import { displayShift, displayStatus, isEmployeeAssigned } from '@/lib/employeeDisplay'
import type { Employee } from '@/types/scheduling'
import { ScheduleFilters, type ScheduleFilter } from './ScheduleFilters'
import './ShiftTimeline.css'

const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00', '02:00', '04:00', '06:00']

function minutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function breakPosition(shift: ReturnType<typeof displayShift>) {
  const [start, end] = shift.breakTime.split(/[–-]/).map((time) => time.trim())
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/
  if (!start || !end || !clock.test(start) || !clock.test(end)) return undefined

  const offset = (time: string) => (minutes(time) - minutes(shift.start) + 1440) % 1440
  const length = offset(shift.end)
  const from = offset(start)
  const to = offset(end)
  if (from >= to || to > length) return undefined

  return { left: `${from / length * 100}%`, width: `${(to - from) / length * 100}%` }
}

export function ScheduleGanttView({ employees, total, hasResult, filter, onFilter }: {
  employees: Employee[]
  total: number
  hasResult: boolean
  filter: ScheduleFilter
  onFilter: (value: ScheduleFilter) => void
}) {
  return (
    <div>
      <ScheduleFilters filter={filter} onFilter={onFilter} count={employees.length} total={total} />
      {!hasResult ? (
        <p className="roster-table-empty">Tạo bản xem trước để xem giờ vào ca và giờ nghỉ của từng nhân viên.</p>
      ) : employees.length === 0 ? (
        <p className="roster-table-empty">Không có nhân viên trong bộ lọc này.</p>
      ) : (
        <div className="roster-timeline-scroll" tabIndex={0} role="region" aria-label="Dòng thời gian làm việc từ 08:00 đến 08:00 ngày hôm sau">
          <div className="roster-timeline">
            <div className="roster-timeline-row roster-timeline-ruler" aria-hidden="true">
              <div className="roster-timeline-person font-semibold">Nhân viên</div>
              <div className="roster-timeline-hours">
                {hours.map((hour) => <span key={hour}>{hour}</span>)}
              </div>
            </div>
            {employees.map((employee) => {
              const status = displayStatus(employee, true)
              const assigned = isEmployeeAssigned(employee, true)
              const shift = displayShift(employee, true)
              const night = shift.type === 'ca_dem'
              const pause = assigned ? breakPosition(shift) : undefined
              const shiftDescription = pause ? `${shift.label} · Nghỉ ${shift.breakTime}` : shift.label
              return (
                <div key={employee.id} className="roster-timeline-row">
                  <div className="roster-timeline-person">
                    <p className="truncate text-sm font-medium" title={employee.name}>{employee.name}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{employee.id}</p>
                  </div>
                  <div className="roster-timeline-track">
                    {assigned ? (
                      <div className="roster-shift" data-night={night} title={shiftDescription}>
                        <span className="sr-only">{shiftDescription}</span>
                        <span aria-hidden="true">{shift.start}</span>
                        {pause && <span aria-hidden="true" className="roster-shift-break" style={pause} />}
                        <span aria-hidden="true">{shift.end}{night && ' (+1)'}</span>
                      </div>
                    ) : <span className="pl-3 text-xs text-slate-600">{status}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {hasResult && employees.length > 0 && (
        <div className="roster-data-legend roster-timeline-legend">
          <span><i data-series="day" /> Ca ngày</span>
          <span><i data-series="night" /> Ca đêm</span>
          <span><i data-series="break" /> Giờ nghỉ</span>
          <span>+1 là ngày hôm sau</span>
        </div>
      )}
    </div>
  )
}
