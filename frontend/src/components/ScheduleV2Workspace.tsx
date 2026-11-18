import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './ui/button'
import { Check, EmployeeEditor, Field, GroupEditor, HistoryEditor, OperatingEditor, ShiftEditor } from './ScheduleIntervalEditors'
import { ScheduleV2Result } from './ScheduleV2Result'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import { downloadBlob } from '@/lib/downloadFile'
import { apiMessages, callKey, hasSchedule, requestScheduleV2, type ScheduleV2Mode, type ScheduleV2Response } from '@/services/scheduleV2'
import { databaseSampleUrl, exportScheduleCsv, fileExtension, importCalls, type CallsFormat, type SourceImport } from '@/services/scheduleV2Files'
import {
  blankGroup, buildScheduleV2Request, displayDate, draftFromRequest, emptyDraft, historyFromRows,
  operatingSlots, plannedFromRows, validWindow, weekDates, type ScheduleDraft,
} from '@/services/scheduleV2Form'
import './WorkspaceTables.css'
import './ScheduleV2Workspace.css'

const planned = 'planned_calls'
const sourceFormat = 'database_sample_bundle'
const progressLabels = { import: 'Đang nạp cuộc gọi…', schedule: 'Đang xếp lịch…', export: 'Đang xuất lịch…' }
type Operation = keyof typeof progressLabels

export function ScheduleV2Workspace() {
  const [draft, setDraft] = useState(emptyDraft)
  const [format, setFormat] = useState<CallsFormat>('csv')
  const [file, setFile] = useState<File>()
  const [sourceGroups, setSourceGroups] = useState('')
  const [sourceNotice, setSourceNotice] = useState<SourceImport['source']>()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [operation, setOperation] = useState<Operation>()
  const [result, setResult] = useState<ScheduleV2Response>()
  const [stale, setStale] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [plannedPage, setPlannedPage] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const resultHeading = useRef<HTMLElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const lock = useRef(false)
  const dates = useMemo(() => weekDates(draft.week), [draft.week])
  const slots = useMemo(() => operatingSlots(draft.operating.filter((interval) => dates.includes(interval.date))), [draft.operating, dates])
  const ids = [...new Set(draft.groups.map((group) => group.id.trim()).filter(Boolean))]
  const plannedRows = slots.flatMap((slot) => ids.map((id) => ({ ...slot, group_id: id })))
  const expected = new Set(plannedRows.map(callKey))
  const offGrid = Object.keys(draft.planned).filter((key) => draft.planned[key] !== '' && !expected.has(key))
  const missing = plannedRows.filter((row) => (draft.planned[callKey(row)] ?? '') === '').length
  const plannedPages = Math.max(1, Math.ceil(plannedRows.length / 48))
  const page = Math.min(plannedPage, plannedPages - 1)
  const busy = operation !== undefined

  const invalidate = () => {
    setStale(true)
    setError('')
    setNotice('')
  }
  function update(change: Partial<ScheduleDraft>) {
    setDraft((previous) => ({ ...previous, ...change }))
    if (change.week !== undefined || change.groups || change.history || change.window || change.mode) setSourceNotice(undefined)
    invalidate()
  }

  function changeFile(next?: File) {
    setFile(next)
    if (!next && fileInput.current) fileInput.current.value = ''
    invalidate()
  }

  useEffect(() => { if (result) resultHeading.current?.focus() }, [result])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])

  function reportError(message: string) {
    setError(message)
    errorRef.current?.focus()
  }

  async function perform(kind: Operation, action: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setError('')
    setNotice('')
    setOperation(kind)
    try {
      await action()
    } catch (reason) {
      reportError(reason instanceof Error ? reason.message : apiMessages.server)
    } finally {
      lock.current = false
      setOperation(undefined)
    }
  }

  function changeMode(mode: ScheduleV2Mode) {
    update({ mode })
    if (mode === planned && format === sourceFormat) setFormat('csv')
    changeFile()
  }

  function loadSample() {
    setDraft(draftFromRequest(scheduleV2Samples[draft.mode]))
    setAttempted(false)
    setSourceNotice(undefined)
    setPlannedPage(0)
    changeFile()
    if (format === sourceFormat) setFormat('csv')
    setNotice('Đã nạp cấu hình và dữ liệu tổng hợp để minh họa.')
  }

  async function loadCalls() {
    if (!file) return
    await perform('import', async () => {
      if (format === sourceFormat) {
        if (dates.length !== 7 || !validWindow(draft.window, draft.week)) {
          throw new Error('Chọn tuần lập lịch và khoảng lịch sử hợp lệ trước khi nạp ZIP.')
        }
        const groups = sourceGroups.split(/[,\n]/).map((id) => id.trim()).filter(Boolean)
        const imported = await importCalls(file, format, 'history', groups, { week: draft.week, window: draft.window })
        const nextGroups = imported.groups.map((group) => {
          const existing = draft.groups.find(({ id }) => id.trim() === group.id)
          const aht = imported.aht_by_group.find(({ group_id }) => group_id === group.id)
          return {
            ...blankGroup(), ...group, sla: existing?.sla ?? '', wait: existing?.wait ?? '',
            aht: aht ? String(aht.aht_seconds) : '', samples: aht ? String(aht.sample_count) : '', cutoff: aht?.cutoff_before ?? '',
          }
        })
        update({ groups: nextGroups, history: historyFromRows(imported.rows), window: imported.history_window })
        setSourceNotice(imported.source)
        setNotice(`Đã nạp ${imported.rows.length.toLocaleString('vi-VN')} quan sát và ${imported.groups.length} nhóm từ ZIP. Kiểm tra SLA, giờ hoạt động và kỹ năng.`)
      } else {
        const imported = await importCalls(file, format, draft.mode, draft.groups.map((g) => g.id.trim()))
        setSourceNotice(undefined)
        update(imported.mode === planned ? { planned: plannedFromRows(imported.rows) } : { history: historyFromRows(imported.rows) })
        setPlannedPage(0)
        setNotice(`Đã nạp ${imported.rows.length.toLocaleString('vi-VN')} dòng. Đối chiếu với lưới và cấu hình trước khi chạy.`)
      }
      setFile(undefined)
      if (fileInput.current) fileInput.current.value = ''
    })
  }

  async function runSchedule() {
    if (lock.current) return
    setAttempted(true)
    let request
    try {
      request = buildScheduleV2Request(draft)
    } catch (reason) {
      reportError(reason instanceof Error ? reason.message : apiMessages.invalidSchedule)
      return
    }
    setStale(true)
    await perform('schedule', async () => {
      setResult(await requestScheduleV2(request))
      setStale(false)
    })
  }

  async function downloadSchedule() {
    if (!result || stale || !hasSchedule(result.schedule.status)) return
    await perform('export', async () => {
      const { filename, blob } = await exportScheduleCsv(result)
      downloadBlob(filename, blob)
      setNotice('Đã chuẩn bị CSV lịch phân công.')
    })
  }

  return <div className="roster-app">
    <header className="roster-masthead"><div className="roster-width v2-masthead">Điều phối CSKH</div></header>
    <main className="roster-width roster-main">
      <div className="roster-page-heading"><h1>Xếp lịch tuần</h1></div>
      <form className="roster-surface v2-input" noValidate onSubmit={(event) => { event.preventDefault(); void runSchedule() }}>
        <fieldset className="v2-form-body" disabled={busy}>
          <section className="v2-form-section" aria-labelledby="v2-setup">
            <h2 id="v2-setup">Tuần và nguồn nhu cầu</h2>
            <div className="v2-controls">
              <label className="roster-field">Nguồn nhu cầu<select aria-label="Nguồn nhu cầu" value={draft.mode} onChange={(event) => changeMode(event.currentTarget.value as ScheduleV2Mode)}>
                <option value={planned}>Cuộc gọi dự kiến</option><option value="history">Dự báo từ lịch sử</option>
              </select></label>
              <Field label="Thứ Hai bắt đầu tuần" type="date" value={draft.week} onChange={(week) => update({ week })} />
              <Button onClick={loadSample}>Thay bằng cấu hình mẫu</Button>
            </div>
            <p>Mỗi dòng nhu cầu ứng với 30 phút. Thiết lập lịch và các giới hạn trước khi chạy.</p>
          </section>
          <section className="v2-form-section" aria-labelledby="v2-groups">
            <h2 id="v2-groups">Nhóm dịch vụ và mục tiêu</h2>
            <GroupEditor attempted={attempted} groups={draft.groups} onChange={(groups) => update({ groups })} />
          </section>
          <section className="v2-form-section" aria-labelledby="v2-operating">
            <h2 id="v2-operating">Giờ hoạt động</h2>
            <OperatingEditor dates={dates} intervals={draft.operating} onChange={(operating) => update({ operating })} />
          </section>
          <section className="v2-form-section" aria-labelledby="v2-calls">
            <h2 id="v2-calls">{draft.mode === planned ? 'Cuộc gọi dự kiến' : 'Quan sát lịch sử'}</h2>
            {draft.mode === 'history' && <div className="v2-field-grid">
              <Field label="Lịch sử từ ngày" type="date" value={draft.window.start_date} onChange={(start_date) => update({ window: { ...draft.window, start_date } })} />
              <Field label="Lịch sử đến trước ngày" type="date" value={draft.window.end_date} onChange={(end_date) => update({ window: { ...draft.window, end_date } })} />
            </div>}
            <fieldset className="v2-file-group"><legend>Nhập tệp cuộc gọi</legend>
              <div className="v2-controls">
                <label className="roster-field">Định dạng tệp<select aria-label="Định dạng tệp" value={format} onChange={(event) => { setFormat(event.currentTarget.value as CallsFormat); changeFile() }}>
                  <option value="csv">CSV</option><option value="xlsx">XLSX</option>
                  {draft.mode === 'history' && <option value={sourceFormat}>Database Sample (ZIP)</option>}
                </select></label>
                <label className="roster-field v2-file-field">Tệp cuộc gọi<input ref={fileInput} type="file" accept={fileExtension(format)}
                  onChange={(event) => changeFile(event.currentTarget.files?.[0])} /></label>
                <Button disabled={!file} onClick={() => void loadCalls()}>Nạp cuộc gọi</Button>
              </div>
              {format === sourceFormat ? <>
                <p><a href={databaseSampleUrl} className="roster-link">Database Sample</a> là dữ liệu tổng hợp theo CC0. ZIP cần đúng hai tệp gốc <code>calls.csv</code> và <code>queues.csv</code>. Nạp ZIP thay nhóm, lịch sử và AHT. Giờ hoạt động, danh sách nhân viên và ca do bạn cấu hình.</p>
                <Field label="Mã nhóm nguồn (tùy chọn, cách nhau bằng dấu phẩy)" value={sourceGroups} onChange={(value) => { setSourceGroups(value); invalidate() }} />
              </> : <p>CSV/XLSX cần cột <code>date,start,group_id,calls</code> theo thứ tự này. XLSX dùng sheet <code>calls</code>. Nạp tệp thay dữ liệu cuộc gọi của chế độ đang chọn.</p>}
              {sourceNotice && <p>API nhập tệp đã xác minh hai tệp gốc và tạo {sourceNotice.derived_zero_counts.date_start_queue_cells.toLocaleString('vi-VN')} dòng 0 trong phạm vi nguồn. Xác minh này thuộc lần nạp tệp.</p>}
            </fieldset>
            {draft.mode === planned ? <>
              <p>{plannedRows.length} khoảng theo nhóm · {missing} ô chưa điền. Chỉ nhập 0 nếu xác nhận khoảng đó không có cuộc gọi.</p>
              {offGrid.length > 0 && <div className="v2-inline-warning" role="status">
                <p>{offGrid.length} dòng cuộc gọi ngoài lưới. Dòng đầu: {JSON.parse(offGrid[0]).join(' · ')}.</p>
                <Button onClick={() => update({ planned: Object.fromEntries(Object.entries(draft.planned).filter(([key]) => expected.has(key))) })}>Xóa các dòng ngoài lưới</Button>
              </div>}
              <div className="v2-field-grid">
                {plannedRows.slice(page * 48, (page + 1) * 48).map((row) => {
                  const key = callKey(row)
                  return <Field key={key} label={`${displayDate(row.date)} · ${row.start} · ${row.group_id}`} type="number" min={0} step="any"
                    value={draft.planned[key] ?? ''} onChange={(value) => update({ planned: { ...draft.planned, [key]: value } })} />
                })}
              </div>
              {plannedPages > 1 && <div className="v2-controls">
                <Button disabled={page === 0} onClick={() => setPlannedPage(page - 1)}>Trang trước</Button>
                <span aria-live="polite">Trang {page + 1}/{plannedPages}</span>
                <Button disabled={page + 1 === plannedPages} onClick={() => setPlannedPage(page + 1)}>Trang sau</Button>
              </div>}
            </> : <HistoryEditor rows={draft.history} groups={ids} onChange={(history) => update({ history })} />}
          </section>
          <section className="v2-form-section" aria-labelledby="v2-employees">
            <h2 id="v2-employees">Nhân viên và giờ rảnh</h2>
            <EmployeeEditor employees={draft.employees} onChange={(employees) => update({ employees })} groups={draft.groups}
              dates={dates} slots={slots} intervals={draft.operating} />
            <Check label="Cho phép điều chuyển khác kỹ năng nếu cần" checked={draft.fallback} onChange={(fallback) => update({ fallback })} />
          </section>
          <section className="v2-form-section" aria-labelledby="v2-shifts">
            <h2 id="v2-shifts">Ca ứng viên</h2>
            <ShiftEditor dates={dates} shifts={draft.shifts} onChange={(shifts) => update({ shifts })} />
          </section>
          <div className="v2-controls v2-submit-row">
            <Button type="submit" variant="primary">Chạy xếp lịch</Button>
            <Button disabled={!result || stale || !hasSchedule(result.schedule.status)} onClick={() => void downloadSchedule()}>Tải lịch mới nhất (CSV)</Button>
          </div>
        </fieldset>
        {error && <div ref={errorRef} tabIndex={-1} className="v2-error" role="alert">{error}</div>}
        <div className="v2-progress" role="status">{operation ? progressLabels[operation] : notice}</div>
      </form>
      {result && <>
        {stale && <p className="v2-inline-warning" role="status">Kết quả cũ. Chạy lại để xem lịch mới và mở nút tải CSV.</p>}
        <ScheduleV2Result result={result} headingRef={resultHeading} />
      </>}
    </main>
  </div>
}
