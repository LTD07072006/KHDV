import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

export type Notice = { tone: 'success' | 'error' | 'info' | 'warning'; message: string }

export function NoticeBox({ notice }: { notice: Notice }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
    error: 'bg-rose-50 text-rose-800 border border-rose-200/80',
    warning: 'bg-amber-50 text-amber-900 border border-amber-200/80',
    info: 'bg-slate-50 text-slate-700 border border-slate-200',
  }
  return (
    <p
      role={notice.tone === 'error' ? 'alert' : 'status'}
      aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
      className={`mt-3 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs leading-5 ${styles[notice.tone]}`}
    >
      {notice.tone === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> : notice.tone === 'error' ? <XCircle size={14} className="mt-0.5 shrink-0 text-rose-600" /> : notice.tone === 'warning' ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" /> : <Info size={14} className="mt-0.5 shrink-0 text-blue-500" />}
      <span>{notice.message}</span>
    </p>
  )
}
