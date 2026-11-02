import { Check, Circle, LoaderCircle } from 'lucide-react'

export type PreviewStage = 'idle' | 'reading' | 'demand' | 'scheduling' | 'checking' | 'done'

const steps = [
  { id: 'reading', label: 'Đọc dữ liệu' },
  { id: 'demand', label: 'Tính nhu cầu' },
  { id: 'scheduling', label: 'Tạo bản xem trước' },
  { id: 'checking', label: 'Kiểm tra kết quả' },
] as const

export function PreviewProgress({ stage }: { stage: PreviewStage }) {
  const activeIndex = stage === 'idle' ? -1 : stage === 'done' ? steps.length : steps.findIndex((step) => step.id === stage)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs" aria-label="Tiến trình tạo bản xem trước" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">Tiến trình xử lý</p>
        <p className="text-[11px] text-slate-500">
          {stage === 'idle' ? 'Chưa chạy' : stage === 'done' ? 'Đã hoàn tất' : steps[activeIndex]?.label}
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const complete = index < activeIndex || stage === 'done'
          const active = index === activeIndex && stage !== 'done'
          return (
            <div key={step.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium ${complete ? 'bg-emerald-50 text-emerald-700' : active ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-400'}`}>
              {complete ? <Check size={14} /> : active ? <LoaderCircle size={14} className="animate-spin" /> : <Circle size={13} />}
              <span>{step.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
