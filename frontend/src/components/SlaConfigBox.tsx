import { Sliders, HelpCircle } from 'lucide-react'

type Props = {
  serviceTarget: number
  answerWithinSeconds: number
  onChange: (serviceTarget: number, answerWithinSeconds: number) => void
  disabled?: boolean
}

export function SlaConfigBox({ serviceTarget, answerWithinSeconds, onChange, disabled }: Props) {
  const targetOptions = [
    { label: 'Tiêu chuẩn', value: 0.8, seconds: 20, detail: 'Hướng tới trả lời 80% cuộc gọi trong 20 giây' },
    { label: 'Cao', value: 0.9, seconds: 20, detail: 'Hướng tới trả lời 90% cuộc gọi trong 20 giây' },
  ]

  const selectedOption = targetOptions.find((option) => Math.abs(option.value - serviceTarget) < 0.001 && option.seconds === answerWithinSeconds) ?? targetOptions[0]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders size={18} className="text-blue-600" />
          <h2 className="font-semibold text-slate-900 text-sm">Mức phục vụ</h2>
        </div>
        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
          {selectedOption.label}
        </span>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-600">Chọn mức phục vụ cho ngày này:</p>
        <div className="grid grid-cols-2 gap-1.5">
          {targetOptions.map((opt) => (
            <button
              key={opt.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value, opt.seconds)}
              className={`rounded-lg py-1.5 px-2 text-xs font-semibold transition border ${
                Math.abs(serviceTarget - opt.value) < 0.001
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-50'
              }`}
            >
              <span className="block">{opt.label}</span>
              <span className={`mt-0.5 block text-[10px] font-normal ${Math.abs(serviceTarget - opt.value) < 0.001 && answerWithinSeconds === opt.seconds ? 'text-blue-100' : 'text-slate-500'}`}>{opt.detail}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Formula Explanation Tooltip */}
      <div className="mt-3.5 flex items-start gap-1.5 rounded-xl bg-slate-50 p-2.5 text-[11px] leading-4 text-slate-500 border border-slate-100">
        <HelpCircle size={14} className="mt-0.5 shrink-0 text-blue-500" />
        <p>
          {selectedOption.detail}. Nếu nhân viên không đủ, hệ thống vẫn tạo bản xem trước và chỉ rõ các khoảng bị thiếu.
        </p>
      </div>
    </div>
  )
}
