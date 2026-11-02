import { Check } from 'lucide-react'

type Props = { number: string; label: string; active: boolean; done: boolean }

export function StepIndicator({ number, label, active, done }: Props) {
  return (
    <div
      aria-current={active ? 'step' : undefined}
      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${done ? 'bg-emerald-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
        {done ? <Check size={14} /> : number}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}
