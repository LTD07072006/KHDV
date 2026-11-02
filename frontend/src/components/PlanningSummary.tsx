import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Users } from 'lucide-react'
import type { DemandRow, Employee } from '@/types/scheduling'

type Props = {
  date: string
  demand: DemandRow[]
  employees: Employee[]
  serviceTarget: number
  answerWithinSeconds: number
  warnings: string[]
  ready: boolean
}

export function PlanningSummary({ date, demand, employees, serviceTarget, answerWithinSeconds, warnings, ready }: Props) {
  const working = employees.filter((employee) => employee.working)
  const day = working.filter((employee) => employee.allowedShifts.includes('ca_ngay')).length
  const night = working.filter((employee) => employee.allowedShifts.includes('ca_dem')).length
  const withoutShift = working.filter((employee) => employee.allowedShifts.length === 0).length
  const totalCalls = demand.reduce((sum, row) => sum + row.calls, 0)
  const peak = Math.max(...demand.map((row) => row.required), 0)
  const formattedDate = date ? date.split('-').reverse().join('/') : 'Chưa chọn'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs" aria-labelledby="planning-summary-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className={ready ? 'text-emerald-600' : 'text-amber-600'} />
            <h2 id="planning-summary-title" className="text-sm font-semibold text-slate-900">Tóm tắt dữ liệu trước khi tạo lịch</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Kiểm tra nhanh các thông tin hệ thống sẽ dùng cho bản xem trước.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
          {ready ? 'Sẵn sàng tạo lịch' : 'Cần xem lại'}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem icon={<CalendarDays size={15} />} label="Ngày lập lịch" value={formattedDate} />
        <SummaryItem icon={<Clock3 size={15} />} label="Khung giờ có dữ liệu" value={`${demand.length} slot`} detail={`${totalCalls.toLocaleString()} cuộc gọi dự kiến`} />
        <SummaryItem icon={<Users size={15} />} label="Nhân viên đi làm" value={`${working.length}/${employees.length}`} detail={`${day} ca ngày · ${night} ca đêm`} />
        <SummaryItem icon={<AlertTriangle size={15} />} label="Nhu cầu cao nhất" value={`${peak} người`} detail={`Mức ${serviceTarget >= 0.9 ? 'Cao' : 'Tiêu chuẩn'} · ${answerWithinSeconds} giây`} />
      </div>

      {(warnings.length > 0 || withoutShift > 0) && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900" role="status">
          <p className="font-semibold">Có điểm cần xem lại trước khi tạo lịch:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {withoutShift > 0 && <li>{withoutShift} nhân viên đang đi làm nhưng chưa chọn ca.</li>}
            {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}

function SummaryItem({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">{icon}{label}</div>
      <p className="mt-1 text-base font-bold text-slate-900">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>}
    </div>
  )
}
