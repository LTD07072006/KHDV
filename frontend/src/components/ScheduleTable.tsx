import { Moon, Sun } from 'lucide-react'
import type { Employee } from '@/types/scheduling'
import { displayShift, displayStatus } from '@/lib/employeeDisplay'

type ScheduleFilter = 'all' | 'ca_ngay' | 'ca_dem' | 'off'

export function ScheduleTable({
  employees,
  total,
  filter,
  onFilter,
  hasResult,
}: {
  employees: Employee[]
  total: number
  filter: ScheduleFilter
  onFilter: (value: ScheduleFilter) => void
  hasResult: boolean
}) {
  return (
    <div>
      {/* Shift Filter Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <span className="text-xs font-semibold text-slate-500">
          Hiển thị: {employees.length}/{total} nhân sự
        </span>
        <div className="flex items-center gap-1 text-xs font-semibold">
          <button
            onClick={() => onFilter('all')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => onFilter('ca_ngay')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'ca_ngay'
                ? 'bg-blue-50 text-blue-700 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Ca ngày
          </button>
          <button
            onClick={() => onFilter('ca_dem')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'ca_dem'
                ? 'bg-purple-50 text-purple-700 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Ca đêm
          </button>
          <button
            onClick={() => onFilter('off')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'off'
                ? 'bg-slate-200 text-slate-800 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Nghỉ
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[460px]" tabIndex={0} aria-label="Bảng lịch nhân viên">
        <p className="px-5 py-2 text-[11px] text-slate-400 sm:hidden">Vuốt ngang để xem đủ các cột.</p>
        <table className="w-full min-w-[620px] text-left text-sm">
          <caption className="sr-only">Lịch ca, giờ nghỉ và trạng thái của từng nhân viên</caption>
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-2xs z-10">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Nhân viên</th>
              <th className="px-5 py-2.5 font-semibold">Ca làm việc</th>
              <th className="px-5 py-2.5 font-semibold">Khung giờ nghỉ</th>
              <th className="px-5 py-2.5 font-semibold">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((employee) => {
              const shift = displayShift(employee, hasResult)
              const status = displayStatus(employee, hasResult)
              const isAssigned = status === 'Đã xếp' || status === 'Có trong bản xem trước'

              return (
                <tr key={employee.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800 text-xs">{employee.name}</p>
                    <p className="text-[11px] text-slate-500">{employee.id}</p>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {isAssigned ? (
                      shift.type === 'ca_dem' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 font-semibold text-purple-700 border border-purple-200/60">
                          <Moon size={12} className="text-purple-600" /> Ca đêm · 20:00–08:00
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 border border-blue-200/60">
                          <Sun size={12} className="text-amber-500" /> Ca ngày · 08:00–20:00
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {isAssigned ? shift.breakTime : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isAssigned
                          ? status === 'Có trong bản xem trước'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : status === 'Nghỉ'
                          ? 'bg-slate-100 text-slate-500 border border-slate-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!employees.length && (
          <p className="px-5 py-8 text-center text-xs text-slate-500">
            Không có nhân viên trong nhóm này.
          </p>
        )}
      </div>
    </div>
  )
}
