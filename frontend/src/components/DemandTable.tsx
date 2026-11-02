import type { CoverageItem } from '@/types/scheduling'

export function DemandTable({ rows, hasResult }: { rows: CoverageItem[]; hasResult: boolean }) {
  return (
    <div className="overflow-x-auto max-h-[460px]" tabIndex={0} aria-label="Bảng nhu cầu và độ phủ theo khung giờ">
      <p className="px-5 py-2 text-[11px] text-slate-400 sm:hidden">Vuốt ngang để xem đủ các cột.</p>
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">Nhu cầu cuộc gọi, nhân sự cần và độ phủ theo từng khung giờ</caption>
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-2xs z-10">
          <tr>
            <th className="px-5 py-3 font-semibold">Khung giờ</th>
            <th className="px-5 py-3 font-semibold">Cuộc gọi</th>
            <th className="px-5 py-3 font-semibold">AHT</th>
            <th className="px-5 py-3 font-semibold">Nhu cầu</th>
            <th className="px-5 py-3 font-semibold">Đã phân bổ</th>
            <th className="px-5 py-3 font-semibold min-w-[190px]">Độ phủ & Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const hasShortage = hasResult && row.shortage > 0
            const percentage = Math.min(
              100,
              Math.round((row.scheduled / Math.max(1, row.required)) * 100)
            )

            return (
              <tr
                key={row.time}
                className={`transition ${
                  hasShortage ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-5 py-3 font-medium text-slate-800">{row.time}</td>
                <td className="px-5 py-3 text-slate-600">{row.calls}</td>
                <td className="px-5 py-3 text-slate-600">{row.aht} phút</td>
                <td className="px-5 py-3 font-bold text-slate-800">{row.required}</td>
                <td className="px-5 py-3 text-slate-700 font-semibold">
                  {hasResult ? row.scheduled : '—'}
                </td>
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
    </div>
  )
}
