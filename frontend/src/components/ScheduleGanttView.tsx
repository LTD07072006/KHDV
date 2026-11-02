import { useState } from 'react'
import { Moon, Sun, UserX, Clock, Coffee } from 'lucide-react'
import type { Employee } from '@/data/largeFixture'

type Props = {
  employees: Employee[]
  total: number
  hasResult: boolean
  filter: 'all' | 'ca_ngay' | 'ca_dem' | 'off'
  onFilter: (filter: 'all' | 'ca_ngay' | 'ca_dem' | 'off') => void
}

export function ScheduleGanttView({ employees, total, hasResult, filter, onFilter }: Props) {
  const [hoveredEmpId, setHoveredEmpId] = useState<string | null>(null)

  const hours = [
    '08:00',
    '10:00',
    '12:00 (Trưa)',
    '14:00',
    '16:00',
    '18:00',
    '20:00 (Đêm)',
    '22:00',
    '00:00',
    '02:00',
    '04:00',
    '06:00',
    '08:00 (+1)',
  ]

  const dayEmployees = employees.filter((e) => e.working && (e.shift?.includes('Ca ngày') || (!e.shift && e.allowedShifts[0] === 'ca_ngay')))
  const nightEmployees = employees.filter((e) => e.working && (e.shift?.includes('Ca đêm') || (!e.shift && e.allowedShifts[0] === 'ca_dem')))
  const offEmployees = employees.filter((e) => !e.working)

  return (
    <div className="overflow-hidden">
      {/* Filter and Legend Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700">
            Sơ đồ Gantt ca làm việc (Hiển thị {employees.length}/{total} nhân sự)
          </span>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" /> Ca ngày (08:00–20:00)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-purple-600" /> Ca đêm (20:00–08:00)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-amber-400" /> Nghỉ (Break 60p)
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 text-xs font-semibold">
          <button
            onClick={() => onFilter('all')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tất cả ({total})
          </button>
          <button
            onClick={() => onFilter('ca_ngay')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'ca_ngay' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Ca ngày ({dayEmployees.length})
          </button>
          <button
            onClick={() => onFilter('ca_dem')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'ca_dem' ? 'bg-purple-50 text-purple-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Ca đêm ({nightEmployees.length})
          </button>
          <button
            onClick={() => onFilter('off')}
            className={`rounded-lg px-2.5 py-1 transition ${
              filter === 'off' ? 'bg-slate-200 text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Nghỉ ({offEmployees.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px]">
        <div className="min-w-[860px]">
          {/* Gantt Timeline Ruler */}
          <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-white text-[11px] font-semibold text-slate-500 shadow-2xs">
            <div className="w-56 shrink-0 px-4 py-2.5 border-r border-slate-200 bg-slate-50">
              Nhân viên / Ca phân công
            </div>
            <div className="relative flex-1 flex justify-between px-3 py-2.5 bg-slate-50/80">
              {hours.map((h, i) => (
                <span
                  key={h}
                  className={`text-center ${
                    i === 2 || i === 6 ? 'font-bold text-amber-800' : 'text-slate-600'
                  }`}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Employee Gantt Rows */}
          <div className="divide-y divide-slate-100">
            {employees.map((emp) => {
              const isAssigned = hasResult && (emp.status === 'Đã xếp' || emp.status === 'Có trong bản xem trước')
              const isNight = isAssigned
                ? emp.shift?.includes('Ca đêm')
                : emp.allowedShifts[0] === 'ca_dem'
              const isOff = !emp.working
              const isHovered = hoveredEmpId === emp.id

              return (
                <div
                  key={emp.id}
                  onMouseEnter={() => setHoveredEmpId(emp.id)}
                  onMouseLeave={() => setHoveredEmpId(null)}
                  className={`flex items-center transition ${
                    isHovered ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Left Employee Info Card */}
                  <div className="w-56 shrink-0 px-4 py-3 border-r border-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900 text-xs truncate" title={emp.name}>
                        {emp.name}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">{emp.id}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {isOff ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          <UserX size={10} /> Nghỉ ca
                        </span>
                      ) : isNight ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                          <Moon size={10} className="text-purple-600" /> Ca đêm (20h–08h)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                          <Sun size={10} className="text-amber-500" /> Ca ngày (08h–20h)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Timeline Canvas */}
                  <div className="relative flex-1 h-12 px-3 flex items-center bg-white">
                    {/* Background hour grid lines */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none px-3">
                      {hours.map((_, i) => (
                        <div
                          key={i}
                          className={`h-full w-px ${
                            i === 2 || i === 6 ? 'bg-amber-200' : 'bg-slate-100'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Timeline Block */}
                    {isOff ? (
                      <div className="relative z-1 w-full rounded-md bg-slate-100/80 border border-dashed border-slate-200 py-1.5 px-3 text-center text-xs text-slate-400">
                        Không tham gia lập lịch trong ngày
                      </div>
                    ) : isNight ? (
                      // Ca đêm: 20:00 -> 08:00 next day (Hours 12 to 24 of 24h cycle)
                      <div
                        className="relative z-1 h-7.5 rounded-lg bg-gradient-to-r from-purple-700 to-purple-600 shadow-2xs flex items-center justify-between text-white text-[11px] font-medium overflow-hidden"
                        style={{ left: '50%', width: '50%' }}
                        title={`${emp.name}: Ca đêm 20:00–08:00, Nghỉ đêm 00:00–01:00`}
                      >
                        <span className="pl-2 flex items-center gap-1 text-purple-100">
                          <Clock size={11} /> 20:00
                        </span>

                        {/* Night Break block (00:00 - 01:00, which is hour 4 of the 12h night shift = 33.3% of night bar) */}
                        <div
                          className="absolute h-full bg-amber-400 text-amber-950 font-bold flex items-center justify-center text-[10px] shadow-xs px-1 border-x border-amber-500"
                          style={{ left: '33.33%', width: '8.33%' }}
                          title="Giờ nghỉ ca đêm (00:00–01:00): Không tính độ phủ"
                        >
                          <Coffee size={10} className="hidden sm:inline mr-0.5" />
                          <span className="truncate">Nghỉ</span>
                        </div>

                        <span className="pr-2 text-purple-100">08:00</span>
                      </div>
                    ) : (
                      // Ca ngày: 08:00 -> 20:00 (Hours 0 to 12 of 24h cycle)
                      <div
                        className="relative z-1 h-7.5 rounded-lg bg-gradient-to-r from-blue-700 to-blue-600 shadow-2xs flex items-center justify-between text-white text-[11px] font-medium overflow-hidden"
                        style={{ left: '0%', width: '50%' }}
                        title={`${emp.name}: Ca ngày 08:00–20:00, Nghỉ trưa 12:00–13:00`}
                      >
                        <span className="pl-2 flex items-center gap-1 text-blue-100">
                          <Clock size={11} /> 08:00
                        </span>

                        {/* Day Break block (12:00 - 13:00, which is hour 4 of 12h day shift = 33.3% of day bar) */}
                        <div
                          className="absolute h-full bg-amber-400 text-amber-950 font-bold flex items-center justify-center text-[10px] shadow-xs px-1 border-x border-amber-500"
                          style={{ left: '33.33%', width: '8.33%' }}
                          title="Giờ nghỉ ca ngày (12:00–13:00): Không tính độ phủ"
                        >
                          <Coffee size={10} className="hidden sm:inline mr-0.5" />
                          <span className="truncate">Nghỉ</span>
                        </div>

                        <span className="pr-2 text-blue-100">20:00</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
