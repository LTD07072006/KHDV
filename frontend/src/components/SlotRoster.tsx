import type { CoverageItem, Employee } from '@/types/scheduling'
import { Button } from './ui/button'

export function SlotRoster({ row, employeeIds, employees, onClose, onBack }: {
  row: CoverageItem
  employeeIds: string[]
  employees: Employee[]
  onClose: () => void
  onBack: () => void
}) {
  const byId = new Map(employees.map((employee) => [employee.id, employee]))

  return (
    <section className="roster-slot-review print:hidden" aria-labelledby="slot-roster-heading">
      <div className="roster-slot-toolbar">
        <div>
          <h3 id="slot-roster-heading" tabIndex={-1}>{employeeIds.length} người trực lúc {row.time.slice(0, 5)}</h3>
          <p>Khung {row.time} · Cần {row.required} người · Đã phân bổ {row.scheduled} người</p>
        </div>
        <div className="roster-slot-actions">
          <Button onClick={onBack}>Về độ phủ</Button>
          <Button onClick={onClose}>Xem toàn bộ lịch</Button>
        </div>
      </div>
      {employeeIds.length ? (
        <ul className="roster-slot-staff" aria-label={`${employeeIds.length} người trực lúc bắt đầu khung giờ`}>
          {employeeIds.map((id) => (
            <li key={id}>
              <strong>{byId.get(id)?.name ?? id}</strong>
              {byId.has(id) && <span>{id}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="roster-table-empty">Chưa có người trực tại thời điểm này.</p>}
    </section>
  )
}
