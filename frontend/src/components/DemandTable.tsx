import { useState } from 'react'
import { TrendingUp, RotateCcw } from 'lucide-react'
import type { CoverageItem } from '@/types/scheduling'

type Props = {
  rows: CoverageItem[]
  hasResult: boolean
  onUpdateRow?: (time: string, calls: number, aht: number) => void
  onScaleCalls?: (factor: number) => void
  onResetDemand?: () => void
  disabled?: boolean
  filter?: DemandFilter
  onFilter?: (filter: DemandFilter) => void
}

type DemandFilter = 'all' | 'covered' | 'shortage' | 'break'

export function DemandTable({
  rows,
  hasResult,
  onUpdateRow,
  onScaleCalls,
  onResetDemand,
  disabled = false,
  filter: controlledFilter,
  onFilter: controlledOnFilter,
}: Props) {
  const [editingSlot, setEditingSlot] = useState<string | null>(null)
  const [editCalls, setEditCalls] = useState<number>(0)
  const [editAht, setEditAht] = useState<number>(0)
  const [localFilter, setLocalFilter] = useState<DemandFilter>('all')
  const filter = controlledFilter ?? localFilter
  const setFilter = controlledOnFilter ?? setLocalFilter

  const startEdit = (row: CoverageItem) => {
    if (disabled || !onUpdateRow) return
    setEditingSlot(row.time)
    setEditCalls(row.calls)
    setEditAht(row.aht)
  }

  const saveEdit = (time: string) => {
    if (onUpdateRow) {
      onUpdateRow(time, Math.max(0, editCalls), Math.max(0.1, editAht))
    }
    setEditingSlot(null)
  }

  const cancelEdit = () => {
    setEditingSlot(null)
  }

  const visibleRows = rows.filter((row) => {
    if (filter === 'covered') return hasResult && !row.onBreak && row.shortage === 0
    if (filter === 'shortage') return hasResult && !row.onBreak && row.shortage > 0
    if (filter === 'break') return row.onBreak
    return true
  })

  return (
    <div className="overflow-hidden">
      {/* Simulation & Quick Actions Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">
            Dự báo lưu lượng cuộc gọi theo giờ (24 khung 30 phút)
          </span>
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/50">
            Kỹ năng: Hỗ trợ chung
          </span>
        </div>

        {/* Quick Simulation Buttons */}
        {onScaleCalls && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 hidden sm:inline text-[11px]">Mô phỏng lưu lượng:</span>
            <button
              disabled={disabled}
              onClick={() => onScaleCalls(1.25)}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition disabled:opacity-50"
              title="Tăng 25% lưu lượng cuộc gọi tất cả khung giờ"
            >
              <TrendingUp size={12} /> +25% Cao điểm
            </button>
            <button
              disabled={disabled}
              onClick={() => onScaleCalls(0.8)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              title="Giảm 20% lưu lượng cuộc gọi tất cả khung giờ"
            >
              -20% Thấp điểm
            </button>
            {onResetDemand && (
              <button
                disabled={disabled}
                onClick={onResetDemand}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                title="Khôi phục số cuộc gọi ban đầu"
              >
                <RotateCcw size={12} /> Đặt lại
              </button>
            )}
          </div>
        )}
        {hasResult && (
          <div className="basis-full flex flex-wrap items-center gap-1 border-t border-slate-100 px-5 py-2 text-[11px] font-semibold text-slate-500">
            <span className="mr-1 font-medium text-slate-400">Lọc:</span>
            {(['all', 'covered', 'shortage', 'break'] as DemandFilter[]).map((item) => {
              const labels: Record<DemandFilter, string> = { all: 'Tất cả', covered: 'Đủ người', shortage: 'Thiếu người', break: 'Giờ nghỉ' }
              return <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`rounded-md px-2 py-1 transition ${filter === item ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-100'}`}>{labels[item]}</button>
            })}
            <span className="ml-auto text-slate-400">{visibleRows.length}/{rows.length} slot</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto max-h-[460px]" tabIndex={0} aria-label="Bảng nhu cầu và độ phủ theo khung giờ">
        <p className="px-5 py-2 text-[11px] text-slate-400 sm:hidden">Vuốt ngang để xem đủ các cột.</p>
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Nhu cầu cuộc gọi, nhân sự cần và độ phủ theo từng khung giờ</caption>
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-2xs z-10">
            <tr>
              <th className="px-5 py-3 font-semibold">Khung giờ (30p)</th>
              <th className="px-5 py-3 font-semibold">Cuộc gọi (Dự báo)</th>
              <th className="px-5 py-3 font-semibold">AHT (phút)</th>
              <th className="px-5 py-3 font-semibold text-blue-700">Cần (Erlang C)</th>
              <th className="px-5 py-3 font-semibold">Đã phân bổ</th>
              <th className="px-5 py-3 font-semibold min-w-[190px]">Độ phủ & Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => {
              const hasShortage = hasResult && row.shortage > 0
              const percentage = Math.min(
                100,
                Math.round((row.scheduled / Math.max(1, row.required)) * 100)
              )
              const isEditing = editingSlot === row.time

              return (
                <tr
                  key={row.time}
                  className={`transition ${
                    hasShortage ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-5 py-3 font-medium text-slate-800">{row.time}</td>

                  {/* Editable Calls */}
                  <td className="px-5 py-3 text-slate-700">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={editCalls}
                        onChange={(e) => setEditCalls(Number(e.target.value))}
                        className="w-16 rounded border border-blue-400 px-1.5 py-0.5 text-xs font-bold text-slate-900 focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(row)}
                        className={`cursor-pointer hover:underline hover:text-blue-600 ${
                          onUpdateRow ? 'title="Bấm để sửa nhanh cuộc gọi"' : ''
                        }`}
                      >
                        {row.calls} <span className="text-[11px] text-slate-400">cuộc</span>
                      </span>
                    )}
                  </td>

                  {/* Editable AHT */}
                  <td className="px-5 py-3 text-slate-700">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={editAht}
                          onChange={(e) => setEditAht(Number(e.target.value))}
                          className="w-14 rounded border border-blue-400 px-1.5 py-0.5 text-xs font-bold text-slate-900 focus:outline-none"
                        />
                        <button
                          onClick={() => saveEdit(row.time)}
                          className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-blue-700"
                        >
                          Lưu
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-300"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => startEdit(row)}
                        className={`cursor-pointer hover:underline hover:text-blue-600 ${
                          onUpdateRow ? 'title="Bấm để sửa AHT"' : ''
                        }`}
                      >
                        {row.aht} phút
                      </span>
                    )}
                  </td>

                  {/* Erlang C Required Agents */}
                  <td className="px-5 py-3 font-bold text-blue-700">
                    <span className="inline-flex items-center gap-1">
                      {row.required} <span className="text-[10px] font-normal text-blue-500">ĐTV</span>
                    </span>
                  </td>

                  {/* Local preview scheduled agents */}
                  <td className="px-5 py-3 text-slate-700 font-semibold">
                    {hasResult ? `${row.scheduled} ĐTV` : '—'}
                  </td>

                  {/* Coverage Status Bar */}
                  <td className="px-5 py-3">
                    {row.onBreak ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        {row.time.startsWith('00:') ? 'Giờ nghỉ (00:00–01:00)' : 'Giờ nghỉ (12:00–13:00)'}
                      </span>
                    ) : !hasResult ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        Chưa tạo
                      </span>
                    ) : hasShortage ? (
                      <div className="space-y-1.5 w-44">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-amber-700">Thiếu {row.shortage}</span>
                          <span className="text-slate-500">
                            {row.scheduled}/{row.required}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 w-44">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-emerald-700">Đủ người</span>
                          <span className="text-emerald-600">
                            {row.scheduled}/{row.required}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
                          <div className="h-full w-full bg-emerald-500 rounded-full" />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!visibleRows.length && <p className="px-5 py-8 text-center text-xs text-slate-500">Không có slot phù hợp với bộ lọc.</p>}
      </div>
    </div>
  )
}
