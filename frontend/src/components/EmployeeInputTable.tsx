import { Search } from 'lucide-react'
import type { Employee, ShiftId } from '@/types/scheduling'

type EmployeeFilter = 'all' | 'working' | 'off'

export function EmployeeInputTable({
  employees,
  total,
  workingCount,
  search,
  filter,
  onSearch,
  onFilter,
  onSetAll,
  onSetFlexibleAll,
  onToggleAllWorking,
  onUpdate,
  disabled = false,
}: {
  employees: Employee[]
  total: number
  workingCount: number
  search: string
  filter: EmployeeFilter
  onSearch: (value: string) => void
  onFilter: (value: EmployeeFilter) => void
  onSetAll: (shift: ShiftId) => void
  onSetFlexibleAll: () => void
  onToggleAllWorking: (workingStatus: boolean) => void
  onUpdate: (id: string, change: Partial<Pick<Employee, 'working' | 'allowedShifts'>>) => void
  disabled?: boolean
}) {
  const toggleShift = (employee: Employee, shift: ShiftId, checked: boolean) => {
    const next = checked
      ? [...new Set<ShiftId>([...employee.allowedShifts, shift])]
      : employee.allowedShifts.filter((item) => item !== shift)
    onUpdate(employee.id, { allowedShifts: next })
  }

  const allAreWorking = workingCount === total

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Danh sách nhân viên</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Tích chọn người đi làm và ca khả dụng. Đang hiển thị {employees.length}/{total} nhân
              sự.
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Có thể dùng phím Tab để đi qua từng ô chọn.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              disabled={disabled}
              onClick={() => onToggleAllWorking(!allAreWorking)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allAreWorking ? 'Bỏ chọn đi làm' : 'Chọn tất cả đi làm'}
            </button>
            <button
              disabled={disabled}
              onClick={() => onSetAll('ca_ngay')}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Chọn ca ngày
            </button>
            <button
              disabled={disabled}
              onClick={() => onSetAll('ca_dem')}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Chọn ca đêm
            </button>
            <button
              disabled={disabled}
              onClick={onSetFlexibleAll}
              className="rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Cho phép tất cả nhân viên làm được cả ca ngày hoặc ca đêm"
            >
              Linh hoạt 2 ca
            </button>
          </div>
        </div>

        {/* Search & Tab Filters */}
        <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              aria-label="Tìm nhân viên"
              value={search}
              disabled={disabled}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc mã nhân viên…"
              className="w-full rounded-xl border border-slate-200 py-1.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
            />
          </label>
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            <button
              onClick={() => onFilter('all')}
              className={`rounded-lg px-2.5 py-1 transition ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Tất cả ({total})
            </button>
            <button
              onClick={() => onFilter('working')}
              className={`rounded-lg px-2.5 py-1 transition ${
                filter === 'working' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Đi làm ({workingCount})
            </button>
            <button
              onClick={() => onFilter('off')}
              className={`rounded-lg px-2.5 py-1 transition ${
                filter === 'off' ? 'bg-white text-slate-700 shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Nghỉ ({total - workingCount})
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-[380px] overflow-auto" tabIndex={0} aria-label="Bảng chọn nhân viên và ca làm việc">
        <p className="px-5 py-2 text-[11px] text-slate-400 sm:hidden">Vuốt ngang để xem đủ các cột.</p>
        <table className="w-full min-w-[700px] text-left text-sm">
          <caption className="sr-only">Danh sách nhân viên và lựa chọn đi làm, ca ngày, ca đêm</caption>
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-2xs z-10">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Nhân viên</th>
              <th className="px-5 py-2.5 text-center font-semibold">Đi làm</th>
              <th className="px-5 py-2.5 text-center font-semibold">Ca ngày</th>
              <th className="px-5 py-2.5 text-center font-semibold">Ca đêm</th>
              <th className="px-5 py-2.5 font-semibold">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-slate-50">
                <td className="px-5 py-2.5">
                  <p className="font-semibold text-slate-800 text-xs">{employee.name}</p>
                  <p className="text-[11px] text-slate-500">{employee.id}</p>
                </td>
                <td className="px-5 py-2.5 text-center">
                  <input
                    aria-label={`${employee.name} đi làm`}
                    type="checkbox"
                    checked={employee.working}
                    disabled={disabled}
                    onChange={(event) => onUpdate(employee.id, { working: event.target.checked })}
                    className="h-4 w-4 cursor-pointer accent-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
                  />
                </td>
                <td className="px-5 py-2.5 text-center">
                  <input
                    aria-label={`${employee.name} ca ngày`}
                    type="checkbox"
                    checked={employee.allowedShifts.includes('ca_ngay')}
                    disabled={disabled || !employee.working}
                    onChange={(event) => toggleShift(employee, 'ca_ngay', event.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
                  />
                </td>
                <td className="px-5 py-2.5 text-center">
                  <input
                    aria-label={`${employee.name} ca đêm`}
                    type="checkbox"
                    checked={employee.allowedShifts.includes('ca_dem')}
                    disabled={disabled || !employee.working}
                    onChange={(event) => toggleShift(employee, 'ca_dem', event.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
                  />
                </td>
                <td className="px-5 py-2.5 text-xs text-slate-500">
                  {!employee.working ? (
                    <span className="text-slate-400">Không tham gia</span>
                  ) : !employee.allowedShifts.length ? (
                    <span className="font-semibold text-rose-600">Chưa chọn ca</span>
                  ) : employee.allowedShifts.length === 2 ? (
                    <span className="text-blue-600 font-medium">Linh hoạt cả 2 ca</span>
                  ) : (
                    <span className="text-slate-600">Đã chọn ca</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!employees.length && (
          <p className="px-5 py-8 text-center text-xs text-slate-500">
            Không tìm thấy nhân viên phù hợp.
          </p>
        )}
      </div>
    </div>
  )
}
