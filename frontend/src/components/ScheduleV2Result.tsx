import { useId, useState, type ReactNode, type Ref } from 'react'
import { callKey, hasSchedule, type ScheduleV2Response, type SolverV2Status } from '@/services/scheduleV2'
import { Choice } from './ScheduleIntervalEditors'
import { displayDate } from '@/services/scheduleV2Form'

const statusText: Record<SolverV2Status, string> = {
  OPTIMAL: 'Đã chứng minh tối ưu',
  FEASIBLE: 'Có lịch khả thi, chưa chứng minh tối ưu',
  INFEASIBLE: 'Không có lịch thỏa ràng buộc',
  UNKNOWN: 'Chưa xác định được kết quả',
  MODEL_INVALID: 'Mô hình xếp lịch không hợp lệ',
}
const format = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 })

function Table({ title, columns, children }: { title: string; columns: string[]; children: ReactNode }) {
  const heading = useId()
  return <section className="v2-result-section" aria-labelledby={heading}>
    <h3 id={heading}>{title}</h3>
    <div className="roster-table-scroll" role="region" aria-labelledby={heading} tabIndex={0}>
      <table className="roster-data-table"><thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  </section>
}

function CoverageChart({ rows, available }: { rows: ScheduleV2Response['interval_results']; available: boolean }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.erlang.required_staff, row.assigned_staff ?? 0)))
  return <div className="v2-chart" role="img" aria-label="Biểu đồ số người cần và đã xếp. Số liệu chi tiết ở bảng ngay bên dưới.">
    <div className="v2-chart-bars" aria-hidden="true">
      {rows.map((row) => <div key={row.start} className="v2-chart-column">
        <div className="v2-chart-pair" title={`${row.start} · Cần ${row.erlang.required_staff} · Đã xếp ${row.assigned_staff ?? '—'}`}>
          <span className="v2-bar-needed" style={{ height: `${row.erlang.required_staff / max * 100}%` }} />
          {available && <span className="v2-bar-assigned" style={{ height: `${(row.assigned_staff ?? 0) / max * 100}%` }} />}
        </div><small>{row.start}</small>
      </div>)}
    </div>
  </div>
}

export function ScheduleV2Result({ result, headingRef }: { result: ScheduleV2Response; headingRef: Ref<HTMLElement> }) {
  const [selectedDate, setDate] = useState('')
  const [selectedGroup, setGroup] = useState('')
  const { schedule, interval_results } = result
  const names = new Map(result.groups.map((group) => [group.id, group.name]))
  const dates = [...new Set(interval_results.map((row) => row.date))].sort()
  const date = dates.includes(selectedDate) ? selectedDate : dates[0] ?? ''
  const group = names.has(selectedGroup) ? selectedGroup : result.groups[0]?.id ?? ''
  const rows = interval_results.filter((row) => row.date === date && row.group_id === group).sort((a, b) => a.start.localeCompare(b.start))
  const available = hasSchedule(schedule.status)
  return <section className="roster-surface v2-results" aria-label="Kết quả xếp lịch" ref={headingRef} tabIndex={-1}>
    <div className="v2-result-summary" data-available={available}>
      <h2>{statusText[schedule.status]} <code>{schedule.status}</code></h2>
      <p>{schedule.message}</p>
      {schedule.stage_two_status && <p>Giai đoạn tối ưu phút ca <code>{schedule.stage_two_status}</code></p>}
      {available && <dl className="v2-metrics">
        <div><dt>Số ca</dt><dd>{schedule.assignments.length}</dd></div>
        <div><dt>Tổng phút ca gồm nghỉ</dt><dd>{format.format(schedule.total_shift_minutes ?? 0)}</dd></div>
        <div><dt>Lượt người dư (30 phút)</dt><dd>{schedule.overstaff_slots}</dd></div>
        <div><dt>Lượt lệch kỹ năng (30 phút)</dt><dd>{schedule.skill_mismatch_slots}</dd></div>
      </dl>}
    </div>
    {schedule.warnings.length > 0 && <div className="v2-warnings"><h3>Cảnh báo</h3>
      <ul>{schedule.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
    </div>}
    <section className="v2-result-section" aria-label="Biểu đồ độ phủ">
      <div className="v2-controls">
        <Choice label="Ngày xem độ phủ" value={date} options={dates.map((value) => ({ value, label: displayDate(value) }))} onChange={setDate} />
        <Choice label="Nhóm xem độ phủ" value={group} options={result.groups.map(({ id, name }) => ({ value: id, label: name }))} onChange={setGroup} />
      </div>
      <div className="v2-chart-legend"><span><i className="v2-bar-needed" />Người cần</span>{available ? <span><i className="v2-bar-assigned" />Đã xếp</span> : <span>Chưa có lịch</span>}</div>
      <CoverageChart rows={rows} available={available} />
    </section>
    <Table title="Nhu cầu và độ phủ theo khoảng 30 phút" columns={['Giờ bắt đầu', 'Cuộc gọi', 'Số mẫu dự báo', 'Người cần', 'Đã xếp', 'SLA ước tính tại số người cần']}>
      {rows.length === 0 && <tr><td colSpan={6}>Nhóm không có dữ liệu trong ngày này.</td></tr>}
      {rows.map((row) => <tr key={callKey(row)}>
        <th scope="row">{row.start}</th><td>{format.format(row.calls)}</td><td>{row.sample_count ?? '—'}</td><td>{row.erlang.required_staff}</td>
        <td>{row.assigned_staff ?? '—'}</td><td>{row.erlang.service_level === null ? '—' : percent.format(row.erlang.service_level)}</td>
      </tr>)}
    </Table>
    {available && <Table title="Lịch phân công" columns={['Nhân viên', 'Ngày', 'Ca', 'Khoảng nghỉ', 'Phân nhóm theo khung 30 phút']}>
      {!schedule.assignments.length && <tr><td colSpan={5}>Lịch này không có ca được phân công.</td></tr>}
      {schedule.assignments.map((shift, index) => <tr key={index}>
        <th scope="row">{shift.employee_id}</th><td>{displayDate(shift.date)}</td><td>{shift.start}–{shift.end}</td>
        <td>{shift.breaks.map((pause) => `${pause.start}–${pause.end}`).join(', ') || '—'}</td>
        <td><ul>{shift.groups_by_slot.map((slot) => <li key={slot.start}>{slot.start} · {names.get(slot.group_id)}</li>)}</ul></td>
      </tr>)}
    </Table>}
  </section>
}
