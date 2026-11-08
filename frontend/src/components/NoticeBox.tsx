import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

export type Notice = { tone: 'success' | 'error' | 'info' | 'warning'; message: string }

export function NoticeBox({ notice }: { notice: Notice }) {
  const Icon = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }[notice.tone]
  return (
    <p
      role={notice.tone === 'error' ? 'alert' : 'status'}
      aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
      className="roster-notice"
      data-tone={notice.tone}
    >
      <Icon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{notice.message}</span>
    </p>
  )
}
