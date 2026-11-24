import { useId, useMemo, useState, type ReactNode, type Ref } from 'react'
import { callKey, hasSchedule, type ScheduleV2Response, type SolverV2Status } from '@/services/scheduleV2'
import { Check, Choice } from './ScheduleIntervalEditors'
import { Button } from './ui/button'
import { displayDate } from '@/services/scheduleV2Form'
import {
  buildWeeklyGantt, coverageDeltaLabel, coverageState, filterAssignments, formatDuration,
  isSlotSkillMismatch, summarizeCoverage,
  type AssignmentFilter, type AssignmentRow, type CoverageState, type EmployeeSkillsMap, type IntervalRow,
} from '@/lib/scheduleV2Visualization'

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
      <table className="roster-data-table">
        <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  </section>
}

function CoverageChart({ rows, available }: { rows: IntervalRow[]; available: boolean }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.erlang.required_staff, row.assigned_staff ?? 0)))
  if (rows.length === 0) {
    return <p className="v2-empty-note">Không có khung 30 phút nào cho ngày và nhóm đã chọn.</p>
  }
  return <div className="v2-chart" role="img" aria-label="Biểu đồ số người cần và đã xếp theo khung 30 phút. Số liệu chi tiết ở bảng ngay bên dưới.">
    <div className="v2-chart-bars" aria-hidden="true">
      {rows.map((row) => {
        const state: CoverageState = available ? coverageState(row.erlang.required_staff, row.assigned_staff) : 'unavailable'
        const statusLabel = coverageDeltaLabel(row.erlang.required_staff, available ? row.assigned_staff : null)
        return <div key={row.start} className="v2-chart-column" data-state={state}>
          <span className="v2-chart-values">
            {row.erlang.required_staff}{available ? `/${row.assigned_staff ?? 0}` : ''}
          </span>
          <div className="v2-chart-pair" title={`${row.start} · Cần ${row.erlang.required_staff} · Đã xếp ${row.assigned_staff ?? '—'} · ${statusLabel}`}>
            <span className="v2-bar-needed" style={{ height: `${(row.erlang.required_staff / max) * 100}%` }} />
            {available && (
              <span
                className="v2-bar-assigned"
                data-state={state}
                style={{ height: `${((row.assigned_staff ?? 0) / max) * 100}%` }}
              />
            )}
          </div>
          <small>{row.start}</small>
        </div>
      })}
    </div>
  </div>
}

function WeeklyGanttGrid({
  result,
  filter,
  names,
  employeeSkills,
}: {
  result: ScheduleV2Response
  filter: AssignmentFilter
  names: Map<string, string>
  employeeSkills?: EmployeeSkillsMap
}) {
  const gantt = useMemo(() => buildWeeklyGantt(result, filter, employeeSkills), [result, filter, employeeSkills])
  const heading = useId()

  if (gantt.rows.length === 0) {
    return <p className="v2-empty-note">Không có ca phân công nào khớp bộ lọc hiện tại.</p>
  }

  const axisRange = `${gantt.ticks[0]?.label ?? ''}–${gantt.ticks[gantt.ticks.length - 1]?.label ?? ''}`

  return <div className="v2-gantt-wrap">
    <div className="v2-gantt-legend" aria-label="Chú giải nhóm kỹ năng và khoảng nghỉ">
      {result.groups.map((group, index) => (
        <span key={group.id} className="v2-gantt-legend-item">
          <i className="v2-gantt-swatch" data-group-tone={index % 6} />
          {group.name}
        </span>
      ))}
      {gantt.hasBreaks && (
        <span className="v2-gantt-legend-item">
          <i className="v2-gantt-swatch v2-gantt-swatch-break" />
          Nghỉ giữa ca
        </span>
      )}
      {gantt.hasAnySkillMismatch && (
        <span className="v2-gantt-legend-item">
          <i className="v2-gantt-swatch v2-gantt-swatch-mismatch" />
          Điều chuyển trái kỹ năng
        </span>
      )}
      <span className="v2-gantt-axis-note">Trục giờ mỗi ngày: {axisRange}</span>
    </div>

    <div className="roster-table-scroll v2-gantt-scroll" role="region" aria-labelledby={heading} tabIndex={0}>
      <span id={heading} className="sr-only">Lưới lịch ca tuần theo nhân viên và ngày</span>
      <table className="roster-data-table v2-gantt-table">
        <thead>
          <tr>
            <th scope="col" className="v2-gantt-sticky">Nhân viên</th>
            {gantt.dates.map((date) => (
              <th key={date} scope="col" className="v2-gantt-day-head">
                <div>{displayDate(date)}</div>
                <div className="v2-gantt-ticks" aria-hidden="true">
                  <span>{gantt.ticks[0]?.label}</span>
                  <span>{gantt.ticks[gantt.ticks.length - 1]?.label}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gantt.rows.map((row) => (
            <tr key={row.employeeId}>
              <th scope="row" className="v2-gantt-sticky v2-gantt-emp-cell">
                <div className="v2-gantt-emp-id">{row.employeeId}</div>
                <div className="v2-gantt-emp-meta">{row.shiftCount} ca · {formatDuration(row.totalWorkMinutes)}</div>
              </th>
              {gantt.dates.map((date) => {
                const dayShifts = row.cells[date] ?? []
                return (
                  <td key={date} className="v2-gantt-day-cell">
                    {dayShifts.length === 0 ? (
                      <span className="v2-gantt-empty" aria-label="Nghỉ">—</span>
                    ) : (
                      <div className="v2-gantt-cell-stack">
                        {dayShifts.map((item, idx) => {
                          const { assignment, leftPct, widthPct, segments, hasSkillMismatch, mismatchSlotCount } = item
                          const slotText = segments.map((seg) =>
                            seg.kind === 'break'
                              ? `Nghỉ ${seg.start}–${seg.end}`
                              : `${names.get(seg.groupId ?? '') ?? seg.groupId}${seg.skillMismatch ? ' (lệch kỹ năng)' : ''} ${seg.start}–${seg.end}`,
                          ).join(', ')
                          const summaryLabel = `${assignment.employee_id} · ${displayDate(assignment.date)} · Ca ${assignment.start}–${assignment.end} (${slotText})`
                          return (
                            <div key={`${assignment.start}-${idx}`} className="v2-gantt-shift-item" data-mismatch={hasSkillMismatch || undefined}>
                              <div className="v2-gantt-track" title={summaryLabel} aria-label={summaryLabel}>
                                <div
                                  className="v2-gantt-bar"
                                  style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 4)}%` }}
                                >
                                  {segments.map((seg, sIdx) => (
                                    <span
                                      key={`${seg.start}-${sIdx}`}
                                      className={seg.kind === 'break' ? 'v2-gantt-seg v2-gantt-seg-break' : 'v2-gantt-seg'}
                                      data-group-tone={seg.kind === 'group' ? seg.groupIndex : undefined}
                                      data-mismatch={seg.skillMismatch || undefined}
                                      data-dimmed={filter.group && seg.kind === 'group' && seg.groupId !== filter.group ? 'true' : undefined}
                                      style={{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }}
                                      title={seg.kind === 'break'
                                        ? `Nghỉ giữa ca: ${seg.start}–${seg.end}`
                                        : `${names.get(seg.groupId ?? '') ?? seg.groupId}${seg.skillMismatch ? ' (lệch kỹ năng)' : ''}: ${seg.start}–${seg.end}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="v2-gantt-shift-meta">
                                <span className="v2-gantt-shift-time">{assignment.start}–{assignment.end}</span>
                                <span className="v2-gantt-shift-groups">
                                  {[...new Set(assignment.groups_by_slot.map((s) => names.get(s.group_id) ?? s.group_id))].join(', ')}
                                </span>
                                {hasSkillMismatch && (
                                  <span className="v2-pill" data-state="over">Lệch kỹ năng ({mismatchSlotCount})</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
}

function AssignmentDetailTable({
  assignments,
  names,
  employeeSkills,
}: {
  assignments: AssignmentRow[]
  names: Map<string, string>
  employeeSkills?: EmployeeSkillsMap
}) {
  return <div className="roster-table-scroll" role="region" aria-label="Bảng chi tiết lịch phân công" tabIndex={0}>
    <table className="roster-data-table">
      <thead>
        <tr>
          <th scope="col">Nhân viên</th>
          <th scope="col">Ngày</th>
          <th scope="col">Ca</th>
          <th scope="col">Khoảng nghỉ</th>
          <th scope="col">Phân nhóm theo khung 30 phút</th>
        </tr>
      </thead>
      <tbody>
        {assignments.length === 0 && (
          <tr><td colSpan={5}>Không có ca phân công nào khớp bộ lọc hiện tại.</td></tr>
        )}
        {assignments.map((shift, index) => (
          <tr key={`${shift.employee_id}-${shift.date}-${shift.start}-${index}`}>
            <th scope="row">{shift.employee_id}</th>
            <td>{displayDate(shift.date)}</td>
            <td>{shift.start}–{shift.end}</td>
            <td>{shift.breaks.map((pause) => `${pause.start}–${pause.end}`).join(', ') || '—'}</td>
            <td>
              <ul className="v2-slot-list">
                {shift.groups_by_slot.map((slot) => {
                  const mismatch = isSlotSkillMismatch(shift.employee_id, slot.group_id, employeeSkills)
                  return (
                    <li key={slot.start} className="v2-slot-item">
                      <span>{slot.start} · {names.get(slot.group_id) ?? slot.group_id}</span>
                      {mismatch && <span className="v2-pill" data-state="over">Lệch kỹ năng</span>}
                    </li>
                  )
                })}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
}

export function ScheduleV2Result({
  result,
  headingRef,
  employeeSkills,
  solveSeconds,
  onRetrySoft,
  onRetryLonger,
}: {
  result: ScheduleV2Response
  headingRef: Ref<HTMLElement>
  employeeSkills?: EmployeeSkillsMap
  solveSeconds?: number
  onRetrySoft?: () => void
  onRetryLonger?: () => void
}) {
  const [selectedDate, setDate] = useState('')
  const [selectedGroup, setGroup] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [mismatchOnly, setMismatchOnly] = useState(false)
  const [viewMode, setViewMode] = useState<'gantt' | 'table'>('gantt')

  const { schedule, interval_results } = result
  const names = useMemo(() => new Map(result.groups.map((group) => [group.id, group.name])), [result.groups])
  const dates = useMemo(() => [...new Set(interval_results.map((row) => row.date))].sort(), [interval_results])
  const employees = useMemo(() => [...new Set(schedule.assignments.map((shift) => shift.employee_id))].sort(), [schedule.assignments])

  const date = dates.includes(selectedDate) ? selectedDate : dates[0] ?? ''
  const group = names.has(selectedGroup) ? selectedGroup : result.groups[0]?.id ?? ''
  const rows = useMemo(
    () => interval_results
      .filter((row) => row.date === date && row.group_id === group)
      .sort((a, b) => a.start.localeCompare(b.start)),
    [interval_results, date, group],
  )

  const available = hasSchedule(schedule.status)
  const coverageSummary = useMemo(() => summarizeCoverage(rows), [rows])
  const hasMismatches = Boolean((schedule.skill_mismatch_slots ?? 0) > 0 && employeeSkills)

  const activeFilterDate = filterDate && dates.includes(filterDate) ? filterDate : ''
  const activeFilterGroup = filterGroup && names.has(filterGroup) ? filterGroup : ''
  const activeFilterEmployee = filterEmployee && employees.includes(filterEmployee) ? filterEmployee : ''
  const activeMismatchOnly = hasMismatches && mismatchOnly
  const activeFilter: AssignmentFilter = useMemo(
    () => ({ date: activeFilterDate, group: activeFilterGroup, employee: activeFilterEmployee, mismatchOnly: activeMismatchOnly }),
    [activeFilterDate, activeFilterGroup, activeFilterEmployee, activeMismatchOnly],
  )
  const hasActiveFilter = Boolean(activeFilterDate || activeFilterGroup || activeFilterEmployee || activeMismatchOnly)
  const filteredAssignments = useMemo(
    () => filterAssignments(schedule.assignments, activeFilter, employeeSkills),
    [schedule.assignments, activeFilter, employeeSkills],
  )

  function clearFilters() {
    setFilterDate('')
    setFilterGroup('')
    setFilterEmployee('')
    setMismatchOnly(false)
  }

  const understaffed = available && (schedule.understaff_slots ?? 0) > 0
  const headingLabel = understaffed
    ? 'Đã xếp lịch (còn thiếu nhân sự)'
    : statusText[schedule.status]

  return <section className="roster-surface v2-results" aria-label="Kết quả xếp lịch" ref={headingRef} tabIndex={-1}>
    <div className="v2-result-summary" data-available={available} data-understaffed={understaffed || undefined}>
      <h2>{headingLabel} <code>{schedule.status}</code></h2>
      <p>{schedule.message}</p>
      {schedule.stage_two_status && <p>Giai đoạn tối ưu phút ca <code>{schedule.stage_two_status}</code></p>}
      {available && <dl className="v2-metrics">
        <div><dt>Số ca</dt><dd>{schedule.assignments.length}</dd></div>
        <div><dt>Tổng phút ca gồm nghỉ</dt><dd>{format.format(schedule.total_shift_minutes ?? 0)}</dd></div>
        {(schedule.understaff_slots ?? 0) > 0 && (
          <div className="v2-metric-danger"><dt>Lượt thiếu người (30 phút)</dt><dd>{schedule.understaff_slots}</dd></div>
        )}
        <div><dt>Lượt người dư (30 phút)</dt><dd>{schedule.overstaff_slots}</dd></div>
        <div><dt>Lượt lệch kỹ năng (30 phút)</dt><dd>{schedule.skill_mismatch_slots}</dd></div>
      </dl>}
    </div>

    {schedule.status === 'INFEASIBLE' && (
      <div className="v2-recovery-box" role="note" aria-label="Cách xử lý khi chưa có lịch">
        <h3>Cách xử lý</h3>
        <ul>
          <li>Kiểm tra giờ rảnh và giới hạn tuần ở mục <a href="#v2-employees" className="roster-link">Nhân viên và giờ rảnh</a>.</li>
          <li>Kiểm tra các khung có cuộc gọi đã có ca phủ ở mục <a href="#v2-shifts" className="roster-link">Ca làm có thể phân công</a>.</li>
          <li>Thử bật <strong>Cho phép điều chuyển khác kỹ năng</strong> hoặc <strong>Vẫn xếp lịch khi thiếu nhân sự</strong>.</li>
        </ul>
        {onRetrySoft && (
          <div className="v2-recovery-actions">
            <Button variant="primary" onClick={onRetrySoft}>Vẫn xếp lịch với nhân sự hiện có</Button>
          </div>
        )}
      </div>
    )}

    {(schedule.status === 'FEASIBLE' || schedule.status === 'UNKNOWN') && (
      <div className="v2-recovery-box" role="note" aria-label="Gợi ý khi hết thời gian tìm lịch">
        <h3>Hết thời gian tìm lịch</h3>
        <p>
          {schedule.status === 'FEASIBLE'
            ? `Đã chạm giới hạn ${solveSeconds ?? 10} giây. Có thể dùng lịch này hoặc thử tăng lên 30 giây để tối ưu thêm.`
            : `Chưa tìm được lịch trong ${solveSeconds ?? 10} giây. Thử tăng lên 30 giây hoặc giảm bớt số ca ứng viên.`}
        </p>
        {onRetryLonger && (
          <div className="v2-recovery-actions">
            <Button variant="primary" onClick={onRetryLonger}>Thử lại với giới hạn 30 giây</Button>
          </div>
        )}
      </div>
    )}

    {schedule.warnings.length > 0 && <div className="v2-warnings"><h3>Cảnh báo</h3>
      <ul>{schedule.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
    </div>}

    <section className="v2-result-section" aria-label="Biểu đồ độ phủ">
      <h3>Biểu đồ độ phủ theo khung 30 phút</h3>
      <div className="v2-controls">
        <Choice label="Ngày xem độ phủ" value={date} options={dates.map((value) => ({ value, label: displayDate(value) }))} onChange={setDate} />
        <Choice label="Nhóm xem độ phủ" value={group} options={result.groups.map(({ id, name }) => ({ value: id, label: name }))} onChange={setGroup} />
        {available && rows.length > 0 && (
          <div className="v2-coverage-pills" aria-label="Tóm tắt trạng thái độ phủ">
            <span className="v2-pill" data-state="exact">Đủ: {coverageSummary.exact}</span>
            <span className="v2-pill" data-state="over">Thừa: {coverageSummary.over}</span>
            <span className="v2-pill" data-state="under">Thiếu: {coverageSummary.under}</span>
          </div>
        )}
      </div>
      <div className="v2-chart-legend">
        <span><i className="v2-bar-needed" />Người cần</span>
        {available ? <>
          <span><i className="v2-bar-assigned" data-state="exact" />Đủ người</span>
          <span><i className="v2-bar-assigned" data-state="over" />Thừa người</span>
          <span><i className="v2-bar-assigned" data-state="under" />Thiếu người</span>
        </> : <span>Chưa có lịch</span>}
      </div>
      <CoverageChart rows={rows} available={available} />
    </section>

    <Table title="Nhu cầu và độ phủ theo khoảng 30 phút" columns={['Giờ bắt đầu', 'Cuộc gọi TB', 'Số mẫu dự báo', 'Người cần', 'Đã xếp', 'Trạng thái', 'SLA ước tính tại số người cần']}>
      {rows.length === 0 && <tr><td colSpan={7}>Nhóm không có dữ liệu trong ngày này.</td></tr>}
      {rows.map((row) => {
        const state: CoverageState = available ? coverageState(row.erlang.required_staff, row.assigned_staff) : 'unavailable'
        return <tr key={callKey(row)}>
          <th scope="row">{row.start}</th>
          <td>{format.format(row.calls)}</td>
          <td>{row.sample_count ?? '—'}</td>
          <td>{row.erlang.required_staff}</td>
          <td>{row.assigned_staff ?? '—'}</td>
          <td><span className="v2-pill" data-state={state}>{coverageDeltaLabel(row.erlang.required_staff, available ? row.assigned_staff : null)}</span></td>
          <td>{row.erlang.service_level === null ? '—' : percent.format(row.erlang.service_level)}</td>
        </tr>
      })}
    </Table>

    {available && (
      <section className="v2-result-section" aria-label="Lịch phân công tuần">
        <div className="v2-schedule-header">
          <div>
            <h3>Lịch phân công tuần</h3>
            <p className="v2-filter-count">
              Hiển thị {filteredAssignments.length}/{schedule.assignments.length} ca
            </p>
          </div>
          <div className="roster-view-options" role="group" aria-label="Chế độ xem lịch phân công">
            <button
              type="button"
              aria-pressed={viewMode === 'gantt'}
              onClick={() => setViewMode('gantt')}
            >
              Lưới lịch tuần (Gantt)
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'table'}
              onClick={() => setViewMode('table')}
            >
              Bảng chi tiết
            </button>
          </div>
        </div>

        <div className="v2-controls v2-schedule-filters">
          <Choice
            label="Lọc theo ngày"
            value={activeFilterDate}
            emptyLabel="Tất cả các ngày"
            options={dates.map((value) => ({ value, label: displayDate(value) }))}
            onChange={setFilterDate}
          />
          <Choice
            label="Lọc theo nhóm"
            value={activeFilterGroup}
            emptyLabel="Tất cả các nhóm"
            options={result.groups.map(({ id, name }) => ({ value: id, label: name }))}
            onChange={setFilterGroup}
          />
          <Choice
            label="Lọc theo nhân viên"
            value={activeFilterEmployee}
            emptyLabel="Tất cả nhân viên"
            options={employees.map((id) => ({ value: id, label: id }))}
            onChange={setFilterEmployee}
          />
          {hasMismatches && (
            <Check label="Chỉ hiện ca lệch kỹ năng" checked={activeMismatchOnly} onChange={setMismatchOnly} />
          )}
          {hasActiveFilter && (
            <Button type="button" onClick={clearFilters}>Xóa bộ lọc</Button>
          )}
        </div>

        {viewMode === 'gantt' ? (
          <WeeklyGanttGrid result={result} filter={activeFilter} names={names} employeeSkills={employeeSkills} />
        ) : (
          <AssignmentDetailTable assignments={filteredAssignments} names={names} employeeSkills={employeeSkills} />
        )}
      </section>
    )}
  </section>
}
