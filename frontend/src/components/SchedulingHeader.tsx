import { BookOpen } from 'lucide-react'
import { Button } from './ui/button'

export function SchedulingMasthead() {
  return (
    <header className="roster-masthead print:hidden">
      <div className="roster-width flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm font-semibold">Điều phối CSKH</span>
        <span className="roster-environment">Chế độ mô phỏng</span>
      </div>
    </header>
  )
}

export function SchedulingPageHeading({
  savedAt,
  hasSavedSession,
  busy,
  archiveOpen,
  onClearSession,
  onToggleArchive,
}: {
  savedAt: string | null
  hasSavedSession: boolean
  busy: boolean
  archiveOpen: boolean
  onClearSession: () => void
  onToggleArchive: () => void
}) {
  return (
    <div className="roster-page-heading">
      <h1>Lịch làm việc</h1>
      <div className="roster-page-actions print:hidden">
        <div className="roster-session">
          <span>{hasSavedSession && savedAt
            ? `Phiên lưu lúc ${new Date(savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
            : 'Chưa lưu phiên'}</span>
          <button type="button" className="roster-link roster-danger" disabled={busy || !hasSavedSession} onClick={onClearSession}>
            Xóa phiên
          </button>
        </div>
        <Button aria-expanded={archiveOpen} aria-controls={archiveOpen ? 'saved-schedules' : undefined} onClick={onToggleArchive}>
          <BookOpen size={15} aria-hidden="true" /> Lịch đã lưu
        </Button>
      </div>
    </div>
  )
}
