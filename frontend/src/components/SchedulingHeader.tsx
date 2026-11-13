import { BookOpen } from 'lucide-react'
import { Button } from './ui/button'

export function SchedulingMasthead() {
  return (
    <header className="roster-masthead print:hidden">
      <div className="roster-width flex min-h-11 items-center">
        <span className="text-sm font-semibold">Điều phối CSKH</span>
      </div>
    </header>
  )
}

export function SchedulingPageHeading({
  hasSavedSession,
  busy,
  archiveOpen,
  onClearSession,
  onToggleArchive,
}: {
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
        <button type="button" className="roster-link roster-danger" disabled={busy || !hasSavedSession} onClick={onClearSession}>
          Xóa phiên
        </button>
        <Button aria-expanded={archiveOpen} aria-controls={archiveOpen ? 'saved-schedules' : undefined} onClick={onToggleArchive}>
          <BookOpen size={15} aria-hidden="true" /> Lịch đã lưu
        </Button>
      </div>
    </div>
  )
}
