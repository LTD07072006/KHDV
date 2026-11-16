import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { NoticeBox } from '@/components/NoticeBox'
import { scheduleV2Samples } from '@/data/scheduleV2Samples'
import { scheduleV2Coverage } from '@/lib/scheduleV2Coverage'
import { downloadBlob } from '@/lib/downloadFile'
import { exportScheduleCsv, fileMessages, importScheduleCalls, type CallsFormat } from '@/services/scheduleV2Files'
import {
  hasSchedule, requestScheduleV2, scheduleV2Messages,
  type ScheduleV2Mode, type ScheduleV2Request, type ScheduleV2Response, type SolverV2Status,
} from '@/services/scheduleV2'
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

export function ScheduleV2Workspace({ onOpenDemo }: { onOpenDemo: () => void }) {
  const [mode, setMode] = useState<ScheduleV2Mode>('history')
  const [format, setFormat] = useState<CallsFormat>('csv')
  const [file, setFile] = useState<File>()
  const [fileInputVersion, setFileInputVersion] = useState(0)
  const [imported, setImported] = useState<ScheduleV2Request>()
  const [operation, setOperation] = useState<'import' | 'schedule' | 'export'>()
  const [result, setResult] = useState<ScheduleV2Response>()
  const [error, setError] = useState('')
  const busy = operation !== undefined
  const sample = scheduleV2Samples[mode]
  const fileReady = file === undefined || imported !== undefined

  function changeFile(next?: File) {
    setFile(next)
    if (!next) setFileInputVersion((version) => version + 1)
    setImported(undefined)
    setResult(undefined)
    setError('')
  }

  async function loadCalls() {
    if (!file || busy) return
    setImported(undefined)
    setResult(undefined)
    setError('')
    setOperation('import')
    try {
      setImported(await importScheduleCalls(file, format, sample))
    } catch (reason) {
      showError(reason, fileMessages, fileMessages.import)
    } finally {
      setOperation(undefined)
    }
  }

  async function runSample() {
    if (busy || !fileReady) return
    setResult(undefined)
    setError('')
    setOperation('schedule')
    try {
      setResult(await requestScheduleV2(imported ?? sample))
    } catch (reason) {
      showError(reason, scheduleV2Messages, scheduleV2Messages.server)
    } finally {
      setOperation(undefined)
    }
  }

  async function downloadSchedule() {
    if (busy || !result || !hasSchedule(result.schedule.status)) return
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

  return (
    <div className="roster-app">
      <header className="roster-masthead"><div className="roster-width v2-masthead">Điều phối CSKH</div></header>
      <main className="roster-width roster-main">
        <div className="roster-page-heading">
          <h1>Xếp lịch tuần</h1>
          <Button onClick={onOpenDemo}>Mở bản mô phỏng</Button>
        </div>
        <form className="roster-surface v2-input" onSubmit={(event) => { event.preventDefault(); void runSample() }}>
          <div className="v2-controls">
            <label className="roster-field">
              <span>Kịch bản mẫu</span>
              <select value={mode} disabled={busy} onChange={(event) => {
                setMode(event.currentTarget.value === 'history' ? 'history' : 'planned_calls')
                changeFile()
              }}>
                <option value="history">Dự báo từ lịch sử</option>
                <option value="planned_calls">Cuộc gọi dự kiến</option>
              </select>
            </label>
            <p>Tuần bắt đầu {dateText(sample.week_start)} · nhóm {sample.groups.join(', ')}. Tệp chỉ thay số cuộc gọi của kịch bản.</p>
          </div>
          <fieldset className="v2-file-group" disabled={busy}>
            <legend>Nạp cuộc gọi (tùy chọn)</legend>
            <div className="v2-controls">
              <label className="roster-field">
                <span>Định dạng</span>
                <select value={format} onChange={(event) => {
                  setFormat(event.currentTarget.value === 'xlsx' ? 'xlsx' : 'csv')
                  changeFile()
                }}>
                  <option value="csv">CSV</option>
                  <option value="xlsx">XLSX</option>
                </select>
              </label>
              <label className="roster-field v2-file-field">
                <span>Tệp cuộc gọi</span>
                <input key={fileInputVersion} type="file" accept={'.' + format}
                  aria-describedby="v2-file-format"
                  onChange={(event) => {
                    const picked = event.currentTarget.files?.[0]
                    if (picked) changeFile(picked)
                  }} />
              </label>
              <Button type="button" disabled={!file || Boolean(imported)} onClick={() => void loadCalls()}>Nạp tệp</Button>
              {file && <Button type="button" onClick={() => changeFile()}>Dùng số cuộc gọi mẫu</Button>}
            </div>
            <p id="v2-file-format">Tối đa 2 MiB. Thứ tự cột: <code>date, hour, group_id, calls</code>. XLSX dùng một sheet <code>calls</code>.</p>
            {imported && <p role="status">Đã nạp {file?.name}</p>}
          </fieldset>
          <div className="v2-controls">
            <Button type="submit" variant="primary" disabled={busy || !fileReady}>Chạy xếp lịch</Button>
            <Button type="button" disabled={busy || !result || !hasSchedule(result.schedule.status)}
              onClick={() => void downloadSchedule()}>Tải lịch CSV</Button>
          </div>
        </form>
        {error && <NoticeBox notice={{ tone: 'error', message: error }} />}
        {operation && <p className="v2-progress" role="status">
          {operation === 'import' ? 'Đang đọc tệp…' : operation === 'schedule' ? 'Đang xếp lịch…' : 'Đang xuất CSV…'}
        </p>}
        {result && <ScheduleV2Result result={result} />}
      </main>
    </div>
  )
}
