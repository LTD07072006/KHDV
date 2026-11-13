import { useRef, useState, type RefObject } from 'react'
import type { SavedSchedule, SavedScheduleKind } from '@/services/savedSchedules'
import { Button } from './ui/button'

const displayDate = (date: string) => date.split('-').reverse().join('/')
const displayTime = (timestamp: string) => new Date(timestamp).toLocaleString('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export function SavedSchedules({ headingRef, date, entries, disabled, canSaveDraft, canFinalize, previewId, isCurrentFinal, shortage, onSave, onOpen }: {
  headingRef: RefObject<HTMLHeadingElement | null>
  date: string
  entries: SavedSchedule[]
  disabled: boolean
  canSaveDraft: boolean
  canFinalize: boolean
  previewId?: string
  isCurrentFinal: boolean
  shortage: number
  onSave: (kind: SavedScheduleKind, expectedFinalSavedAt?: string) => void
  onOpen: (entry: SavedSchedule) => void
}) {
  const [replacement, setReplacement] = useState<{ previewId: string | undefined; savedAt: string } | null>(null)
  const [filterDate, setFilterDate] = useState('')
  const [filterKind, setFilterKind] = useState('all')
  const dateFilter = useRef<HTMLInputElement>(null)
  const existingDraft = entries.some((entry) => entry.session.date === date && entry.kind === 'draft')
  const existingFinal = entries.find((entry) => entry.session.date === date && entry.kind === 'final')
  const replacing = replacement && replacement.previewId === previewId && canFinalize && !isCurrentFinal
  const visibleEntries = entries.filter((entry) =>
    (!filterDate || entry.session.date === filterDate) &&
    (filterKind === 'all' || entry.kind === filterKind))

  return (
    <section id="saved-schedules" className="roster-surface mb-4 print:hidden" aria-labelledby="saved-schedules-title">
      <div className="roster-section-heading">
        <div>
          <h2 id="saved-schedules-title" className="text-lg font-semibold" tabIndex={-1} ref={headingRef}>Lịch đã lưu</h2>
          <p className="mt-0.5 text-sm text-slate-600">Lưu trên trình duyệt này. Mở một bản sẽ thay dữ liệu đang làm.</p>
        </div>
      </div>
      <div className="roster-archive-actions">
        <div>
          <p className="font-semibold">{date ? `Lịch ngày ${displayDate(date)}` : 'Chọn ngày lập lịch'}</p>
          <p className="text-slate-600">{isCurrentFinal
            ? 'Đang xem bản đã chốt.'
            : canFinalize
              ? `Bản xem trước có thể chốt${shortage ? ` · Còn thiếu ${shortage.toLocaleString('vi-VN')} lượt nhân sự` : ''}.`
              : 'Tạo bản xem trước để chốt lịch.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="roster-button" disabled={disabled || !canSaveDraft} onClick={() => onSave('draft')}>
            {existingDraft ? 'Cập nhật bản nháp' : 'Lưu bản nháp'}
          </button>
          <button
            type="button"
            className="roster-button roster-primary"
            disabled={disabled || !canFinalize || isCurrentFinal}
            onClick={() => existingFinal ? setReplacement({ previewId, savedAt: existingFinal.session.savedAt }) : onSave('final')}
          >
            {isCurrentFinal ? 'Đã chốt' : existingFinal ? 'Thay bản đã chốt' : 'Chốt lịch'}
          </button>
        </div>
        {replacing && (
          <div className="roster-archive-confirm">
            <p>Bản đã chốt ngày {displayDate(date)} sẽ được thay bằng kết quả đang xem.</p>
            <button type="button" className="roster-button" onClick={() => setReplacement(null)}>Giữ bản cũ</button>
            <button type="button" className="roster-button roster-primary" disabled={disabled} onClick={() => {
              onSave('final', replacement.savedAt)
              setReplacement(null)
            }}>Xác nhận thay</button>
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="roster-archive-filters" role="group" aria-label="Lọc lịch đã lưu">
          <label className="roster-field">
            <span>Ngày lập lịch</span>
            <input ref={dateFilter} type="date" value={filterDate} onChange={(event) => setFilterDate(event.currentTarget.value)} />
          </label>
          <label className="roster-field">
            <span>Loại bản lưu</span>
            <select value={filterKind} onChange={(event) => setFilterKind(event.currentTarget.value)}>
              <option value="all">Tất cả</option>
              <option value="draft">Bản nháp</option>
              <option value="final">Đã chốt</option>
            </select>
          </label>
          {(filterDate || filterKind !== 'all') && (
            <Button onClick={() => {
              setFilterDate('')
              setFilterKind('all')
              dateFilter.current?.focus()
            }}>Xóa bộ lọc</Button>
          )}
          <span className="roster-archive-count" role="status">{visibleEntries.length}/{entries.length} bản lưu</span>
        </div>
      )}
      {visibleEntries.length ? (
        <ul className="roster-archive-list">
          {visibleEntries.map((entry) => (
            <li key={`${entry.session.date}:${entry.kind}`}>
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                  <time dateTime={entry.session.date}>{displayDate(entry.session.date)}</time>
                  <span className="text-xs text-slate-600">{entry.kind === 'final' ? 'Đã chốt' : 'Bản nháp'}</span>
                </p>
                <p className="truncate text-xs text-slate-600" title={entry.session.fileName}>{entry.session.fileName} · {displayTime(entry.session.savedAt)}</p>
              </div>
              <button type="button" className="roster-button" disabled={disabled} onClick={() => onOpen(entry)}>
                {entry.kind === 'final' ? 'Mở lịch đã chốt' : 'Mở bản nháp'}
                <span className="sr-only"> ngày {displayDate(entry.session.date)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="px-4 py-4 text-sm text-slate-600">
        {entries.length ? 'Không có lịch khớp bộ lọc.' : 'Chưa có lịch được lưu theo ngày.'}
      </p>}
    </section>
  )
}
