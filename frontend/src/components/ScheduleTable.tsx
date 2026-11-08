import type { Employee } from '@/types/scheduling'
import { displayShift, displayStatus, isEmployeeAssigned } from '@/lib/employeeDisplay'
import { ScheduleFilters, type ScheduleFilter } from './ScheduleFilters'

export function ScheduleTable({ employees, total, filter, onFilter, hasResult }: {
  employees: Employee[]
  total: number
  filter: ScheduleFilter
  onFilter: (value: ScheduleFilter) => void
  hasResult: boolean
}) {
  return (
    <div>
      <ScheduleFilters filter={filter} onFilter={onFilter} count={employees.length} total={total} />
      <p className="roster-scroll-hint print:hidden">Vuốt ngang để xem đủ các cột.</p>
      <div className="roster-table-scroll" tabIndex={0} role="region" aria-label="Bảng lịch nhân viên">
        <table className="roster-data-table roster-schedule-table">
          <caption className="sr-only">Lịch ca, kỹ năng đảm nhiệm, giờ nghỉ và trạng thái của từng nhân viên</caption>
          <thead>
            <tr>
              <th scope="col">Nhân viên</th>
              <th scope="col">Kỹ năng</th>
              <th scope="col">Ca làm việc</th>
              <th scope="col">Khung giờ nghỉ</th>
              <th scope="col">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const shift = displayShift(employee, hasResult)
              const status = displayStatus(employee, hasResult)
              const isAssigned = isEmployeeAssigned(employee, hasResult)
              const needsAttention = status === 'Chưa xếp' || status === 'Chưa chọn ca'

              return (
                <tr key={employee.id}>
                  <th scope="row">
                    <span>{employee.name}</span>
                    <span className="roster-table-id">{employee.id}</span>
                  </th>
                  <td>{employee.skill || 'Hỗ trợ chung'}</td>
                  <td className="roster-schedule-hours">{isAssigned ? shift.label : '—'}</td>
                  <td className="roster-schedule-hours">{isAssigned ? shift.breakTime : '—'}</td>
                  <td className={needsAttention ? 'roster-text-warning' : 'roster-cell-muted'}>{status}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!employees.length && <p className="roster-table-empty">Không có nhân viên trong nhóm này.</p>}
      </div>
    </div>
  )
}
