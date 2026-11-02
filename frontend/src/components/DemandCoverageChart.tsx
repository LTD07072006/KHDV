import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'

export type ChartCoverageRow = {
  time: string
  calls: number
  aht: number
  required: number
  scheduled: number
  shortage: number
  overstaff: number
  onBreak?: boolean
}

type Props = {
  rows: ChartCoverageRow[]
  hasResult: boolean
  serviceTarget?: number
  answerWithinSeconds?: number
}

export function DemandCoverageChart({ rows, hasResult, serviceTarget = 0.8, answerWithinSeconds = 20 }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const stats = useMemo(() => {
    const maxVal = Math.max(...rows.map((r) => Math.max(r.required, r.scheduled)), 6)
    const peakCallsRow = [...rows].sort((a, b) => b.calls - a.calls)[0]
    const peakReqRow = [...rows].sort((a, b) => b.required - a.required)[0]
    const shortageRows = rows.filter((r) => r.shortage > 0)
    const totalShortage = rows.reduce((sum, r) => sum + r.shortage, 0)
    const totalCalls = rows.reduce((sum, r) => sum + r.calls, 0)

    return {
      maxVal,
      peakCallsRow,
      peakReqRow,
      shortageRows,
      totalShortage,
      totalCalls,
    }
  }, [rows])

  const hoveredRow = hoveredIndex !== null ? rows[hoveredIndex] : null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs" aria-label={`Biểu đồ nhu cầu và độ phủ của ${rows.length} khung giờ`}>
      {/* Header and Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-900 text-sm">
              Biểu đồ nhu cầu & độ phủ bản xem trước
            </h3>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              SLA {(serviceTarget * 100).toFixed(0)}/{answerWithinSeconds}s
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Trực quan hóa {rows.length} khung giờ 30 phút trong khoảng hoạt động Contact Center (08:00–20:00).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="h-3 w-3 rounded-xs bg-blue-600" />
            <span>Nhu cầu cần</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="h-3 w-3 rounded-xs bg-emerald-500" />
            <span>Đã phân bổ trong bản xem trước</span>
          </div>
          {hasResult && stats.totalShortage > 0 && (
            <div className="flex items-center gap-1.5 text-amber-700">
              <span className="h-3 w-3 rounded-xs bg-amber-400" />
              <span>Thiếu hụt (Shortage)</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="h-3 w-3 rounded-xs bg-amber-100 border border-amber-300" />
            <span>Nghỉ trưa (12:00–13:00)</span>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="relative mt-6 pt-2 pb-2">
        {/* Hover Tooltip floating */}
        {hoveredRow && (
          <div className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 -translate-y-full transform rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-xs transition-all">
            <div className="flex items-center justify-between gap-4 font-bold text-slate-900 border-b border-slate-100 pb-1 mb-1">
              <span>Khung giờ: {hoveredRow.time}</span>
              <span
                className={`text-[11px] font-semibold ${
                  hoveredRow.shortage > 0
                    ? 'text-amber-700'
                    : hasResult
                    ? 'text-emerald-700'
                    : 'text-slate-500'
                }`}
              >
                {hoveredRow.shortage > 0 ? `Thiếu ${hoveredRow.shortage} người` : hasResult ? 'Đủ người' : 'Chưa tạo'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
              <span>Cuộc gọi: <strong className="text-slate-900">{hoveredRow.calls}</strong></span>
              <span>AHT: <strong className="text-slate-900">{hoveredRow.aht} phút</strong></span>
              <span>Cần: <strong className="text-blue-700">{hoveredRow.required} người</strong></span>
              <span>Đã phân bổ: <strong className="text-slate-900">{hasResult ? `${hoveredRow.scheduled} người` : '—'}</strong></span>
            </div>
          </div>
        )}

        {/* Bars Container */}
        <div className="flex h-52 items-end gap-1.5 sm:gap-2">
          {rows.map((row, idx) => {
            const reqPercent = Math.min(100, (row.required / stats.maxVal) * 100)
            const schedPercent = hasResult ? Math.min(100, (row.scheduled / stats.maxVal) * 100) : 0
            const isHovered = hoveredIndex === idx
            const isLunchBreak = row.time.startsWith('12:00') || row.time.startsWith('12:30')
            const hasShortage = hasResult && row.shortage > 0

            return (
              <div
                key={row.time}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`group relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer rounded-t-sm transition-all duration-150 ${
                  isHovered ? 'bg-blue-50/70 scale-y-[1.02]' : isLunchBreak ? 'bg-amber-50/40' : 'hover:bg-slate-50'
                }`}
              >
                {/* Break Label Flag */}
                {isLunchBreak && idx % 2 === 0 && (
                  <span className="absolute top-1 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/90 px-1 rounded-xs">
                    Nghỉ
                  </span>
                )}

                {/* Target Required Marker (Blue horizontal dash line) */}
                <div
                  className="absolute w-full border-t-2 border-dashed border-blue-600 z-10 pointer-events-none"
                  style={{ bottom: `${reqPercent}%` }}
                  title={`Nhu cầu: ${row.required}`}
                />

                {/* Actual Scheduled Bar */}
                {hasResult ? (
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 relative ${
                      hasShortage
                        ? 'bg-gradient-to-t from-amber-500 to-amber-400'
                        : 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                    }`}
                    style={{ height: `${schedPercent}%` }}
                  >
                    {/* Shortage gap top highlight */}
                    {hasShortage && reqPercent > schedPercent && (
                      <div
                        className="absolute bottom-full left-0 right-0 bg-amber-200/80 border border-amber-300 border-dashed rounded-t-sm"
                        style={{ height: `${Math.max(4, reqPercent - schedPercent)}%` }}
                      />
                    )}
                  </div>
                ) : (
                  // Preview state before running solver
                  <div
                    className="w-full bg-slate-200/80 rounded-t-sm transition-all"
                    style={{ height: `${reqPercent}%` }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* X Axis Time Labels */}
        <div className="mt-2.5 flex justify-between border-t border-slate-200 pt-2 text-[10px] font-medium text-slate-500">
          <span>08:00</span>
          <span>10:00</span>
          <span className="text-amber-800 font-bold">12:00 (Nghỉ)</span>
          <span>14:00</span>
          <span>16:00</span>
          <span>18:00</span>
          <span>20:00</span>
        </div>
      </div>

      {/* KPI Cards under chart */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 pt-4 border-t border-slate-100 text-xs">
        <div className="rounded-xl bg-slate-50 p-2.5">
          <p className="text-[11px] text-slate-500">Tổng cuộc gọi trong ngày</p>
          <p className="mt-0.5 font-bold text-slate-900 text-sm">
            {stats.totalCalls.toLocaleString()} <span className="text-[11px] font-normal text-slate-500">cuộc</span>
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-2.5">
          <p className="text-[11px] text-slate-500">Đỉnh cuộc gọi cao nhất</p>
          <p className="mt-0.5 font-bold text-slate-900 text-sm">
            {stats.peakCallsRow?.calls ?? 0}{' '}
            <span className="text-[11px] font-normal text-slate-500">({stats.peakCallsRow?.time ?? '—'})</span>
          </p>
        </div>

        <div className="rounded-xl bg-blue-50/60 p-2.5 border border-blue-100/60">
          <p className="text-[11px] text-blue-700">Đỉnh nhân sự cần</p>
          <p className="mt-0.5 font-bold text-blue-900 text-sm">
            {stats.peakReqRow?.required ?? 0}{' '}
            <span className="text-[11px] font-normal text-blue-700">ĐTV ({stats.peakReqRow?.time ?? '—'})</span>
          </p>
        </div>

        <div
          className={`rounded-xl p-2.5 border ${
            hasResult && stats.totalShortage > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <p className="text-[11px] font-medium opacity-80">
            {hasResult ? 'Tình trạng thiếu hụt' : 'Trạng thái bản xem trước'}
          </p>
          <p className="mt-0.5 font-bold text-sm flex items-center gap-1">
            {hasResult ? (
              stats.totalShortage > 0 ? (
                <>
                  <AlertTriangle size={14} className="text-amber-600" />
                  <span>Thiếu {stats.totalShortage} lượt ({stats.shortageRows.length} slot)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Đạt 100% độ phủ</span>
                </>
              )
            ) : (
              <span className="text-slate-600 font-normal">Sẵn sàng tạo bản xem trước</span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
