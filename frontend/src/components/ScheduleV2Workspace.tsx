import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { NoticeBox } from '@/components/NoticeBox'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import { scheduleV2Coverage } from '@/lib/scheduleV2Coverage'
import { downloadBlob } from '@/lib/downloadFile'
import { exportScheduleCsv, fileMessages, type CallsFormat } from '@/services/scheduleV2Files'
import {
  hasSchedule, requestScheduleV2, scheduleV2Messages,
  type ScheduleV2Mode, type ScheduleV2Response, type SolverV2Status,
} from '@/services/scheduleV2'
import {
  callKey, dateKey, draftFromRequest, emptyScheduleDraft, isValidSlaPercent, operatingHoursFor,
  operatingSlotsFor, parseGroups, validShiftStarts, weekDates, type EmployeeDraft, type ScheduleV2Draft,
} from '@/services/scheduleV2Form'
import { canExportScheduleResult, importCallsIntoScheduleDraft, markScheduleResultStale, prepareScheduleRequest } from '@/services/scheduleV2WorkspaceState'
import './WorkspaceTables.css'
import './ScheduleV2Workspace.css'

const statusText: Record<SolverV2Status, string> = {
  OPTIMAL: 'Đã chứng minh tối ưu',
  FEASIBLE: 'Có lịch khả thi, chưa chứng minh tối ưu',
  INFEASIBLE: 'Không có lịch thỏa ràng buộc',
  UNKNOWN: 'Chưa xác định được kết quả',
  MODEL_INVALID: 'Mô hình xếp lịch không hợp lệ',
}
const count = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 })
const dateText = (date: string) => date.split('-').reverse().join('/')
const hourText = (hour: number) => String(hour).padStart(2, '0') + ':00'
const hourKey = (row: { date: string; hour: number; group_id: string }) =>
  JSON.stringify([row.date, row.hour, row.group_id])

function ResultTable({ title, columns, children }: {
  title: string
  columns: string[]
  children: ReactNode
}) {
  return (
    <section className="v2-result-section">
      <h3>{title}</h3>
      <div className="roster-table-scroll" role="region" aria-label={title} tabIndex={0}>
        <table className="roster-data-table v2-table" aria-label={title}>
          <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  )
}

export function ScheduleV2Result({ result }: { result: ScheduleV2Response }) {
  const { schedule } = result
  const available = hasSchedule(schedule.status)
  const coverage = scheduleV2Coverage(result)

  return (
    <section className="roster-surface v2-results" aria-label="Kết quả từ API">
      <div className="v2-result-summary" data-available={available} role="status">
        <h2>{statusText[schedule.status]} <code>{schedule.status}</code></h2>
        {schedule.stage_two_status && <p>Giai đoạn 2: <code>{schedule.stage_two_status}</code></p>}
        {schedule.message && <p>{schedule.message}</p>}
      </div>
      {!!schedule.warnings?.length && (
        <div className="v2-warnings">
          <h3>Cảnh báo</h3>
          <ul>{schedule.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </div>
      )}

      <ResultTable title="Nhu cầu và Erlang C theo giờ" columns={[
        'Ngày', 'Giờ bắt đầu', 'Nhóm', 'Cuộc gọi/giờ', 'Số mẫu', 'Người cần', 'SLA theo số người cần',
      ]}>
        {result.hourly_results.map((row) => (
          <tr key={hourKey(row)}>
            <td>{dateText(row.date)}</td><td>{hourText(row.hour)}</td><td>{row.group_id}</td>
            <td>{count.format(row.calls_per_hour)}</td><td>{row.sample_count ?? '—'}</td>
            <td>{row.erlang.required_staff}</td>
            <td>{row.erlang.service_level === null ? '—' : percent.format(row.erlang.service_level)}</td>
          </tr>
        ))}
      </ResultTable>
      {result.forecast && (
        <ResultTable title="Dự báo từ lịch sử" columns={['Ngày', 'Giờ bắt đầu', 'Nhóm', 'Cuộc gọi dự báo', 'Số mẫu']}>
          {result.forecast.forecasts.map((row) => (
            <tr key={hourKey(row)}>
              <td>{dateText(row.date)}</td><td>{hourText(row.hour)}</td><td>{row.group_id}</td>
              <td>{count.format(row.forecast_calls)}</td><td>{row.sample_count}</td>
            </tr>
          ))}
        </ResultTable>
      )}
      <ResultTable title="Độ phủ theo khung 30 phút" columns={['Ngày', 'Giờ bắt đầu', 'Nhóm', 'Người cần', 'Đã xếp']}>
        {coverage.map((row) => (
          <tr key={row.key}>
            <td>{dateText(row.date)}</td><td>{row.start}</td><td>{row.group_id}</td>
            <td>{row.required_staff}</td><td>{row.assigned ?? '—'}</td>
          </tr>
        ))}
      </ResultTable>
      {available && (
        <ResultTable title="Lịch phân công theo ca 90 phút" columns={['Nhân viên', 'Ngày', 'Ca', 'Nhóm theo khung 30 phút']}>
          {schedule.assignments.length === 0 && <tr><td colSpan={4}>Kết quả không có ca được phân công.</td></tr>}
          {schedule.assignments.map((shift) => (
            <tr key={JSON.stringify([shift.employee_id, shift.date, shift.start])}>
              <th scope="row">{shift.employee_id}</th><td>{dateText(shift.date)}</td>
              <td>{shift.start}–{shift.end}</td>
              <td><ul className="v2-shift-slots">{shift.groups_by_slot.map((slot) => (
                <li key={slot.start}>{slot.start} · {slot.group_id}</li>
              ))}</ul></td>
            </tr>
          ))}
        </ResultTable>
      )}
    </section>
  )
}

const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']
const localMonday = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const timeOptions = (max: number) => Array.from({ length: max + 1 }, (_, hour) => hour)
const invalidNumber = (value: string, options: { integer?: boolean; min?: number; max?: number } = {}) => {
  if (!value.trim()) return true
  const number = Number(value)
  return !Number.isFinite(number) || (options.integer && !Number.isInteger(number)) ||
    (options.min !== undefined && number < options.min) || (options.max !== undefined && number > options.max)
}

export function ScheduleV2Workspace({ onOpenDemo }: { onOpenDemo: () => void }) {
  const [draft, setDraft] = useState<ScheduleV2Draft>(() => emptyScheduleDraft('planned_calls', localMonday()))
  const [format, setFormat] = useState<CallsFormat>('csv')
  const [file, setFile] = useState<File>()
  const [fileInputVersion, setFileInputVersion] = useState(0)
  const [importedName, setImportedName] = useState('')
  const [operation, setOperation] = useState<'import' | 'schedule' | 'export'>()
  const [result, setResult] = useState<ScheduleV2Response>()
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)
  const callsFileInput = useRef<HTMLInputElement>(null)
  const busy = operation !== undefined
  const dates = useMemo(() => weekDates(draft.week_start), [draft.week_start])
  const groups = useMemo(() => parseGroups(draft.groups_text), [draft.groups_text])
  const grid = useMemo(() => operatingHoursFor(draft, dates), [draft, dates])
  const slots = useMemo(() => operatingSlotsFor(grid), [grid])
  const shiftOptions = useMemo(() => validShiftStarts(slots), [slots])
  const allowedShiftKeys = new Set(shiftOptions.map(({ date, start }) => dateKey(date, start)))

  function edit(update: (previous: ScheduleV2Draft) => ScheduleV2Draft) {
    setDraft(update(draft))
    setError('')
    setAttempted(false)
    setStale((alreadyStale) => markScheduleResultStale(Boolean(result), alreadyStale))
  }

  function patch<K extends keyof ScheduleV2Draft>(key: K, value: ScheduleV2Draft[K]) {
    edit((previous) => ({ ...previous, [key]: value }))
  }

  function changeMode(mode: ScheduleV2Mode) {
    patch('mode', mode)
    changeFile()
  }

  const changeFile = useCallback((next?: File) => {
    setFile(next)
    if (!next) setFileInputVersion((version) => version + 1)
    setImportedName('')
    setError('')
    setStale((alreadyStale) => markScheduleResultStale(Boolean(result), alreadyStale))
  }, [result])

  useEffect(() => {
    const input = callsFileInput.current
    if (!input) return
    const handleCancel = () => changeFile()
    input.addEventListener('cancel', handleCancel)
    return () => input.removeEventListener('cancel', handleCancel)
  }, [changeFile, fileInputVersion])

  async function loadCalls() {
    if (!file || busy) return
    setError('')
    setOperation('import')
    try {
      const importedDraft = await importCallsIntoScheduleDraft(file, format, draft, draft.mode)
      edit(() => importedDraft)
      setImportedName(file.name)
      setFile(undefined)
      setFileInputVersion((version) => version + 1)
    } catch (reason) {
      showError(reason, fileMessages, fileMessages.import)
    } finally {
      setOperation(undefined)
    }
  }

  async function runSchedule() {
    if (busy) return
    setAttempted(true)
    setError('')
    const prepared = prepareScheduleRequest(draft)
    if (!prepared.request) {
      setError(prepared.error)
      return
    }
    setResult(undefined)
    setStale(false)
    setOperation('schedule')
    try {
      setResult(await requestScheduleV2(prepared.request))
    } catch (reason) {
      showError(reason, scheduleV2Messages, scheduleV2Messages.server)
    } finally {
      setOperation(undefined)
    }
  }

  async function downloadSchedule() {
    if (!result || !canExportScheduleResult(result, stale, busy)) return
    setError('')
    setOperation('export')
    try {
      const { filename, blob } = await exportScheduleCsv(result)
      downloadBlob(filename, blob)
    } catch (reason) {
      showError(reason, fileMessages, fileMessages.export)
    } finally {
      setOperation(undefined)
    }
  }

  function showError(reason: unknown, messages: Record<string, string>, fallback: string) {
    setError(reason instanceof Error && Object.values(messages).includes(reason.message) ? reason.message : fallback)
  }

  function addEmployee() {
    if (draft.employees.length >= 50) return
    patch('employees', [...draft.employees, { id: '', skills: [], available_slots: [], unavailable_dates: [], max_work_minutes_per_week: '', min_days_off_per_week: '' }])
  }

  function updateEmployee(index: number, update: (employee: EmployeeDraft) => EmployeeDraft) {
    patch('employees', draft.employees.map((employee, row) => row === index ? update(employee) : employee))
  }

  function toggleShift(date: string, start: string) {
    const key = dateKey(date, start)
    const exists = draft.shift_starts.some((item) => dateKey(item.date, item.start) === key)
    patch('shift_starts', exists ? draft.shift_starts.filter((item) => dateKey(item.date, item.start) !== key) : [...draft.shift_starts, { date, start }])
  }

  function loadSample() {
    const sample = scheduleV2Samples[draft.mode]
    edit(() => draftFromRequest(sample))
    setFile(undefined)
    setImportedName('')
    setError('')
  }

  const expectedCalls = new Set(grid.flatMap(({ date, hour }) => groups.map((group) => callKey(date, hour, group))))
  const staleCalls = Object.entries(draft.planned_calls).filter(([key, value]) => value !== '' && !expectedCalls.has(key))
  const weekLabels = dates ?? Array.from({ length: 7 }, () => '')

  return (
    <div className="roster-app">
      <header className="roster-masthead"><div className="roster-width v2-masthead">Điều phối CSKH</div></header>
      <main className="roster-width roster-main">
        <div className="roster-page-heading">
          <h1>Xếp lịch tuần</h1>
          <Button onClick={onOpenDemo}>Mở bản mô phỏng</Button>
        </div>
        <form className="roster-surface v2-input" noValidate onSubmit={(event) => { event.preventDefault(); void runSchedule() }}>
          <section className="v2-form-section" aria-labelledby="v2-demand-title">
            <h2 id="v2-demand-title">Nhu cầu và tuần xếp lịch</h2>
            <div className="v2-controls">
              <label className="roster-field"><span>Nguồn nhu cầu</span>
                <select value={draft.mode} disabled={busy} onChange={(event) => changeMode(event.currentTarget.value as ScheduleV2Mode)}>
                  <option value="planned_calls">Cuộc gọi dự kiến</option><option value="history">Dự báo từ lịch sử</option>
                </select>
              </label>
              <label className="roster-field"><span>Thứ Hai bắt đầu tuần</span>
                <input type="date" value={draft.week_start} disabled={busy} aria-invalid={attempted && !dates}
                  onChange={(event) => patch('week_start', event.currentTarget.value)} />
              </label>
              <Button type="button" disabled={busy} onClick={loadSample}>Nạp dữ liệu mẫu (tùy chọn)</Button>
            </div>
            <label className="roster-field v2-groups-field"><span>Mã nhóm — mỗi nhóm một dòng (tối đa 10)</span>
              <textarea rows={Math.min(5, Math.max(2, groups.length + 1))} value={draft.groups_text} disabled={busy}
                aria-invalid={attempted && (groups.length < 1 || groups.length > 10)}
                onChange={(event) => patch('groups_text', event.currentTarget.value)} placeholder={'sales\nsupport'} />
            </label>
            <fieldset className="v2-hours-grid" disabled={busy}>
              <legend>Giờ hoạt động theo ngày (giờ kết thúc không bao gồm)</legend>
              {draft.hours.map((hours, index) => <div className="v2-hours-row" key={index}>
                <span>{dayNames[index]} {weekLabels[index] && <small>· {dateText(weekLabels[index])}</small>}</span>
                <label><span className="sr-only">Mở cửa {dayNames[index]}</span><select aria-label={`Giờ mở ${dayNames[index]}`} aria-invalid={attempted && ((hours.start === '') !== (hours.end === '') || (hours.start !== '' && Number(hours.start) >= Number(hours.end)))} value={hours.start}
                  onChange={(event) => edit((previous) => ({ ...previous, hours: previous.hours.map((day, row) => row === index ? { ...day, start: event.currentTarget.value } : day) }))}>
                  <option value="">Đóng cửa</option>{timeOptions(22).map((hour) => <option key={hour} value={hour}>{hourText(hour)}</option>)}
                </select></label>
                <span aria-hidden="true">đến</span>
                <label><span className="sr-only">Giờ đóng {dayNames[index]}</span><select aria-label={`Giờ đóng ${dayNames[index]}`} aria-invalid={attempted && ((hours.start === '') !== (hours.end === '') || (hours.end !== '' && Number(hours.start) >= Number(hours.end)))} value={hours.end}
                  onChange={(event) => edit((previous) => ({ ...previous, hours: previous.hours.map((day, row) => row === index ? { ...day, end: event.currentTarget.value } : day) }))}>
                  <option value="">—</option>{timeOptions(23).slice(1).map((hour) => <option key={hour} value={hour}>{hourText(hour)}</option>)}
                </select></label>
              </div>)}
            </fieldset>
          </section>

          <section className="v2-form-section" aria-labelledby="v2-calls-title">
            <h2 id="v2-calls-title">{draft.mode === 'history' ? 'Quan sát lịch sử' : 'Cuộc gọi theo giờ'}</h2>
            <fieldset className="v2-file-group" disabled={busy}>
              <legend>Nhập cuộc gọi từ CSV hoặc XLSX</legend>
              <div className="v2-controls">
                <label className="roster-field"><span>Định dạng tệp</span>
                  <select value={format} onChange={(event) => { setFormat(event.currentTarget.value as CallsFormat); changeFile() }}>
                    <option value="csv">CSV</option><option value="xlsx">XLSX</option>
                  </select>
                </label>
                <label className="roster-field v2-file-field"><span>Tệp cuộc gọi</span>
                  <input ref={callsFileInput} key={fileInputVersion} type="file" accept={'.' + format} aria-describedby="v2-file-format"
                    onChange={(event) => changeFile(event.currentTarget.files?.[0])} />
                </label>
                <Button type="button" disabled={!file} onClick={() => void loadCalls()}>Nạp cuộc gọi</Button>
              </div>
              <p id="v2-file-format">Giới hạn 2 MiB · CSV/XLSX có cột <code>date, hour, group_id, calls</code>; XLSX dùng một sheet <code>calls</code>. Nhập tệp thay các dòng cuộc gọi của chế độ đang chọn.</p>
              {importedName && <p role="status">Đã nạp {importedName}; kiểm tra lại các dòng trước khi chạy.</p>}
            </fieldset>

            {draft.mode === 'planned_calls' ? <>
              <p>Mỗi giờ hoạt động và nhóm cần một giá trị. Nhập 0 rõ ràng nếu không có cuộc gọi.</p>
              {grid.length > 0 && groups.length > 0 ? <div className="v2-call-grid">
                {grid.flatMap(({ date, hour }) => groups.map((group) => {
                  const key = callKey(date, hour, group)
                  const value = draft.planned_calls[key] ?? ''
                  return <label className="roster-field" key={key}><span>{dateText(date)} · {hourText(hour)} · {group}</span>
                    <input type="number" min="0" step="any" value={value} disabled={busy} inputMode="decimal"
                      aria-invalid={attempted && invalidNumber(value, { min: 0 })} onChange={(event) => edit((previous) => ({ ...previous, planned_calls: { ...previous.planned_calls, [key]: event.currentTarget.value } }))} />
                  </label>
                }))}
              </div> : <p>Cấu hình tuần, nhóm và giờ hoạt động để hiện các ô cuộc gọi.</p>}
              {!!staleCalls.length && <div className="v2-inline-warning" role="alert">
                <p>{staleCalls.length} giá trị cuộc gọi đang nằm ngoài lưới hiện tại; chúng được giữ lại cho đến khi bạn chỉnh rõ.</p>
                <Button type="button" disabled={busy} onClick={() => patch('planned_calls', Object.fromEntries(Object.entries(draft.planned_calls).filter(([key, value]) => value !== '' && expectedCalls.has(key))))}>Xóa các giá trị ngoài lưới</Button>
                <ul>{staleCalls.map(([key]) => <li key={key}><code>{key}</code></li>)}</ul>
              </div>}
            </> : <>
              <p>Ngày lịch sử phải trước tuần xếp lịch. Mỗi thứ, giờ và nhóm dự báo cần ít nhất hai quan sát.</p>
              <div className="v2-controls"><Button type="button" disabled={busy} onClick={() => patch('history', [...draft.history, { id: `history-${Date.now()}`, date: '', hour: '', group_id: '', calls: '' }])}>Thêm quan sát</Button></div>
              {draft.history.map((row, index) => <div className="v2-history-row" key={row.id}>
                <label className="roster-field"><span>Ngày</span><input type="date" value={row.date} disabled={busy} aria-invalid={attempted && (!row.date || (dates ? row.date >= draft.week_start : true))}
                  onChange={(event) => edit((previous) => ({ ...previous, history: previous.history.map((item, i) => i === index ? { ...item, date: event.currentTarget.value } : item) }))} /></label>
                <label className="roster-field"><span>Giờ</span><input type="number" min="0" max="22" step="1" value={row.hour} disabled={busy} aria-invalid={attempted && invalidNumber(row.hour, { integer: true, min: 0, max: 22 })}
                  onChange={(event) => edit((previous) => ({ ...previous, history: previous.history.map((item, i) => i === index ? { ...item, hour: event.currentTarget.value } : item) }))} /></label>
                <label className="roster-field"><span>Nhóm</span><input value={row.group_id} disabled={busy} aria-invalid={attempted && !groups.includes(row.group_id)}
                  onChange={(event) => edit((previous) => ({ ...previous, history: previous.history.map((item, i) => i === index ? { ...item, group_id: event.currentTarget.value } : item) }))} /></label>
                <label className="roster-field"><span>Số cuộc gọi</span><input type="number" min="0" step="1" value={row.calls} disabled={busy} aria-invalid={attempted && (invalidNumber(row.calls, { integer: true, min: 0 }) || !Number.isSafeInteger(Number(row.calls)))}
                  onChange={(event) => edit((previous) => ({ ...previous, history: previous.history.map((item, i) => i === index ? { ...item, calls: event.currentTarget.value } : item) }))} /></label>
                <Button type="button" disabled={busy} onClick={() => patch('history', draft.history.filter((_, i) => i !== index))} aria-label={`Xóa quan sát ${index + 1}`}>Xóa</Button>
              </div>)}
            </>}
          </section>

          <section className="v2-form-section" aria-labelledby="v2-erlang-title">
            <h2 id="v2-erlang-title">Tham số Erlang C</h2>
            <p>Áp dụng chung cho các nhóm. AHT và thời gian chờ nhập bằng giây; SLA phải lớn hơn 0% và nhỏ hơn 100%.</p>
            <div className="v2-controls">
              <label className="roster-field"><span>AHT (giây)</span><input type="number" min="0" step="any" value={draft.aht_seconds} disabled={busy} aria-invalid={attempted && invalidNumber(draft.aht_seconds, { min: 0 })} onChange={(event) => patch('aht_seconds', event.currentTarget.value)} /></label>
              <label className="roster-field"><span>SLA mục tiêu (%)</span><input type="number" min="0" step="any" value={draft.target_sla_percent} disabled={busy} aria-invalid={attempted && !isValidSlaPercent(draft.target_sla_percent)} onChange={(event) => patch('target_sla_percent', event.currentTarget.value)} /></label>
              <label className="roster-field"><span>Thời gian chờ (giây)</span><input type="number" min="0" step="any" value={draft.waiting_seconds} disabled={busy} aria-invalid={attempted && invalidNumber(draft.waiting_seconds, { min: 0 })} onChange={(event) => patch('waiting_seconds', event.currentTarget.value)} /></label>
              <label className="v2-checkbox"><input type="checkbox" checked={draft.allow_skill_fallback} disabled={busy} onChange={(event) => patch('allow_skill_fallback', event.currentTarget.checked)} />Cho phép điều chuyển khác kỹ năng</label>
            </div>
          </section>

          <section className="v2-form-section" aria-labelledby="v2-roster-title">
            <h2 id="v2-roster-title">Nhân viên và giờ rảnh</h2>
            <p>Kỹ năng chọn từ danh sách nhóm. Ca dài 90 phút; nhân viên cần rảnh đủ ba khung 30 phút liên tiếp.</p>
            <div className="v2-controls"><Button type="button" disabled={busy || draft.employees.length >= 50} onClick={addEmployee}>Thêm nhân viên</Button></div>
            {draft.employees.map((employee, index) => {
              const currentSlotKeys = new Set(slots.map(({ date, start }) => dateKey(date, start)))
              const outsideSlots = employee.available_slots.filter(({ date, start }) => !currentSlotKeys.has(dateKey(date, start)))
              const outsideDays = employee.unavailable_dates.filter((date) => !weekLabels.includes(date))
              return <fieldset className="v2-employee-card" key={index} disabled={busy}>
                <legend>Nhân viên {index + 1}</legend>
                <div className="v2-controls">
                  <label className="roster-field"><span>Mã nhân viên</span><input value={employee.id} aria-invalid={attempted && !employee.id} onChange={(event) => updateEmployee(index, (row) => ({ ...row, id: event.currentTarget.value }))} /></label>
                  <label className="roster-field"><span>Tối đa phút/tuần</span><input type="number" min="0" max="10080" step="1" value={employee.max_work_minutes_per_week} aria-invalid={attempted && invalidNumber(employee.max_work_minutes_per_week, { integer: true, min: 0, max: 10080 })} onChange={(event) => updateEmployee(index, (row) => ({ ...row, max_work_minutes_per_week: event.currentTarget.value }))} /></label>
                  <label className="roster-field"><span>Ngày nghỉ tối thiểu/tuần (không bắt buộc)</span><input type="number" min="0" max="7" step="1" value={employee.min_days_off_per_week} aria-invalid={attempted && employee.min_days_off_per_week !== '' && invalidNumber(employee.min_days_off_per_week, { integer: true, min: 0, max: 7 })} onChange={(event) => updateEmployee(index, (row) => ({ ...row, min_days_off_per_week: event.currentTarget.value }))} /></label>
                  <Button type="button" onClick={() => patch('employees', draft.employees.filter((_, i) => i !== index))}>Xóa nhân viên</Button>
                </div>
                <fieldset className="v2-choice-list"><legend>Kỹ năng</legend>
                  {groups.map((group) => <label className="v2-checkbox" key={group}><input type="checkbox" checked={employee.skills.includes(group)} onChange={(event) => updateEmployee(index, (row) => ({ ...row, skills: event.currentTarget.checked ? [...row.skills, group] : row.skills.filter((skill) => skill !== group) }))} />{group}</label>)}
                  {!groups.length && <p>Khai báo nhóm ở trên để chọn kỹ năng.</p>}
                  {employee.skills.filter((skill) => !groups.includes(skill)).map((skill) => <div className="v2-inline-warning" role="alert" key={skill}>
                    <span>Kỹ năng “{skill}” không còn thuộc nhóm đã khai báo. Kỹ năng này vẫn được giữ trong cấu hình.</span>
                    <Button type="button" disabled={busy} onClick={() => updateEmployee(index, (row) => ({ ...row, skills: row.skills.filter((item) => item !== skill) }))}>Xóa kỹ năng {skill}</Button>
                  </div>)}
                </fieldset>
                <fieldset className="v2-choice-list"><legend>Ngày nghỉ</legend>
                  {weekLabels.map((date, day) => date && <label className="v2-checkbox" key={date}><input type="checkbox" checked={employee.unavailable_dates.includes(date)} onChange={(event) => updateEmployee(index, (row) => ({ ...row, unavailable_dates: event.currentTarget.checked ? [...row.unavailable_dates, date] : row.unavailable_dates.filter((item) => item !== date) }))} />{dayNames[day]} · {dateText(date)}</label>)}
                  {!!outsideDays.length && <div className="v2-inline-warning" role="alert"><p>Ngày nghỉ ngoài tuần hiện tại vẫn được giữ nguyên. Bỏ chọn rõ ràng để tiếp tục:</p>
                    {outsideDays.map((date) => <label className="v2-checkbox" key={date}><input type="checkbox" checked onChange={() => updateEmployee(index, (row) => ({ ...row, unavailable_dates: row.unavailable_dates.filter((item) => item !== date) }))} />{date}</label>)}
                  </div>}
                </fieldset>
                <details className="v2-slots-details"><summary>Chọn khung rảnh (30 phút)</summary>
                  <Button type="button" disabled={!slots.length} onClick={() => updateEmployee(index, (row) => ({ ...row, available_slots: slots }))}>Chọn tất cả khung giờ đang mở</Button>
                  {grid.map(({ date, hour }) => <div className="v2-slot-day" key={date + hour}>
                    <strong>{dateText(date)} · {hourText(hour)}</strong>
                    {[0, 30].map((minute) => {
                      const start = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                      const checked = employee.available_slots.some((slot) => slot.date === date && slot.start === start)
                      return <label className="v2-checkbox" key={start}><input type="checkbox" checked={checked} onChange={(event) => updateEmployee(index, (row) => ({ ...row, available_slots: event.currentTarget.checked ? [...row.available_slots, { date, start }] : row.available_slots.filter((slot) => dateKey(slot.date, slot.start) !== dateKey(date, start)) }))} />{start}</label>
                    })}
                  </div>)}
                  {!!outsideSlots.length && <div className="v2-inline-warning" role="alert"><p>Các khung sau nằm ngoài lưới hiện tại. Bỏ chọn rõ ràng để tiếp tục:</p>
                    {outsideSlots.map((slot) => <label className="v2-checkbox" key={dateKey(slot.date, slot.start)}><input type="checkbox" checked onChange={() => updateEmployee(index, (row) => ({ ...row, available_slots: row.available_slots.filter((item) => dateKey(item.date, item.start) !== dateKey(slot.date, slot.start)) }))} />{slot.date} {slot.start}</label>)}
                  </div>}
                </details>
                <p className="v2-help">Ngày nghỉ không được trùng với khung đã chọn rảnh.</p>
              </fieldset>
            })}
          </section>

          <section className="v2-form-section" aria-labelledby="v2-shifts-title">
            <h2 id="v2-shifts-title">Khung bắt đầu ca</h2>
            <p>Chỉ chọn được ca có đủ ba khung 30 phút liên tiếp trong giờ hoạt động.</p>
            {!!shiftOptions.length && <Button type="button" disabled={busy || shiftOptions.length + draft.shift_starts.length > 200} onClick={() => patch('shift_starts', shiftOptions)}>Chọn mọi ca hợp lệ</Button>}
            {!!draft.shift_starts.filter(({ date, start }) => !allowedShiftKeys.has(dateKey(date, start))).length && <div className="v2-inline-warning" role="alert">
              <p>Ca đã chọn nhưng không còn hợp lệ sau khi đổi lưới; bỏ chọn để tiếp tục.</p>
              {draft.shift_starts.filter(({ date, start }) => !allowedShiftKeys.has(dateKey(date, start))).map((shift) => <label className="v2-checkbox" key={dateKey(shift.date, shift.start)}><input type="checkbox" checked onChange={() => toggleShift(shift.date, shift.start)} />{shift.date} {shift.start}</label>)}
            </div>}
            <div className="v2-shift-options">{shiftOptions.map(({ date, start }) => <label className="v2-checkbox" key={dateKey(date, start)}>
              <input type="checkbox" checked={draft.shift_starts.some((shift) => dateKey(shift.date, shift.start) === dateKey(date, start))} disabled={busy || (!draft.shift_starts.some((shift) => dateKey(shift.date, shift.start) === dateKey(date, start)) && draft.shift_starts.length >= 200)} onChange={() => toggleShift(date, start)} />{dateText(date)} {start}
            </label>)}</div>
          </section>

          <div className="v2-controls v2-submit-row">
            <Button type="submit" variant="primary" disabled={busy}>Chạy xếp lịch</Button>
            <Button type="button" disabled={!canExportScheduleResult(result, stale, busy)} onClick={() => void downloadSchedule()}>Tải lịch mới nhất (CSV)</Button>
          </div>
        </form>
        {error && <NoticeBox notice={{ tone: 'error', message: error }} />}
        {operation && <p className="v2-progress" role="status">
          {operation === 'import' ? 'Đang đọc tệp…' : operation === 'schedule' ? 'Đang xếp lịch…' : 'Đang xuất CSV…'}
        </p>}
        {result && <>{stale && <div className="v2-inline-warning" role="status">Đầu vào đã đổi sau lần xếp lịch này. Kết quả được đánh dấu cũ; chạy lại trước khi tải CSV.</div>}<ScheduleV2Result result={result} /></>}
      </main>
    </div>
  )
}
