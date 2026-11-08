import { useEffect, useId, useState } from 'react'
import type { CoverageItem } from '@/types/scheduling'
import { displayCoverageStatus } from '@/lib/coverageDisplay'
import { Button } from './ui/button'
import './WorkspaceTables.css'

type Props = {
  rows: CoverageItem[]
  hasResult: boolean
  previewId?: string
  onUpdateRow?: (time: string, calls: number, aht: number) => boolean
  onScaleCalls?: (factor: number) => void
  onResetDemand?: () => void
  onInspectSlot?: (row: CoverageItem, returnTo: string) => void
  disabled?: boolean
  filter?: DemandFilter
  onFilter?: (filter: DemandFilter) => void
}

export type DemandFilter = 'all' | 'covered' | 'shortage' | 'break'

type DemandEdit = {
  time: string
  field: 'calls' | 'aht'
  calls: string
  aht: string
}

const filters = [
  ['all', 'Tất cả'],
  ['covered', 'Đủ người'],
  ['shortage', 'Thiếu người'],
  ['break', 'Giờ nghỉ'],
] as const

const simulations = [
  { factor: 1.25, label: '+25% Cao điểm', title: 'Tăng 25% lưu lượng cuộc gọi tất cả khung giờ' },
  { factor: 0.8, label: '-20% Thấp điểm', title: 'Giảm 20% lưu lượng cuộc gọi tất cả khung giờ' },
]

function DemandSimulationControls({ disabled, onScale, onReset }: {
  disabled: boolean
  onScale: (factor: number) => void
  onReset?: () => void
}) {
  return (
    <div className="roster-table-actions print:hidden" role="group" aria-label="Mô phỏng lưu lượng">
      <span>Mô phỏng lưu lượng</span>
      {simulations.map(({ factor, label, title }) => (
        <Button key={factor} disabled={disabled} title={title} onClick={() => onScale(factor)}>{label}</Button>
      ))}
      {onReset && <Button disabled={disabled} title="Khôi phục số cuộc gọi ban đầu" onClick={onReset}>Đặt lại</Button>}
    </div>
  )
}

export function DemandTable({
  rows,
  hasResult,
  previewId,
  onUpdateRow,
  onScaleCalls,
  onResetDemand,
  onInspectSlot,
  disabled = false,
  filter: controlledFilter,
  onFilter: controlledOnFilter,
}: Props) {
  const tableId = useId()
  const [draft, setDraft] = useState<DemandEdit | null>(null)
  const [localFilter, setLocalFilter] = useState<DemandFilter>('all')
  const filter = controlledFilter ?? localFilter
  const setFilter = controlledOnFilter ?? setLocalFilter

  useEffect(() => {
    setDraft(null)
  }, [previewId])

  const startEdit = (row: CoverageItem, field: 'calls' | 'aht') => {
    if (disabled || !onUpdateRow) return
    setDraft({ time: row.time, field, calls: String(row.calls), aht: String(row.aht) })
  }

  const callsValid = draft !== null && draft.calls.trim() !== '' &&
    Number.isFinite(Number(draft.calls)) && Number(draft.calls) >= 0
  const ahtValid = draft !== null && draft.aht.trim() !== '' &&
    Number.isFinite(Number(draft.aht)) && Number(draft.aht) >= 0
  const canSave = !disabled && callsValid && ahtValid

  const finishEdit = () => {
    if (!draft) return
    setDraft(null)
    requestAnimationFrame(() => document.getElementById(`${tableId}-${draft.time}-${draft.field}`)?.focus())
  }

  const saveEdit = () => {
    if (!canSave || !onUpdateRow || !draft) return
    if (onUpdateRow(draft.time, Number(draft.calls), Number(draft.aht))) finishEdit()
  }

  const visibleRows = rows.filter((row) => {
    if (!hasResult) return true
    if (filter === 'covered') return !row.onBreak && row.shortage === 0
    if (filter === 'shortage') return !row.onBreak && row.shortage > 0
    if (filter === 'break') return row.onBreak
    return true
  })

  return (
    <div className="roster-work-table">
      <div className="roster-table-toolbar roster-work-table-heading">
        <div className="roster-table-context">
          <h3>Nhu cầu theo khung 30 phút</h3>
          <span role="status">{visibleRows.length === rows.length ? rows.length : `${visibleRows.length}/${rows.length}`} khung giờ</span>
          {onInspectSlot && hasResult && <span className="print:hidden">Chọn khung giờ để xem người trực</span>}
        </div>
      </div>
      {(hasResult || onScaleCalls) && (
        <div className="roster-work-table-toolbar roster-demand-toolbar print:hidden">
          {hasResult && (
            <div className="roster-view-options roster-work-table-filters" role="group" aria-label="Lọc theo độ phủ">
              {filters.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
              ))}
            </div>
          )}
          {onScaleCalls && (
            <DemandSimulationControls disabled={disabled} onScale={(factor) => {
              setDraft(null)
              onScaleCalls(factor)
            }} onReset={onResetDemand && (() => {
              setDraft(null)
              onResetDemand()
            })} />
          )}
        </div>
      )}
      {(hasResult || draft) && <p className="roster-scroll-hint print:hidden">Vuốt ngang để xem đủ các cột.</p>}
      <div className="roster-table-scroll" tabIndex={0} role="region" aria-label="Bảng nhu cầu và độ phủ theo khung giờ">
        <table className="roster-data-table roster-demand-table" data-result={hasResult}>
          <caption className="sr-only">Nhu cầu cuộc gọi, nhân sự cần và độ phủ theo từng khung giờ</caption>
          <thead>
            <tr>
              <th scope="col">Khung giờ</th>
              <th scope="col" className="roster-cell-number">Cuộc gọi dự kiến</th>
              <th scope="col" className="roster-cell-number">AHT (phút)</th>
              <th scope="col" className="roster-cell-number">Cần (Erlang C)</th>
              {hasResult && <>
                <th scope="col" className="roster-cell-number">Đã phân bổ</th>
                <th scope="col">Trạng thái độ phủ</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const hasShortage = hasResult && !row.onBreak && row.shortage > 0
              const editing = draft?.time === row.time ? draft : null

              return (
                <tr key={row.time} data-state={hasShortage ? 'shortage' : row.onBreak ? 'break' : undefined}
                  onKeyDown={(event) => {
                    if (!editing || disabled) return
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      finishEdit()
                    }
                    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                      event.preventDefault()
                      saveEdit()
                    }
                  }}>
                  <th scope="row">
                    {onInspectSlot && hasResult && !row.onBreak ? <>
                      <button id={`demand-slot-${row.time}`} type="button" className="roster-cell-action" disabled={disabled}
                        aria-label={`Xem người trực ${row.time}`} onClick={(event) => onInspectSlot(row, event.currentTarget.id)}>{row.time}</button>
                      <span className="hidden print:inline">{row.time}</span>
                    </> : row.time}
                  </th>
                  <td className="roster-cell-number">
                    {onUpdateRow && <span className="hidden print:inline">{row.calls}</span>}
                    {editing ? (
                      <input type="number" min="0" step="any" value={editing.calls} aria-label="Cuộc gọi dự kiến" disabled={disabled}
                        aria-invalid={!callsValid} aria-describedby={`${tableId}-edit-error`}
                        onChange={(event) => setDraft({ ...editing, calls: event.target.value })}
                        className="roster-cell-input" autoFocus={editing.field === 'calls'} />
                    ) : onUpdateRow ? (
                      <button id={`${tableId}-${row.time}-calls`} type="button" className="roster-cell-action" disabled={disabled}
                        aria-label={`Sửa số cuộc gọi ${row.time}`} onClick={() => startEdit(row, 'calls')}>{row.calls}</button>
                    ) : row.calls}
                  </td>
                  <td className="roster-cell-number">
                    {onUpdateRow && <span className="hidden print:inline">{row.aht}</span>}
                    {editing ? (
                      <div className="print:hidden">
                        <div className="roster-cell-editor">
                          <input type="number" step="any" min="0" value={editing.aht} aria-label="AHT (phút)" disabled={disabled}
                            aria-invalid={!ahtValid} aria-describedby={`${tableId}-edit-error`}
                            onChange={(event) => setDraft({ ...editing, aht: event.target.value })}
                            className="roster-cell-input" autoFocus={editing.field === 'aht'} />
                          <Button variant="primary" disabled={!canSave} onClick={saveEdit}>Lưu</Button>
                          <Button disabled={disabled} onClick={finishEdit}>Hủy</Button>
                        </div>
                        <p id={`${tableId}-edit-error`} className="roster-edit-error" role="status">
                          {(!callsValid || !ahtValid) && 'Nhập số từ 0 trở lên cho cuộc gọi và AHT.'}
                        </p>
                      </div>
                    ) : onUpdateRow ? (
                      <button id={`${tableId}-${row.time}-aht`} type="button" className="roster-cell-action" disabled={disabled}
                        aria-label={`Sửa AHT ${row.time}`} onClick={() => startEdit(row, 'aht')}>{row.aht}</button>
                    ) : row.aht}
                  </td>
                  <td className="roster-cell-number font-semibold">{row.required}</td>
                  {hasResult && <>
                    <td className="roster-cell-number">{row.scheduled}</td>
                    <td className={hasShortage ? 'roster-text-warning' : row.onBreak ? 'roster-cell-muted' : undefined}>
                      {displayCoverageStatus(row, true)}
                    </td>
                  </>}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!visibleRows.length && <p className="roster-table-empty">Không có khung giờ phù hợp với bộ lọc.</p>}
      </div>
    </div>
  )
}
