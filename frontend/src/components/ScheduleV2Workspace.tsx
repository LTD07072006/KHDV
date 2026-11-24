import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './ui/button'
import { Check, EmployeeEditor, Field, GroupEditor, GroupTargets, HistoryEditor, OperatingEditor, ShiftEditor } from './ScheduleIntervalEditors'
import { ScheduleV2Result } from './ScheduleV2Result'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import { downloadBlob } from '@/lib/downloadFile'
import {
  buildConfigTemplateCsv, enrichExportCsvWithSkillStatus, parseEmployeesCsv, parseGroupsCsv,
  parseOperatingCsv, parseShiftsCsv, readCsvFileText, type ConfigCsvKind,
} from '@/lib/scheduleV2CsvImport'
import { clearSavedDraft, loadSavedDraft, parseDraftJson, saveDraft, serializeDraftJson } from '@/lib/scheduleV2DraftStorage'
import { apiMessages, callKey, hasSchedule, requestScheduleV2, type ScheduleV2Mode, type ScheduleV2Response } from '@/services/scheduleV2'
import { databaseSampleUrl, exportScheduleCsv, fileExtension, importCalls, type CallsFormat, type SourceImport } from '@/services/scheduleV2Files'
import {
  blankGroup, buildScheduleV2Request, displayDate, draftFromRequest, emptyDraft, estimateAssignmentVariables,
  historyFromRows, MAX_ASSIGNMENT_VARIABLES, numericError, operatingSlots, plannedFromRows,
  syncWildcardEmployees, validWindow, weekDates, type ScheduleDraft,
} from '@/services/scheduleV2Form'
import './WorkspaceTables.css'
import './ScheduleV2Workspace.css'

const planned = 'planned_calls'
const sourceFormat = 'database_sample_bundle'
const progressLabels = { import: 'Đang nạp cuộc gọi…', schedule: 'Đang xếp lịch…', export: 'Đang xuất lịch…' }
type Operation = keyof typeof progressLabels

function SectionCsvBar({
  label,
  hint,
  onPick,
  onDownloadTemplate,
}: {
  label: string
  hint: string
  onPick: (file?: File) => void
  onDownloadTemplate: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return <div className="v2-csv-bar">
    <Button onClick={() => inputRef.current?.click()}>{label}</Button>
    <input
      ref={inputRef}
      type="file"
      accept=".csv,text/csv"
      className="sr-only"
      aria-label={label}
      onChange={(event) => {
        const picked = event.currentTarget.files?.[0]
        onPick(picked)
        event.currentTarget.value = ''
      }}
    />
    <button type="button" className="roster-link v2-csv-template-btn" onClick={onDownloadTemplate}>Tải mẫu CSV</button>
    <span className="v2-csv-hint">{hint}</span>
  </div>
}

export function ScheduleV2Workspace() {
  const initialDraft = useMemo(() => loadSavedDraft(), [])
  const [draft, setDraft] = useState<ScheduleDraft>(() => initialDraft ?? emptyDraft())
  const [format, setFormat] = useState<CallsFormat>('csv')
  const [file, setFile] = useState<File>()
  const [sourceGroups, setSourceGroups] = useState('')
  const [sourceNotice, setSourceNotice] = useState<SourceImport['source']>()
  const [notice, setNotice] = useState(() => initialDraft ? 'Đã khôi phục bản nháp gần nhất trên trình duyệt.' : '')
  const [error, setError] = useState('')
  const [operation, setOperation] = useState<Operation>()
  const [result, setResult] = useState<ScheduleV2Response>()
  const [submittedSkills, setSubmittedSkills] = useState<Record<string, string[]>>()
  const [stale, setStale] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [focusInvalid, setFocusInvalid] = useState(0)
  const [plannedPage, setPlannedPage] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const configInput = useRef<HTMLInputElement>(null)
  const resultHeading = useRef<HTMLElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const lock = useRef(false)
  const solveController = useRef<AbortController | null>(null)

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

  useEffect(() => {
    saveDraft(draft)
  }, [draft])

  const invalidate = () => {
    setStale(true)
    setError('')
    setNotice('')
  }
  function update(change: Partial<ScheduleDraft>) {
    setDraft((previous) => {
      const next = { ...previous, ...change }
      if (change.operating || change.week !== undefined) {
        const nextDates = weekDates(next.week)
        const nextSlots = operatingSlots(next.operating.filter((interval) => nextDates.includes(interval.date)))
        next.employees = syncWildcardEmployees(next.employees, nextSlots)
      }
      return next
    })
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
  useEffect(() => {
    if (!focusInvalid) return
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (!field) return errorRef.current?.focus()
    for (let parent = field.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true
    }
    field.focus()
  }, [focusInvalid])

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
      const message = reason instanceof Error ? reason.message : apiMessages.server
      if (message === apiMessages.cancelled) setNotice(message)
      else reportError(message)
    } finally {
      lock.current = false
      solveController.current = null
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

  function resetDraft() {
    clearSavedDraft()
    setDraft(emptyDraft())
    setAttempted(false)
    setSourceNotice(undefined)
    setPlannedPage(0)
    setResult(undefined)
    setSubmittedSkills(undefined)
    setStale(false)
    changeFile()
    setNotice('Đã đặt lại biểu mẫu về trạng thái trống.')
  }

  function exportConfig() {
    const filename = `cau-hinh-tuan-${draft.week || 'nhap'}.json`
    downloadBlob(filename, serializeDraftJson(draft))
    setNotice(`Đã tải tệp cấu hình ${filename}.`)
  }

  async function importConfig(picked?: File) {
    if (!picked) return
    try {
      const loaded = parseDraftJson(await picked.text())
      setDraft(loaded)
      setAttempted(false)
      setSourceNotice(undefined)
      setPlannedPage(0)
      setStale(true)
      setError('')
      setNotice(`Đã nạp cấu hình từ tệp ${picked.name}.`)
    } catch (reason) {
      reportError(reason instanceof Error ? reason.message : 'Không đọc được tệp cấu hình JSON.')
    } finally {
      if (configInput.current) configInput.current.value = ''
    }
  }

  function fillMissingZeros() {
    const filled = { ...draft.planned }
    for (const row of plannedRows) {
      const key = callKey(row)
      if ((filled[key] ?? '') === '') filled[key] = '0'
    }
    update({ planned: filled })
    setNotice(`Đã điền 0 cho ${missing} khung 30 phút chưa nhập.`)
  }

  function cancelSchedule() {
    solveController.current?.abort()
  }

  function downloadTemplateCsv(kind: ConfigCsvKind) {
    const { filename, blob } = buildConfigTemplateCsv(kind, dates[0] ?? draft.week)
    downloadBlob(filename, blob)
    setNotice(`Đã tải tệp mẫu ${filename}.`)
  }

  async function importSectionCsv(kind: ConfigCsvKind, picked?: File) {
    if (!picked) return
    try {
      const text = await readCsvFileText(picked)
      if (kind === 'groups') {
        const groups = parseGroupsCsv(text)
        update({ groups })
        setNotice(`Đã nhập ${groups.length} nhóm tiếp nhận từ tệp ${picked.name}.`)
      } else if (kind === 'operating') {
        const operating = parseOperatingCsv(text)
        update({ operating })
        setNotice(`Đã nhập ${operating.length} khoảng hoạt động từ tệp ${picked.name}.`)
      } else if (kind === 'employees') {
        const employees = parseEmployeesCsv(text, slots)
        update({ employees })
        const wildcardCount = employees.filter((employee) => employee.allAvailable).length
        setNotice(
          slots.length === 0 && wildcardCount > 0
            ? `Đã nhập ${employees.length} nhân viên. Giờ rảnh sẽ tự cập nhật khi bạn nhập Giờ hoạt động.`
            : `Đã nhập ${employees.length} nhân viên từ tệp ${picked.name}.`,
        )
      } else {
        const shifts = parseShiftsCsv(text)
        update({ shifts })
        setNotice(`Đã nhập ${shifts.length} ca ứng viên từ tệp ${picked.name}.`)
      }
    } catch (reason) {
      reportError(reason instanceof Error ? reason.message : 'Không đọc được tệp CSV.')
    }
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
          const defaults = blankGroup()
          return {
            ...defaults, ...group, sla: existing?.sla ?? defaults.sla, wait: existing?.wait ?? defaults.wait,
            aht: aht ? String(aht.aht_seconds) : defaults.aht, samples: aht ? String(aht.sample_count) : '', cutoff: aht?.cutoff_before ?? '',
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

  async function runSchedule(overrideDraft?: ScheduleDraft) {
    if (lock.current) return
    const activeDraft = overrideDraft ?? draft
    setAttempted(true)
    let request
    try {
      request = buildScheduleV2Request(activeDraft)
    } catch (reason) {
      const invalidRow = plannedRows.findIndex((row) => numericError(activeDraft.planned[callKey(row)] ?? '', 0))
      if (activeDraft.mode === planned && invalidRow >= 0) setPlannedPage(Math.floor(invalidRow / 48))
      reportError(reason instanceof Error ? reason.message : apiMessages.invalidSchedule)
      setFocusInvalid((attempt) => attempt + 1)
      return
    }
    setStale(true)
    await perform('schedule', async () => {
      const controller = new AbortController()
      solveController.current = controller
      const response = await requestScheduleV2(request, controller.signal)
      setSubmittedSkills(Object.fromEntries(request.employees.map((employee) => [employee.id, [...employee.skills]])))
      setResult(response)
      setStale(false)
    })
  }

  function retryWithSoftCoverage() {
    const nextDraft: ScheduleDraft = { ...draft, allowUnderstaffing: true }
    setDraft(nextDraft)
    void runSchedule(nextDraft)
  }

  function retryWithLongerSolve() {
    const nextDraft: ScheduleDraft = { ...draft, solve: '30' }
    setDraft(nextDraft)
    void runSchedule(nextDraft)
  }

  async function downloadSchedule() {
    if (!result || stale || !hasSchedule(result.schedule.status)) return
    await perform('export', async () => {
      const { filename, blob } = await exportScheduleCsv(result)
      const finalBlob = (result.schedule.skill_mismatch_slots ?? 0) > 0 && submittedSkills
        ? await enrichExportCsvWithSkillStatus(blob, submittedSkills)
        : blob
      downloadBlob(filename, finalBlob)
      setNotice(
        (result.schedule.skill_mismatch_slots ?? 0) > 0
          ? 'Đã chuẩn bị CSV lịch phân công (kèm cột Trạng thái kỹ năng).'
          : 'Đã chuẩn bị CSV lịch phân công.',
      )
    })
  }

  const estimatedVars = useMemo(() => estimateAssignmentVariables(draft), [draft])
  const modelOverBudget = estimatedVars > MAX_ASSIGNMENT_VARIABLES
  const modelNearBudget = !modelOverBudget && estimatedVars > 200_000

  const callsReady = draft.mode === planned ? plannedRows.length > 0 && missing === 0 : draft.history.length > 0
  const canExport = Boolean(result && !stale && hasSchedule(result.schedule.status))

  return <div className="roster-app">
    <header className="roster-masthead"><div className="roster-width v2-masthead">Điều phối CSKH</div></header>
    <main className="roster-width roster-main">
      <div className="roster-page-heading">
        <h1>Xếp lịch tuần</h1>
      </div>

      <nav className="v2-quick-nav print:hidden" aria-label="Điều hướng nhanh các mục cấu hình">
        <a href="#v2-groups" className="v2-nav-chip" data-ready={ids.length > 0}>Nhóm ({ids.length})</a>
        <a href="#v2-operating" className="v2-nav-chip" data-ready={slots.length > 0}>Giờ hoạt động ({slots.length})</a>
        <a href="#v2-calls" className="v2-nav-chip" data-ready={callsReady}>
          {draft.mode === planned ? (missing > 0 ? `Cuộc gọi (thiếu ${missing})` : `Cuộc gọi (${plannedRows.length})`) : `Lịch sử (${draft.history.length})`}
        </a>
        <a href="#v2-employees" className="v2-nav-chip" data-ready={draft.employees.length > 0}>Nhân viên ({draft.employees.length})</a>
        <a href="#v2-shifts" className="v2-nav-chip" data-ready={draft.shifts.length > 0}>Ca làm ({draft.shifts.length})</a>
        {result && <a href="#v2-results" className="v2-nav-chip v2-nav-chip-result" data-ready={hasSchedule(result.schedule.status)}>Kết quả</a>}
      </nav>

      <form ref={formRef} className="roster-surface v2-input" noValidate onSubmit={(event) => { event.preventDefault(); void runSchedule() }}>
        <fieldset className="v2-form-body" disabled={busy}>
          <section className="v2-form-section" aria-labelledby="v2-setup">
            <h2 id="v2-setup">Tuần và nguồn nhu cầu</h2>
            <div className="v2-controls">
              <label className="roster-field">Nguồn nhu cầu<select aria-label="Nguồn nhu cầu" value={draft.mode} onChange={(event) => changeMode(event.currentTarget.value as ScheduleV2Mode)}>
                <option value={planned}>Cuộc gọi dự kiến</option><option value="history">Dự báo từ lịch sử</option>
              </select></label>
              <Field label="Thứ Hai bắt đầu tuần" type="date" value={draft.week} onChange={(week) => update({ week })} attempted={attempted}
                error={dates.length !== 7 ? 'Chọn ngày thứ Hai của tuần bạn muốn xếp lịch.' : undefined} />
              <Button onClick={loadSample}>Thay bằng cấu hình mẫu</Button>
            </div>
            <div className="v2-config-tools">
              <Button onClick={exportConfig}>Lưu cấu hình (.json)</Button>
              <Button onClick={() => configInput.current?.click()}>Nạp cấu hình (.json)</Button>
              <input ref={configInput} type="file" accept=".json,application/json" className="sr-only" aria-label="Chọn tệp cấu hình JSON"
                onChange={(event) => void importConfig(event.currentTarget.files?.[0])} />
              <Button onClick={resetDraft}>Đặt lại form</Button>
              <span className="v2-autosave-hint">Tự động lưu nháp trên trình duyệt</span>
            </div>
            <p>Mỗi dòng nhu cầu ứng với 30 phút. Thiết lập lịch và các giới hạn trước khi chạy.</p>
          </section>
          <section className="v2-form-section" aria-labelledby="v2-groups">
            <h2 id="v2-groups">Nhóm tiếp nhận cuộc gọi</h2>
            <SectionCsvBar
              label="Nhập nhóm từ CSV"
              hint="Cột: id, name (tùy chọn: target_sla_percent, waiting_seconds, aht_seconds, sample_count, cutoff_before)"
              onPick={(picked) => void importSectionCsv('groups', picked)}
              onDownloadTemplate={() => downloadTemplateCsv('groups')}
            />
            <GroupEditor attempted={attempted} groups={draft.groups} onChange={(groups) => update({ groups })} />
          </section>
          <section className="v2-form-section" aria-labelledby="v2-operating">
            <h2 id="v2-operating">Giờ hoạt động</h2>
            <SectionCsvBar
              label="Nhập giờ hoạt động từ CSV"
              hint="Cột: date, start, end (YYYY-MM-DD, HH:MM theo mốc 30 phút)"
              onPick={(picked) => void importSectionCsv('operating', picked)}
              onDownloadTemplate={() => downloadTemplateCsv('operating')}
            />
            <OperatingEditor dates={dates} intervals={draft.operating} attempted={attempted} onChange={(operating) => update({ operating })} />
          </section>
          <section className="v2-form-section" aria-labelledby="v2-calls">
            <h2 id="v2-calls">{draft.mode === planned ? 'Cuộc gọi dự kiến' : 'Quan sát lịch sử'}</h2>
            {draft.mode === 'history' && <div className="v2-field-grid">
              <Field label="Lịch sử từ ngày" type="date" value={draft.window.start_date} attempted={attempted} error={!draft.window.start_date ? 'Chọn ngày bắt đầu.' : undefined} onChange={(start_date) => update({ window: { ...draft.window, start_date } })} />
              <Field label="Lịch sử đến trước ngày" type="date" value={draft.window.end_date} attempted={attempted}
                error={!draft.window.end_date ? 'Chọn ngày kết thúc.' : draft.window.end_date <= draft.window.start_date || draft.window.end_date > draft.week ? 'Chọn ngày sau ngày bắt đầu và không sau ngày đầu tuần xếp lịch.' : undefined}
                onChange={(end_date) => update({ window: { ...draft.window, end_date } })} />
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
              {format !== sourceFormat && <div className="v2-template-links">
                <span>Tải tệp mẫu:</span>
                <a className="roster-link" href={`${import.meta.env.BASE_URL}templates/calls.csv`} download="mau-cuoc-goi.csv">CSV</a>
                <a className="roster-link" href={`${import.meta.env.BASE_URL}templates/calls.xlsx`} download="mau-cuoc-goi.xlsx">Excel (.xlsx)</a>
                <p>Thay ngày, giờ, mã nhóm và số cuộc gọi mẫu bằng dữ liệu của bạn.</p>
              </div>}
              {format === sourceFormat ? <>
                <p><a href={databaseSampleUrl} className="roster-link">Database Sample</a> là dữ liệu tổng hợp theo CC0. ZIP cần đúng hai tệp gốc <code>calls.csv</code> và <code>queues.csv</code>. Nạp ZIP thay nhóm, lịch sử và AHT. Giờ hoạt động, danh sách nhân viên và ca do bạn cấu hình.</p>
                <Field label="Mã nhóm nguồn (tùy chọn, cách nhau bằng dấu phẩy)" value={sourceGroups} onChange={(value) => { setSourceGroups(value); invalidate() }} />
              </> : <p>CSV/XLSX cần cột <code>date,start,group_id,calls</code> theo thứ tự này. XLSX dùng sheet <code>calls</code>. Nạp tệp thay dữ liệu cuộc gọi của chế độ đang chọn.</p>}
              {sourceNotice && <p>API nhập tệp đã xác minh hai tệp gốc và tạo {sourceNotice.derived_zero_counts.date_start_queue_cells.toLocaleString('vi-VN')} dòng 0 trong phạm vi nguồn. Xác minh này thuộc lần nạp tệp.</p>}
            </fieldset>
            {draft.mode === planned ? <>
              <div className="v2-calls-summary">
                <p>{plannedRows.length} khoảng theo nhóm · {missing} ô chưa điền. Chỉ nhập 0 nếu xác nhận khoảng đó không có cuộc gọi.</p>
                {missing > 0 && <Button onClick={fillMissingZeros}>Điền 0 cho {missing} ô trống</Button>}
              </div>
              {offGrid.length > 0 && <div className="v2-inline-warning" role="status">
                <p>{offGrid.length} dòng cuộc gọi ngoài lưới. Dòng đầu: {JSON.parse(offGrid[0]).join(' · ')}.</p>
                <Button onClick={() => update({ planned: Object.fromEntries(Object.entries(draft.planned).filter(([key]) => expected.has(key))) })}>Xóa các dòng ngoài lưới</Button>
              </div>}
              <div className="v2-field-grid">
                {plannedRows.slice(page * 48, (page + 1) * 48).map((row) => {
                  const key = callKey(row)
                  return <Field key={key} label={`${displayDate(row.date)} · ${row.start} · ${row.group_id}`} type="number" min={0} step="any"
                    value={draft.planned[key] ?? ''} attempted={attempted} error={numericError(draft.planned[key] ?? '', 0)}
                    onChange={(value) => update({ planned: { ...draft.planned, [key]: value } })} />
                })}
              </div>
              {plannedPages > 1 && <div className="v2-controls">
                <Button disabled={page === 0} onClick={() => setPlannedPage(page - 1)}>Trang trước</Button>
                <span aria-live="polite">Trang {page + 1}/{plannedPages}</span>
                <Button disabled={page + 1 === plannedPages} onClick={() => setPlannedPage(page + 1)}>Trang sau</Button>
              </div>}
            </> : <HistoryEditor rows={draft.history} groups={ids} attempted={attempted} window={draft.window} onChange={(history) => update({ history })} />}
          </section>
          <section className="v2-form-section" aria-labelledby="v2-employees">
            <h2 id="v2-employees">Nhân viên và giờ rảnh</h2>
            <SectionCsvBar
              label="Nhập nhân viên từ CSV"
              hint="Cột: id, skills (;), max_shift_minutes_per_week (tùy chọn: min_days_off_per_week, unavailable_dates, available_intervals hoặc *)"
              onPick={(picked) => void importSectionCsv('employees', picked)}
              onDownloadTemplate={() => downloadTemplateCsv('employees')}
            />
            <EmployeeEditor employees={draft.employees} onChange={(employees) => update({ employees })} groups={draft.groups}
              dates={dates} slots={slots} intervals={draft.operating} attempted={attempted} />
            <div className="v2-checkbox-stack">
              <Check label="Cho phép điều chuyển khác kỹ năng nếu cần" checked={draft.fallback} onChange={(fallback) => update({ fallback })} />
              <Check
                label="Vẫn xếp lịch khi thiếu nhân sự"
                checked={Boolean(draft.allowUnderstaffing)}
                onChange={(allowUnderstaffing) => update({ allowUnderstaffing })}
              />
            </div>
          </section>
          <section className="v2-form-section" aria-labelledby="v2-shifts">
            <h2 id="v2-shifts">Ca làm có thể phân công</h2>
            <SectionCsvBar
              label="Nhập ca làm từ CSV"
              hint="Cột: date, start, end (tùy chọn: breaks dạng 10:00-10:30;14:00-14:30)"
              onPick={(picked) => void importSectionCsv('shifts', picked)}
              onDownloadTemplate={() => downloadTemplateCsv('shifts')}
            />
            <ShiftEditor dates={dates} shifts={draft.shifts} attempted={attempted} onChange={(shifts) => update({ shifts })} />
          </section>
          <details className="v2-disclosure v2-advanced-settings">
            <summary>Cài đặt nâng cao <span>· Không bắt buộc</span></summary>
            <p>Nhóm mới dùng mục tiêu trả lời 80% trong 20 giây và thời gian xử lý ước tính 5 phút. Bạn có thể giữ nguyên để xếp lịch.</p>
            {draft.groups.map((group, index) => <fieldset className="v2-editor" key={index}>
              <legend>{group.name.trim() || `Nhóm ${index + 1}`}{group.samples && group.cutoff ? ' · Có số liệu đo' : ' · Ước tính'}</legend>
              <GroupTargets group={group} week={draft.week} attempted={attempted} onChange={(next) => update({ groups: draft.groups.map((item, i) => i === index ? next : item) })} />
            </fieldset>)}
            <Field label="Thời gian tìm lịch tối đa (giây)" value={draft.solve} type="number" min={1} max={30} attempted={attempted}
              onChange={(solve) => update({ solve })} error={numericError(draft.solve, 1, 30, true)} help="Thời gian hệ thống được phép tìm phương án phân ca. Mặc định 10 giây." />
          </details>
        </fieldset>

        {(modelOverBudget || modelNearBudget) && (
          <div className="v2-inline-warning" role="status">
            <p>
              {modelOverBudget
                ? `Cấu hình vượt giới hạn xử lý (${estimatedVars.toLocaleString('vi-VN')} / ${MAX_ASSIGNMENT_VARIABLES.toLocaleString('vi-VN')} tổ hợp). Giảm bớt số ca ứng viên hoặc tắt điều chuyển khác kỹ năng để chạy.`
                : `Cấu hình khá lớn (~${estimatedVars.toLocaleString('vi-VN')} / ${MAX_ASSIGNMENT_VARIABLES.toLocaleString('vi-VN')} tổ hợp). Nếu chạy chậm, có thể tăng thời gian tìm lịch trong Cài đặt nâng cao.`}
            </p>
          </div>
        )}

        <div className="v2-controls v2-submit-row print:hidden">
          <Button type="submit" variant="primary" disabled={busy || modelOverBudget}>Chạy xếp lịch</Button>
          {operation === 'schedule' && <Button onClick={cancelSchedule}>Hủy chạy</Button>}
          <Button disabled={busy || !canExport} onClick={() => void downloadSchedule()}>Tải lịch mới nhất (CSV)</Button>
          {canExport && <Button onClick={() => window.print()}>In lịch</Button>}
        </div>

        {error && <div ref={errorRef} tabIndex={-1} className="v2-error" role="alert">{error}</div>}
        <div className="v2-progress" role="status">{operation ? progressLabels[operation] : notice}</div>
      </form>
      {result && <div id="v2-results">
        {stale && <p className="v2-inline-warning" role="status">Kết quả cũ. Chạy lại để xem lịch mới và mở nút tải CSV.</p>}
        <ScheduleV2Result
          result={result}
          headingRef={resultHeading}
          employeeSkills={submittedSkills}
          solveSeconds={Number(draft.solve) || 10}
          onRetrySoft={!draft.allowUnderstaffing && result.schedule.status === 'INFEASIBLE' ? retryWithSoftCoverage : undefined}
          onRetryLonger={(result.schedule.status === 'FEASIBLE' || result.schedule.status === 'UNKNOWN') && (Number(draft.solve) || 10) < 30 ? retryWithLongerSolve : undefined}
        />
      </div>}
    </main>
  </div>
}
